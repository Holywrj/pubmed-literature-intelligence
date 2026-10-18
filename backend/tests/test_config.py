import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from pydantic import ValidationError

from app.core.config import REPOSITORY_ROOT, Settings


class SettingsTests(unittest.TestCase):
    def test_env_path_is_absolute_and_points_to_repository_root(self):
        expected_root = Path(__file__).resolve().parents[2]
        self.assertEqual(REPOSITORY_ROOT, expected_root)
        self.assertEqual(Settings.model_config["env_file"], expected_root / ".env")

    def test_defaults_do_not_require_api_keys(self):
        with patch.dict(os.environ, {}, clear=True):
            settings = Settings(_env_file=None)
        self.assertEqual(settings.APP_NAME, "PubMed Literature Intelligence")
        self.assertEqual(settings.APP_ENV, "development")
        self.assertIsNone(settings.PUBMED_API_KEY)
        self.assertIsNone(settings.NCBI_EMAIL)
        self.assertEqual(settings.PUBMED_FETCH_LIMIT, 200)
        self.assertEqual(settings.PUBMED_BATCH_SIZE, 100)
        self.assertEqual(settings.PUBMED_TIMEOUT_SECONDS, 20)

    def test_pubmed_limits_are_validated(self):
        for values in (
            {"PUBMED_FETCH_LIMIT": 0},
            {"PUBMED_FETCH_LIMIT": 10001},
            {"PUBMED_BATCH_SIZE": 0},
            {"PUBMED_BATCH_SIZE": 201},
            {"PUBMED_TIMEOUT_SECONDS": 0},
        ):
            with self.subTest(values=values), self.assertRaises(ValidationError):
                Settings(_env_file=None, **values)

    def test_api_key_is_not_in_settings_repr(self):
        settings = Settings(_env_file=None, PUBMED_API_KEY="test-placeholder")
        self.assertNotIn("test-placeholder", repr(settings))

    def test_dotenv_loading_and_environment_precedence(self):
        with tempfile.TemporaryDirectory() as directory:
            env_file = Path(directory) / ".env"
            env_file.write_text(
                "APP_NAME=Test Literature App\nAPP_ENV=test\n"
                "PUBMED_API_KEY=\nDEEPSEEK_API_KEY=\n",
                encoding="utf-8",
            )
            with patch.dict(os.environ, {}, clear=True):
                settings = Settings(_env_file=env_file)
                self.assertEqual(settings.APP_NAME, "Test Literature App")
                self.assertEqual(settings.APP_ENV, "test")
                with patch.dict(os.environ, {"APP_ENV": "production"}):
                    self.assertEqual(Settings(_env_file=env_file).APP_ENV, "production")
