import type { AIReviewResponse } from '../types/api'

function EvidenceLinks({ pmids }: { pmids: string[] }) {
  return <ul className="ai-evidence-links" aria-label="支持该结论的 PubMed 文献">
    {pmids.map((pmid) => <li key={pmid}><a href={`https://pubmed.ncbi.nlm.nih.gov/${pmid}/`} target="_blank" rel="noopener noreferrer">
      PMID {pmid}<span className="sr-only">（在新标签页打开）</span><span aria-hidden="true"> ↗</span>
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
        <div className="ai-heading"><h2 id="ai-title">AI 研究综述</h2><span className="ai-badge">基于 PubMed 文献证据生成</span></div>
        <p id="ai-description">{!hasSearch ? '请先检索 PubMed 文献，再生成基于文献证据的 AI 综述。'
          : '结合当前检索文献的 Abstract，提炼主要研究方向并生成中文领域综述。'}</p>
        <p>仅在点击生成时调用 AI。</p>
      </div>
      <button type="button" disabled={!canGenerate || loading} aria-busy={loading} aria-describedby="ai-description" onClick={onGenerate} className="ai-button">
        {loading ? '生成中…' : '生成 AI 综述'} <span aria-hidden="true">↗</span>
      </button>
    </div>
    {loading && <div className="loading-panel" role="status" aria-live="polite"><span className="spinner" aria-hidden="true" /><strong>正在生成 AI 研究综述…</strong></div>}
    {error && <div className="alert error-alert" role="alert"><strong>AI 综述生成失败</strong><p>{error}</p><p>PubMed 检索结果和统计分析不会受到影响。</p></div>}
    {review && <div className="ai-results">
      <p className="ai-transparency" role="status">从 {review.source_article_count} 篇已获取 PubMed 文献中选取 {review.used_article_count} 篇 Abstract 生成。</p>
      <h3>研究方向</h3>
      <div className="ai-directions">{review.research_directions.map((direction, index) => <article className="ai-direction" key={index}>
        <span className="eyebrow">方向 {String(index + 1).padStart(2, '0')}</span>
        <h4 lang="zh">{direction.title}</h4><p lang="zh">{direction.summary}</p>
        <EvidenceLinks pmids={[...new Set(direction.evidence_pmids)]} />
      </article>)}</div>
      <h3>中文文献综述</h3>
      <ol className="ai-review-points" lang="zh">{review.review_points.map((point, index) => <li key={index}>{point}</li>)}</ol>
      <h3>证据文献</h3>
      <EvidenceLinks pmids={review.evidence_pmids} />
      <p className="ai-provenance">AI 生成内容仅用于研究辅助，请结合对应 PubMed 原文核实重要结论。</p>
    </div>}
  </section>
}
