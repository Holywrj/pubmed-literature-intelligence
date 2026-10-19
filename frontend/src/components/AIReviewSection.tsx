import type { AIReviewResponse } from '../types/api'

function EvidenceLinks({ pmids }: { pmids: string[] }) {
  return <ul className="ai-evidence-links" aria-label="Supporting PubMed records">
    {pmids.map((pmid) => <li key={pmid}><a href={`https://pubmed.ncbi.nlm.nih.gov/${pmid}/`} target="_blank" rel="noopener noreferrer">
      PMID {pmid}<span className="sr-only"> (opens in a new tab)</span><span aria-hidden="true"> ↗</span>
    </a></li>)}
  </ul>
}

interface Props {
  canGenerate: boolean
  hasSearch: boolean
  loading: boolean
  error: string
  review: AIReviewResponse | null
  onGenerate: () => void
}

export function AIReviewSection({ canGenerate, hasSearch, loading, error, review, onGenerate }: Props) {
  return <section className="ai-review-section" aria-labelledby="ai-title">
    <div className="ai-panel">
      <div className="ai-symbol" aria-hidden="true">✳</div>
      <div className="ai-copy">
        <div className="ai-heading"><h2 id="ai-title">AI Research Review</h2><span className="ai-badge">Evidence-grounded synthesis</span></div>
        <p id="ai-description">{!hasSearch ? 'Search PubMed first to generate an evidence-grounded review.'
          : 'Generate research directions and a Chinese literature review from a bounded selection of the retrieved abstracts.'}</p>
        <p>Optional · sent to DeepSeek only when you generate a review.</p>
      </div>
      <button type="button" disabled={!canGenerate || loading} aria-busy={loading} aria-describedby="ai-description" onClick={onGenerate} className="ai-button">
        {loading ? 'Generating…' : 'Generate AI Review'} <span aria-hidden="true">↗</span>
      </button>
    </div>
    {loading && <div className="loading-panel" role="status" aria-live="polite"><span className="spinner" aria-hidden="true" /><strong>Generating evidence-grounded AI review…</strong></div>}
    {error && <div className="alert error-alert" role="alert"><strong>AI review could not be completed</strong><p>{error}</p><p>Your PubMed results and analytics remain available.</p></div>}
    {review && <div className="ai-results">
      <p className="ai-transparency" role="status">Generated from {review.used_article_count} abstracts selected from {review.source_article_count} retrieved PubMed articles.</p>
      <h3>Research Directions</h3>
      <div className="ai-directions">{review.research_directions.map((direction, index) => <article className="ai-direction" key={index}>
        <span className="eyebrow">DIRECTION {String(index + 1).padStart(2, '0')}</span>
        <h4 lang="zh">{direction.title}</h4><p lang="zh">{direction.summary}</p>
        <EvidenceLinks pmids={[...new Set(direction.evidence_pmids)]} />
      </article>)}</div>
      <h3>Chinese Literature Review</h3>
      <ol className="ai-review-points" lang="zh">{review.review_points.map((point, index) => <li key={index}>{point}</li>)}</ol>
      <h3>Evidence References</h3>
      <EvidenceLinks pmids={review.evidence_pmids} />
      <p className="ai-provenance">AI-generated synthesis. Verify important conclusions against the cited PubMed records.</p>
    </div>}
  </section>
}
