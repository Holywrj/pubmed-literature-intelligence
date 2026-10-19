import { lazy, Suspense, useRef, useState } from 'react'
import { analyzeLiterature, generateAIReview, searchLiterature } from './api/literature'
import { AIReviewSection } from './components/AIReviewSection'
import { MetricsCoverage } from './components/MetricsCoverage'
import { SearchBar } from './components/SearchBar'
import { StatCard } from './components/StatCard'
import { TopArticles } from './components/TopArticles'
import type { AIReviewResponse, AnalysisResponse, SearchResponse } from './types/api'
import './App.css'

const AnalyticsGrid = lazy(() => import('./components/AnalyticsGrid'))

function message(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.'
}

function App() {
  const [search, setSearch] = useState<SearchResponse | null>(null)
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null)
  const [stage, setStage] = useState<'idle' | 'searching' | 'analyzing'>('idle')
  const [error, setError] = useState('')
  const [analysisError, setAnalysisError] = useState('')
  const [submittedQuery, setSubmittedQuery] = useState('')
  const [aiReview, setAIReview] = useState<AIReviewResponse | null>(null)
  const [aiError, setAIError] = useState('')
  const [aiLoading, setAILoading] = useState(false)
  const aiRequest = useRef<AbortController | null>(null)
  const loading = stage !== 'idle'

  async function handleAIReview() {
    if (!search?.articles.length || loading || aiRequest.current) return
    const controller = new AbortController()
    aiRequest.current = controller
    setAILoading(true)
    setAIError('')
    setAIReview(null)
    try {
      const review = await generateAIReview(search.query, search.articles, controller.signal)
      if (aiRequest.current === controller) setAIReview(review)
    } catch (failure) {
      if (aiRequest.current === controller) setAIError(message(failure))
    } finally {
      if (aiRequest.current === controller) {
        aiRequest.current = null
        setAILoading(false)
      }
    }
  }

  async function handleSearch(query: string) {
    if (loading || !query.trim()) return
    aiRequest.current?.abort()
    aiRequest.current = null
    setAIReview(null)
    setAIError('')
    setAILoading(false)
    setSubmittedQuery(query.trim())
    setError('')
    setAnalysisError('')
    setSearch(null)
    setAnalysis(null)
    setStage('searching')
    try {
      const result = await searchLiterature(query)
      setSearch(result)
      setStage('analyzing')
      try {
        setAnalysis(await analyzeLiterature(result.articles, result.total_count))
      } catch (failure) {
        setAnalysisError(message(failure))
      }
    } catch (failure) {
      setError(message(failure))
    } finally {
      setStage('idle')
    }
  }

  const coverage = analysis && analysis.analyzed_count > 0
    ? `${Math.round(analysis.journal_metrics_summary.articles_with_metrics / analysis.analyzed_count * 100)}%`
    : analysis ? '0%' : '—'

  return (
    <>
      <a className="skip-link" href="#workspace">Skip to workspace</a>
      <header className="site-header">
        <div className="header-inner">
          <div className="brand"><div className="brand-mark" aria-hidden="true"><svg viewBox="0 0 30 30" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M5 7.5c4-1.5 7-1 10 1.5 3-2.5 6-3 10-1.5v16c-4-1.5-7-1-10 1.5-3-2.5-6-3-10-1.5zM15 9v16M9 12l3 1M18 13l3-1M9 17l3 1M18 18l3-1" /></svg></div>
            <div><h1>PubMed Literature Intelligence</h1><p>AI-assisted biomedical literature search and research intelligence</p></div></div>
          <span className="pubmed-badge"><span className="status-dot" />Powered by PubMed</span>
        </div>
      </header>

      <main id="workspace" className="workspace">
        <SearchBar loading={loading} onSearch={handleSearch} />

        {loading && <div className="loading-panel" role="status" aria-live="polite">
          <span className="spinner" aria-hidden="true" /><div><strong>{stage === 'searching' ? 'Searching PubMed and analyzing retrieved literature…' : 'Articles retrieved. Building your analysis…'}</strong><p>“{submittedQuery}” · {stage === 'searching' ? 'Retrieving article metadata from NCBI' : 'Calculating statistics from the retrieved sample'}</p></div>
        </div>}
        {error && <div className="alert error-alert" role="alert"><strong>Search could not be completed</strong><p>{error}</p><p className="error-query">Query: “{submittedQuery}”</p></div>}
        {analysisError && <div className="alert warning-alert" role="alert"><strong>Articles retrieved; analysis is unavailable.</strong><p>{analysisError}</p><p>Your search results are preserved below. You can inspect the articles or submit the search again.</p></div>}

        {search && <>
          <div className="section-heading"><div><span className="eyebrow">SEARCH OVERVIEW</span><h2>Evidence for <span>“{search.query}”</span></h2></div><span className="sample-badge">{search.returned_count.toLocaleString()} retrieved</span></div>
          <div className="stats-grid">
            <StatCard label="PubMed Results" value={search.total_count.toLocaleString()} note="All matching results in PubMed" />
            <StatCard label="Analyzed Articles" value={analysis ? analysis.analyzed_count.toLocaleString() : '—'} note={analysis ? 'Retrieved sample · not all PubMed matches' : stage === 'analyzing' ? 'Analysis in progress' : 'Analysis unavailable'} />
            <StatCard label="Recent 5 Years" value={analysis ? analysis.recent_five_year_count.toLocaleString() : '—'} note={analysis ? `${analysis.recent_five_year_start}–${analysis.current_year} · within the analyzed sample` : 'Available after analysis'} />
            <StatCard label="Metrics Coverage" value={coverage} note={analysis ? `${analysis.journal_metrics_summary.articles_with_metrics.toLocaleString()} / ${analysis.analyzed_count.toLocaleString()} analyzed articles with metrics` : 'Available after analysis'} accent />
          </div>
          {search.total_count === 0 && <div className="empty-result" role="status"><h3>No matching literature found</h3><p>Try a broader topic, a different spelling, or a related MeSH term.</p></div>}
          {search.total_count > 0 && search.returned_count === 0 && <div className="alert warning-alert"><strong>PubMed found matches, but no usable articles were retrieved.</strong><p>The analytics below describe an empty sample. Try another search.</p></div>}
          {analysis && <>
            <div className="section-heading analytics-heading"><div><span className="eyebrow">LITERATURE LANDSCAPE</span><h2>A snapshot of your research sample</h2></div><p>Based on {analysis.analyzed_count.toLocaleString()} analyzed articles</p></div>
            <Suspense fallback={<div className="loading-panel" role="status">Preparing visualizations…</div>}>
              <AnalyticsGrid analysis={analysis} />
            </Suspense>
            <MetricsCoverage metrics={analysis.journal_metrics_summary} />
            <TopArticles key={search.query} ranked={analysis.top_articles} yearStart={analysis.recent_five_year_start} yearEnd={analysis.current_year} />
          </>}
          {!analysis && <TopArticles key={search.query} retrieved={search.articles} />}
        </>}

        {!search && !loading && !error && <section className="welcome-panel" aria-labelledby="welcome-title">
          <div className="welcome-intro"><span className="eyebrow">YOUR RESEARCH WORKSPACE</span><h2 id="welcome-title">From a question to a literature landscape.</h2><p>Start with a topic above. Your results, research hotspots, and article shortlist will appear here.</p></div>
          <ol className="workflow"><li><span>01</span><h3>Search the evidence</h3><p>Find PubMed articles and explore their original metadata.</p></li><li><span>02</span><h3>See the patterns</h3><p>Understand publication trends, journals, and MeSH research topics.</p></li><li><span>03</span><h3>Inspect the literature</h3><p>Read abstracts and follow each article back to its PubMed source.</p></li></ol>
          <div className="welcome-note"><span className="status-dot" />Live data, transparent analysis. No sample results are shown.</div>
        </section>}

        <AIReviewSection canGenerate={!!search?.articles.length && !loading} hasSearch={!!search} loading={aiLoading} error={aiError} review={aiReview} onGenerate={handleAIReview} />

        <footer className="site-footer"><span className="footer-brand">PUBMED LITERATURE INTELLIGENCE</span><p>This tool supports literature exploration and research analysis. It is not intended for medical diagnosis or treatment decisions.</p><p>Journal metrics may be unavailable unless a legitimate metrics data source is configured.</p><span className="footer-note">PubMed metadata · Deterministic analysis · Optional AI research review</span></footer>
      </main>
    </>
  )
}

export default App
