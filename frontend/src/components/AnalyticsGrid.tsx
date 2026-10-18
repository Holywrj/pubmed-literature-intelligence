import type { AnalysisResponse } from '../types/api'
import { JournalChart } from './JournalChart'
import { MeshCloud } from './MeshCloud'
import { PublicationTrendChart } from './PublicationTrendChart'
import { QuartileChart } from './QuartileChart'

export default function AnalyticsGrid({ analysis }: { analysis: AnalysisResponse }) {
  return <div className="analytics-grid">
    <PublicationTrendChart distribution={analysis.publication_year_distribution} />
    <JournalChart journals={analysis.journal_distribution} />
    <MeshCloud terms={analysis.mesh_term_frequency} />
    <QuartileChart metrics={analysis.journal_metrics_summary} />
  </div>
}
