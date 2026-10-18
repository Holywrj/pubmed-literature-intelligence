export interface PubMedArticle {
  pmid: string
  title: string
  abstract: string | null
  journal: string | null
  issn: string | null
  publication_year: number | null
  authors: string[]
  mesh_terms: string[]
}

export interface SearchResponse {
  query: string
  total_count: number
  returned_count: number
  articles: PubMedArticle[]
}

export interface JournalCount { journal: string; count: number }
export interface MeshTermFrequency { term: string; frequency: number }
export type Quartile = 'Q1' | 'Q2' | 'Q3' | 'Q4'
export type QuartileDistribution = Record<Quartile | 'Unknown', number>

export interface JournalMetric {
  journal_name: string
  issn: string | null
  metric_year: number
  jif: number | null
  jcr_quartile: Quartile | null
  category: string | null
  source: string
}

export interface ArticleJournalMetrics {
  pmid: string
  journal_name: string | null
  issn: string | null
  metric_year: number | null
  journal_jif: number | null
  best_jcr_quartile: Quartile | null
  records: JournalMetric[]
}

export interface JournalMetricsSummary {
  journals_with_metrics: number
  journals_without_metrics: number
  articles_with_metrics: number
  articles_without_metrics: number
  quartile_distribution: QuartileDistribution
  article_metrics: ArticleJournalMetrics[]
}

export interface RankedArticle {
  article: PubMedArticle
  journal_metrics: ArticleJournalMetrics
}

export interface AnalysisResponse {
  total_count: number
  analyzed_count: number
  current_year: number
  recent_five_year_start: number
  publication_year_distribution: Record<string, number>
  recent_five_year_count: number
  journal_distribution: JournalCount[]
  mesh_term_frequency: MeshTermFrequency[]
  journal_metrics_summary: JournalMetricsSummary
  top_articles: RankedArticle[]
}
