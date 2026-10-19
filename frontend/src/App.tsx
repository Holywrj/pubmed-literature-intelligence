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
  return error instanceof Error ? error.message : '发生未知错误，请重试。'
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
      <a className="skip-link" href="#workspace">跳转到工作区</a>
      <header className="site-header">
        <div className="header-inner">
          <div className="brand"><div className="brand-mark" aria-hidden="true"><svg viewBox="0 0 30 30" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M5 7.5c4-1.5 7-1 10 1.5 3-2.5 6-3 10-1.5v16c-4-1.5-7-1-10 1.5-3-2.5-6-3-10-1.5zM15 9v16M9 12l3 1M18 13l3-1M9 17l3 1M18 18l3-1" /></svg></div>
            <div><h1>PubMed 文献智能分析</h1><p>AI 辅助的生物医学文献检索与研究分析</p></div></div>
          <span className="pubmed-badge"><span className="status-dot" />数据来源：PubMed</span>
        </div>
      </header>

      <main id="workspace" className="workspace">
        <SearchBar loading={loading} onSearch={handleSearch} />

        {loading && <div className="loading-panel" role="status" aria-live="polite">
          <span className="spinner" aria-hidden="true" /><div><strong>{stage === 'searching' ? '正在检索 PubMed 文献…' : '文献获取完成，正在生成统计分析…'}</strong><p>“{submittedQuery}” · {stage === 'searching' ? '正在从 NCBI 获取文献 metadata' : '正在计算当前文献样本的统计结果'}</p></div>
        </div>}
        {error && <div className="alert error-alert" role="alert"><strong>PubMed 检索失败</strong><p>{error}</p><p className="error-query">检索词：“{submittedQuery}”</p></div>}
        {analysisError && <div className="alert warning-alert" role="alert"><strong>文献已获取；统计分析暂不可用。</strong><p>{analysisError}</p><p>已保留检索结果。你可以查看文献，或重新提交检索。</p></div>}

        {search && <>
          <div className="section-heading"><div><span className="eyebrow">检索概览</span><h2>“{search.query}” 的文献检索结果</h2></div><span className="sample-badge">已获取 {search.returned_count.toLocaleString()} 篇</span></div>
          <div className="stats-grid">
            <StatCard label="PubMed 检索结果" value={search.total_count.toLocaleString()} note="PubMed 中所有匹配结果" />
            <StatCard label="分析文献" value={analysis ? analysis.analyzed_count.toLocaleString() : '—'} note={analysis ? '当前获取的文献样本，并非全部 PubMed 结果' : stage === 'analyzing' ? '正在进行统计分析' : '统计分析暂不可用'} />
            <StatCard label="近 5 年文献" value={analysis ? analysis.recent_five_year_count.toLocaleString() : '—'} note={analysis ? `${analysis.recent_five_year_start}–${analysis.current_year} · 当前分析样本` : '统计分析完成后可查看'} />
            <StatCard label="期刊指标覆盖率" value={coverage} note={analysis ? `${analysis.journal_metrics_summary.articles_with_metrics.toLocaleString()} / ${analysis.analyzed_count.toLocaleString()} 篇分析文献具有期刊指标` : '统计分析完成后可查看'} accent />
          </div>
          {search.total_count === 0 && <div className="empty-result" role="status"><h3>未找到匹配文献</h3><p>请尝试更宽泛的主题、其他拼写方式或相关 MeSH 词。</p></div>}
          {search.total_count > 0 && search.returned_count === 0 && <div className="alert warning-alert"><strong>PubMed 找到了匹配结果，但未能获取可用文献。</strong><p>下方统计分析将基于空样本。请尝试其他检索词。</p></div>}
          {analysis && <>
            <div className="section-heading analytics-heading"><div><span className="eyebrow">文献分析</span><h2>研究领域文献概览</h2></div><p>基于 {analysis.analyzed_count.toLocaleString()} 篇文献分析</p></div>
            <Suspense fallback={<div className="loading-panel" role="status">正在准备可视化图表…</div>}>
              <AnalyticsGrid analysis={analysis} />
            </Suspense>
            <MetricsCoverage metrics={analysis.journal_metrics_summary} />
            <TopArticles key={search.query} ranked={analysis.top_articles} yearStart={analysis.recent_five_year_start} yearEnd={analysis.current_year} />
          </>}
          {!analysis && <TopArticles key={search.query} retrieved={search.articles} />}
        </>}

        {!search && !loading && !error && <section className="welcome-panel" aria-labelledby="welcome-title">
          <div className="welcome-intro"><span className="eyebrow">研究工作台</span><h2 id="welcome-title">从研究问题出发，快速了解文献全景</h2><p>输入一个研究主题，即可查看 PubMed 检索结果、研究热点、趋势分析与核心文献。</p></div>
          <ol className="workflow"><li><span>01</span><h3>检索文献</h3><p>从 PubMed 获取真实生物医学文献及 metadata。</p></li><li><span>02</span><h3>分析趋势</h3><p>查看发表趋势、主要期刊和 MeSH 研究热点。</p></li><li><span>03</span><h3>阅读核心文献</h3><p>查看 Abstract，并通过 PMID 跳转至 PubMed 原始记录。</p></li></ol>
          <div className="welcome-note"><span className="status-dot" />实时数据 · 透明分析 · 页面不展示虚构示例结果</div>
        </section>}

        <AIReviewSection canGenerate={!!search?.articles.length && !loading} hasSearch={!!search} loading={aiLoading} error={aiError} review={aiReview} onGenerate={handleAIReview} />

        <footer className="site-footer"><span className="footer-brand">PUBMED LITERATURE INTELLIGENCE</span><p>本工具用于文献检索与研究分析，不用于医学诊断或治疗决策。</p><p>若未配置合法的期刊指标数据源，JIF / JCR Quartile 可能显示为暂无数据。</p><span className="footer-note">PubMed metadata · 确定性统计分析 · AI 研究综述</span></footer>
      </main>
    </>
  )
}

export default App
