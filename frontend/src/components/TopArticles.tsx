import { Fragment, useId, useState } from 'react'
import type { ArticleJournalMetrics, PubMedArticle, RankedArticle } from '../types/api'

type ArticleRow = { article: PubMedArticle; journal_metrics?: ArticleJournalMetrics }

export function TopArticles({ ranked, retrieved, yearStart, yearEnd }: {
  ranked?: RankedArticle[]; retrieved?: PubMedArticle[]; yearStart?: number; yearEnd?: number
}) {
  const [expanded, setExpanded] = useState<number | null>(null)
  const id = useId()
  const isRanked = ranked !== undefined
  const rows: ArticleRow[] = ranked ?? (retrieved ?? []).map(article => ({ article }))
  return <section className="panel articles-panel" aria-labelledby={`${id}-title`}>
    <div className="panel-header"><div><h3 id={`${id}-title`}>{isRanked ? 'Top Articles' : 'Retrieved Articles'}</h3>
      <p>{isRanked ? `Up to 100 articles from ${yearStart}–${yearEnd}, ranked by publishing journal JIF, then year and PMID.` : 'Search results are preserved. Analysis and ranking are unavailable.'}</p>
    </div><span className="panel-tag">{rows.length} ARTICLES</span></div>
    {isRanked && <p className="ranking-note">Journal JIF describes the publishing journal, not the impact or quality of an individual article. Articles without JIF follow those with JIF.</p>}
    {!rows.length ? <div className="article-empty">{isRanked ? 'No articles fall within the recent five-year window.' : 'No articles were retrieved.'}</div> :
      <div className="article-table-wrap"><table className="article-table">
        <caption className="sr-only">{isRanked ? 'Recent articles ranked by journal metrics' : 'Retrieved PubMed articles'}</caption>
        <thead><tr><th scope="col">Rank</th><th scope="col">Article / Authors</th><th scope="col">Year</th><th scope="col">Journal</th><th scope="col">Journal JIF</th><th scope="col">JCR Quartile</th><th scope="col">PubMed</th></tr></thead>
        <tbody>{rows.map(({ article, journal_metrics: metric }, index) => <Fragment key={`${article.pmid}-${index}`}>
          <tr className={expanded === index ? 'is-expanded' : ''}>
            <td className="rank-cell" data-label="Rank">{isRanked ? String(index + 1).padStart(2, '0') : '—'}</td>
            <td className="article-title-cell"><button className="article-title" type="button" aria-expanded={expanded === index} aria-controls={`${id}-${index}`} onClick={() => setExpanded(expanded === index ? null : index)}>{article.title}</button>
              <p className="authors-preview">{article.authors.length ? article.authors.slice(0, 3).join(', ') + (article.authors.length > 3 ? ' et al.' : '') : 'Authors unavailable'}</p>
              <button type="button" className="details-toggle" aria-expanded={expanded === index} aria-controls={`${id}-${index}`} onClick={() => setExpanded(expanded === index ? null : index)}>{expanded === index ? 'Hide details −' : 'View details +'}</button></td>
            <td data-label="Year">{article.publication_year ?? 'N/A'}</td>
            <td className="journal-cell" data-label="Journal">{article.journal || 'Unknown journal'}</td>
            <td className="jif-cell" data-label="Journal JIF">{metric?.journal_jif != null ? metric.journal_jif.toLocaleString(undefined, { maximumFractionDigits: 2 }) : 'N/A'}</td>
            <td data-label="JCR Quartile"><span className={`quartile-badge${metric?.best_jcr_quartile ? ' available' : ''}`}>{metric?.best_jcr_quartile ?? 'Unknown'}</span></td>
            <td data-label="PubMed"><a className="pubmed-link" href={`https://pubmed.ncbi.nlm.nih.gov/${encodeURIComponent(article.pmid)}/`} target="_blank" rel="noopener noreferrer" aria-label={`PMID ${article.pmid} on PubMed (opens in a new tab)`}>{article.pmid} <span aria-hidden="true">↗</span></a></td>
          </tr>
          <tr className="detail-row" hidden={expanded !== index}><td colSpan={7}><div className="article-detail" id={`${id}-${index}`}>
            <h4>Abstract</h4><p className="abstract-text">{article.abstract || 'No abstract is available for this article.'}</p>
            <h4>Authors</h4><p>{article.authors.join(', ') || 'Authors unavailable'}</p>
            <h4>MeSH terms</h4><div className="detail-terms">{article.mesh_terms.length ? article.mesh_terms.map(term => <span key={term}>{term}</span>) : 'No MeSH terms available'}</div>
            <p className="article-identifiers">ISSN: {article.issn || 'N/A'} <span>PMID: {article.pmid}</span>{metric?.metric_year != null && <span>Metric year: {metric.metric_year}</span>}</p>
          </div></td></tr>
        </Fragment>)}</tbody>
      </table></div>}
  </section>
}
