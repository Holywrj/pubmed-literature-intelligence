import { Fragment, useId, useState } from 'react'
import type { FormEvent } from 'react'
import type { ArticleJournalMetrics, PubMedArticle, RankedArticle } from '../types/api'

type ArticleRow = { article: PubMedArticle; journal_metrics?: ArticleJournalMetrics }
const PAGE_SIZE = 10

export function TopArticles({ ranked, retrieved, yearStart, yearEnd }: {
  ranked?: RankedArticle[]; retrieved?: PubMedArticle[]; yearStart?: number; yearEnd?: number
}) {
  const [expanded, setExpanded] = useState<number | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageInput, setPageInput] = useState('1')
  const dataset = ranked ?? retrieved
  const [previousDataset, setPreviousDataset] = useState(dataset)
  const id = useId()
  const isRanked = ranked !== undefined
  const rows: ArticleRow[] = ranked ?? (retrieved ?? []).map(article => ({ article }))
  const totalPages = Math.ceil(rows.length / PAGE_SIZE)
  const page = Math.min(currentPage, Math.max(1, totalPages))
  const pageOffset = (page - 1) * PAGE_SIZE
  const pageRows = rows.slice(pageOffset, pageOffset + PAGE_SIZE)

  // Reset before rendering a replacement dataset, including ranked/retrieved mode changes.
  if (previousDataset !== dataset) {
    setPreviousDataset(dataset)
    setCurrentPage(1)
    setPageInput('1')
    setExpanded(null)
  }

  function changePage(nextPage: number) {
    const targetPage = Math.max(1, Math.min(nextPage, totalPages))
    setExpanded(null)
    setCurrentPage(targetPage)
    setPageInput(String(targetPage))
  }

  function jumpToPage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const targetPage = Number(pageInput)
    if (!pageInput.trim() || !Number.isFinite(targetPage) || !Number.isInteger(targetPage)) {
      setPageInput(String(page))
      return
    }
    changePage(targetPage)
  }

  return <section className="panel articles-panel" aria-labelledby={`${id}-title`}>
    <div className="panel-header"><div><h3 id={`${id}-title`}>{isRanked ? '文献排行' : '检索文献'}</h3>
      <p>{isRanked ? `近五年（${yearStart}–${yearEnd}）最多展示 100 篇文献，依据 Journal JIF、年份和 PMID 排序。` : '已保留检索结果；统计分析和文献排名暂不可用。'}</p>
    </div><span className="panel-tag">{rows.length} 篇文献</span></div>
    {isRanked && <p className="ranking-note">Journal JIF 反映期刊指标，并不代表单篇文献的影响力或质量。没有 JIF 的文献排在有 JIF 的文献之后。</p>}
    {!rows.length ? <div className="article-empty">{isRanked ? '近五年范围内暂无文献。' : '暂无已获取的文献。'}</div> :
      <div className="article-table-wrap"><table className="article-table">
        <caption className="sr-only">{isRanked ? '按期刊指标排序的近期文献' : '已检索的 PubMed 文献'}</caption>
        <thead><tr><th scope="col">排名</th><th scope="col">论文 / 作者</th><th scope="col">年份</th><th scope="col">期刊</th><th scope="col">Journal JIF</th><th scope="col">JCR Quartile</th><th scope="col">PubMed</th></tr></thead>
        <tbody>{pageRows.map(({ article, journal_metrics: metric }, localIndex) => {
          const index = pageOffset + localIndex
          return <Fragment key={`${article.pmid}-${index}`}>
          <tr className={expanded === index ? 'is-expanded' : ''}>
            <td className="rank-cell" data-label="排名">{isRanked ? String(index + 1).padStart(2, '0') : '—'}</td>
            <td className="article-title-cell"><button className="article-title" type="button" aria-expanded={expanded === index} aria-controls={`${id}-${index}`} onClick={() => setExpanded(expanded === index ? null : index)}>{article.title}</button>
              <p className="authors-preview">{article.authors.length ? article.authors.slice(0, 3).join(', ') + (article.authors.length > 3 ? ' 等' : '') : '作者信息暂无'}</p>
              <button type="button" className="details-toggle" aria-expanded={expanded === index} aria-controls={`${id}-${index}`} onClick={() => setExpanded(expanded === index ? null : index)}>{expanded === index ? '收起详情 −' : '查看详情 +'}</button></td>
            <td data-label="年份">{article.publication_year ?? 'N/A'}</td>
            <td className="journal-cell" data-label="期刊">{article.journal || '未知期刊'}</td>
            <td className="jif-cell" data-label="Journal JIF">{metric?.journal_jif != null ? metric.journal_jif.toLocaleString(undefined, { maximumFractionDigits: 2 }) : 'N/A'}</td>
            <td data-label="JCR Quartile"><span className={`quartile-badge${metric?.best_jcr_quartile ? ' available' : ''}`}>{metric?.best_jcr_quartile ?? '暂无'}</span></td>
            <td data-label="PubMed"><a className="pubmed-link" href={`https://pubmed.ncbi.nlm.nih.gov/${encodeURIComponent(article.pmid)}/`} target="_blank" rel="noopener noreferrer" aria-label={`PMID ${article.pmid}，在 PubMed 查看（在新标签页打开）`}>{article.pmid} <span aria-hidden="true">↗</span></a></td>
          </tr>
          <tr className="detail-row" hidden={expanded !== index}><td colSpan={7}><div className="article-detail" id={`${id}-${index}`}>
            <h4>Abstract</h4><p className="abstract-text">{article.abstract || '该文献暂无 Abstract。'}</p>
            <h4>作者</h4><p>{article.authors.join(', ') || '作者信息暂无'}</p>
            <h4>MeSH terms</h4><div className="detail-terms">{article.mesh_terms.length ? article.mesh_terms.map(term => <span key={term}>{term}</span>) : '暂无 MeSH terms'}</div>
            <p className="article-identifiers">ISSN: {article.issn || 'N/A'} <span>PMID: {article.pmid}</span>{metric?.metric_year != null && <span>指标年份：{metric.metric_year}</span>}</p>
          </div></td></tr>
        </Fragment>})}</tbody>
      </table></div>}
    {totalPages > 1 && <nav className="article-pagination" aria-label="文献分页">
      <div className="article-page-controls">
        <button type="button" aria-label="首页文献" disabled={page === 1} onClick={() => changePage(1)}>首页</button>
        <button type="button" aria-label="上一页文献" disabled={page === 1} onClick={() => changePage(page - 1)}>上一页</button>
      </div>
      <form className="article-page-jump" onSubmit={jumpToPage} noValidate>
        <label htmlFor={`${id}-page`} className="sr-only">文献页码</label>
        <span>第</span>
        <input id={`${id}-page`} type="number" min={1} max={totalPages} step={1} value={pageInput}
          onChange={event => setPageInput(event.target.value)} aria-describedby={`${id}-page-total`} />
        <span id={`${id}-page-total`}>/ {totalPages} 页</span>
        <button type="submit" className="article-jump-button">跳转</button>
      </form>
      <div className="article-page-controls">
        <button type="button" aria-label="下一页文献" disabled={page === totalPages} onClick={() => changePage(page + 1)}>下一页</button>
        <button type="button" aria-label="末页文献" disabled={page === totalPages} onClick={() => changePage(totalPages)}>末页</button>
      </div>
      <p className="article-page-summary" role="status" aria-live="polite" aria-atomic="true"><span className="sr-only">第 {page} / {totalPages} 页 · </span>共 {rows.length} 篇</p>
    </nav>}
  </section>
}
