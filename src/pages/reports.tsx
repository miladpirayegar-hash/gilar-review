import { ArrowRight, BarChart3, FileText, Gauge, LineChart } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { PageHeader, SectionTitle, StatusPill } from '../components/layout'

const reports = [
  { title: 'Daily Brief', description: 'A prioritized view of what changed, what needs you, and what Gilar handled.', to: '/app/brief', icon: FileText, tone: 'blue', label: 'Updated today' },
  { title: 'Business Health Report', description: 'The explainable health score across revenue, cash, sales, operations, and team signals.', to: '/app/executive', icon: Gauge, tone: 'green', label: '8 dimensions' },
  { title: 'Results Report', description: 'Measured outcomes kept separate from directional value and estimated business impact.', to: '/app/insights', icon: LineChart, tone: 'yellow', label: '30-day view' },
  { title: 'ROI Report', description: 'A transparent view of measured savings, estimated lift, assumptions, and confidence.', to: '/app/insights', icon: BarChart3, tone: 'blue', label: 'Evidence-backed' },
]

export function ReportsPage() {
  const navigate = useNavigate()
  return <div className="reports-page"><PageHeader eyebrow="Gilar / Reports" title="Reports" description="A clear record of your business signals, actions, and measured change." /><section className="reports-overview panel"><div><span className="eyebrow">Northstar Distribution</span><h2>Business intelligence you can share.</h2><p>Open a report when you want the complete context behind today’s decision, not another dashboard to maintain.</p></div><StatusPill tone="green">Synthetic workspace</StatusPill></section><section className="reports-section"><SectionTitle title="Your reports" description="Each report keeps source context, confidence, and measurement status visible." /><div className="reports-grid">{reports.map(({ title, description, to, icon: Icon, tone, label }) => <button className="report-card panel" key={title} onClick={() => navigate(to)}><span className={`report-card-icon ${tone}`}><Icon size={21} /></span><span className="report-card-copy"><strong>{title}</strong><small>{description}</small></span><span className="report-card-footer"><span>{label}</span><ArrowRight size={16} /></span></button>)}</div></section></div>
}
