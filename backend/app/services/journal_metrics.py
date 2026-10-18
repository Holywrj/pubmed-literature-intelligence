import csv
from pathlib import Path
from typing import Protocol

from pydantic import ValidationError

from app.schemas.analysis import JournalMetric


def normalize_issn(value: str | None) -> str:
    return (value or "").strip().replace("-", "").upper()


def normalize_journal_name(value: str | None) -> str:
    return " ".join((value or "").split()).casefold()


class JournalMetricsProvider(Protocol):
    def lookup(
        self, *, issn: str | None, journal_name: str | None
    ) -> list[JournalMetric]: ...


class CsvJournalMetricsProvider:
    COLUMNS = {
        "journal_name", "issn", "metric_year", "jif", "jcr_quartile", "category", "source"
    }

    def __init__(self, path: Path | None):
        self._by_issn: dict[str, list[JournalMetric]] = {}
        self._by_name: dict[str, list[JournalMetric]] = {}
        self.invalid_row_count = 0
        self.load_error: str | None = None
        if path is None:
            return
        try:
            with path.open(newline="", encoding="utf-8-sig") as file:
                reader = csv.DictReader(file, strict=True)
                if not self.COLUMNS.issubset(reader.fieldnames or []):
                    self.load_error = "Journal metrics CSV is missing required columns."
                    return
                for row in reader:
                    if None in row or any(value is None for value in row.values()):
                        self.invalid_row_count += 1
                        continue
                    values = {key: row[key].strip() or None for key in self.COLUMNS}
                    try:
                        metric = JournalMetric.model_validate(values)
                    except ValidationError:
                        self.invalid_row_count += 1
                        continue
                    issn = normalize_issn(metric.issn)
                    if issn:
                        self._by_issn.setdefault(issn, []).append(metric)
                    name = normalize_journal_name(metric.journal_name)
                    self._by_name.setdefault(name, []).append(metric)
        except FileNotFoundError:
            pass  # Optional local data; never fall back to the synthetic template.
        except (OSError, UnicodeError, csv.Error):
            self._by_issn.clear()
            self._by_name.clear()
            self.load_error = "Journal metrics CSV could not be read."

    def lookup(
        self, *, issn: str | None, journal_name: str | None
    ) -> list[JournalMetric]:
        records = self._by_issn.get(normalize_issn(issn))
        if not records:
            records = self._by_name.get(normalize_journal_name(journal_name), [])
        return list(records)
