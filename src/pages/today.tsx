import { useEffect, useMemo, useState } from 'react'
import { ArrowDownRight, ArrowRight, ArrowUpRight, Check, CircleAlert, Clock3, TrendingDown, TrendingUp, Wallet, Zap } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button, EmptyState, PageHeader, SectionTitle, StatusPill } from '../components/layout'
import { IntelligenceCore } from '../components/intelligence-core'
import { syntheticApi, type SyntheticOverview } from '../services/syntheticService'

function useCustomerOverview() {
  const [overview, setOverview] = useState<SyntheticOverview>()
  useEffect(() => {
    const refresh = () => { void syntheticApi.overview().then(setOverview).catch(() => undefined) }
    refresh()
    window.addEventListener('gilar:synthetic-updated', refresh)
    return () => window.removeEventListener('gilar:synthetic-updated', refresh)
  }, [])
  return overview
}

const fallbackAttention = [
  { title: 'Proposal conversion is slowing', detail: 'Conversion fell from 31% to 23% over the last 3 months.', severity: 'high' as const },
  { title: '11 invoices need follow-up', detail: '$42,000 is waiting on customer response.', severity: 'medium' as const },
  { title: 'Product X stock is running low', detail: 'Current inventory covers about 12 days.', severity: 'medium' as const },
]

function PulseSparkline({ down = false }: { down?: boolean }) {
  return <svg className="today-sparkline" viewBox="0 0 120 32" preserveAspectRatio="none" aria-hidden="true"><path d={down ? 'M2 7 C15 8 18 14 30 12 S46 16 58 14 S74 19 88 20 S103 25 118 27' : 'M2 26 C14 24 18 20 30 22 S45 16 58 18 S72 11 85 13 S103 6 118 4'} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
}

export function TodayPage() {
  const navigate = useNavigate()
  const overview = useCustomerOverview()
  const attention = useMemo(() => overview?.dashboard.attention?.slice(0, 3).map((item) => ({ title: item.title, detail: item.detail, severity: item.severity })) ?? fallbackAttention, [overview])
  const metrics = overview?.dashboard.metrics ?? [
    { label: 'Revenue', value: '$842K', change: '+6.4%', trend: 'up' as const },
    { label: 'Cash position', value: '$124K', change: 'Stable', trend: 'flat' as const },
    { label: 'Sales conversion', value: '23%', change: '-11%', trend: 'down' as const },
    { label: 'Inventory cover', value: '12 days', change: 'Watch', trend: 'down' as const },
  ]

  return <div className="today-page">
    <PageHeader eyebrow="Good morning, Milad." title="Here’s what needs your attention." description="Gilar monitored your business overnight and found 3 key issues with the biggest potential impact." actions={<Button onClick={() => navigate('/app/opportunities')}>View all fixes <ArrowRight size={15} /></Button>} />

    <section className="today-pulse" aria-label="Business pulse">
      <div className="today-pulse-intro"><span className="today-pulse-label"><i className="live-dot" /> Northstar Distribution · live signals</span><strong>Business pulse</strong><p>Revenue is healthy. Sales speed and cash collection are the clearest places to move next.</p><IntelligenceCore variant="today" compact /></div>
      <div className="today-pulse-stats">{metrics.slice(0, 4).map((metric, index) => <div className="pulse-signal" key={metric.label}><div className="pulse-signal-top"><span>{['Revenue', 'Cash position', 'Pipeline', 'Overdue invoices'][index] ?? metric.label}</span><span className={`pulse-trend ${metric.trend}`}>{metric.trend === 'down' ? <ArrowDownRight size={14} /> : metric.trend === 'up' ? <ArrowUpRight size={14} /> : <span>•</span>} {metric.change}</span></div><strong>{metric.value}</strong><PulseSparkline down={metric.trend === 'down'} /><small>{index === 0 ? 'vs. last month' : index === 1 ? 'current position' : index === 2 ? 'qualified pipeline' : 'needs follow-up'}</small></div>)}</div>
    </section>

    <section className="today-section">
      <SectionTitle title="What needs your attention" description="Start with the highest-impact issue. Each one leads to the evidence and the next practical step." action={<StatusPill tone="red">{attention.length} active</StatusPill>} />
      <div className="attention-issue-grid">{attention.map((item, index) => <article className={`attention-issue ${item.severity}`} key={item.title}>
        <div className="attention-issue-top"><span className="attention-issue-index">0{index + 1}</span><span className="attention-issue-status"><CircleAlert size={15} /> {['SALES', 'CASH', 'OPERATIONS'][index]}</span></div>
        <h2>{item.title}</h2><p>{item.detail}</p><div className="attention-issue-metric"><strong>{index === 0 ? '31% → 23%' : index === 1 ? '$42K' : '12 days'}</strong><span>{index === 0 ? 'conversion' : index === 1 ? 'waiting on response' : 'inventory cover'}</span></div>
        <div className="attention-issue-footer"><strong>{index === 0 ? '$82K potential upside' : index === 1 ? '$42K at risk' : '$31K exposure'}</strong><button className="text-button" onClick={() => navigate(index === 0 ? '/app/opportunities/root-cause' : '/app/opportunities')}>Investigate <ArrowRight size={14} /></button></div>
      </article>)}</div>
    </section>

    <div className="today-lower-grid">
      <section className="panel today-list-panel"><SectionTitle title="Needs you" description="Two decisions are ready for review." /><div className="today-list">{[
        ['Review the proposal workflow', 'Approve a draft-only fix for slower proposal turnaround.', '/app/opportunities/root-cause'],
        ['Follow up on overdue invoices', 'Choose a response plan for 11 customers.', '/app/opportunities'],
      ].map(([title, detail, path]) => <button className="today-list-row" key={title} onClick={() => navigate(path)}><span className="today-list-icon yellow"><Clock3 size={17} /></span><span><strong>{title}</strong><small>{detail}</small></span><ArrowRight size={16} /></button>)}</div></section>
      <section className="panel today-list-panel"><SectionTitle title="Gilar handled" description="Work completed since your last brief." /><div className="today-list">{['Reconciled revenue across connected systems', 'Grouped 12 source records into one customer view', 'Prepared a proposal draft for Acme Corp'].map((item) => <div className="today-list-row completed" key={item}><span className="today-list-icon green"><Check size={17} /></span><span><strong>{item}</strong><small>Completed with synthetic read-only data</small></span><StatusPill tone="green">Done</StatusPill></div>)}</div></section>
      <section className="panel today-list-panel today-watching-panel"><SectionTitle title="Watching" description="Signals that are quiet for now." /><div className="today-list">{[['Renewal coverage', 'No change in the next 30 days'], ['Cash collection', 'Stable against the current plan'], ['Customer response', 'Gilar will flag a new shift']].map(([title, detail]) => <div className="today-list-row" key={title}><span className="today-list-icon blue"><Zap size={17} /></span><span><strong>{title}</strong><small>{detail}</small></span><span className="watching-dot" /></div>)}</div></section>
    </div>

    <section className="today-watch panel"><div><span className="eyebrow">Signal coverage</span><h2>Gilar is watching 4 other signals.</h2><p>Nothing needs your attention right now. You’ll see a new item here when the evidence becomes actionable.</p></div><button className="text-button" onClick={() => navigate('/app/brief')}>Open daily brief <ArrowRight size={14} /></button></section>
  </div>
}

const fallbackFixes = [
  { title: 'Speed up proposal preparation', summary: 'Turn scattered proposal knowledge into a draft your team can review.', value: '$82K potential value', detail: 'Proposal turnaround grew from 2.1 to 4.3 days.', tag: 'Best first move' },
  { title: 'Follow up on overdue invoices', summary: 'Give the team a focused list of customers who need a response.', value: '$42K at risk', detail: '11 customers have not received a recent follow-up.', tag: 'Cash' },
  { title: 'Reduce manual order entry', summary: 'Remove repeated handoffs from the order workflow.', value: '$36K potential savings', detail: 'Operations spend too much time re-keying order details.', tag: 'Operations' },
]

export function FixesPage() {
  const navigate = useNavigate()
  const overview = useCustomerOverview()
  const fixes = overview?.opportunities.slice(0, 3).map((item, index) => ({
    title: index === 0 ? 'Speed up proposal preparation' : item.title,
    summary: index === 0 ? 'Turn scattered proposal knowledge into a draft your team can review.' : item.summary,
    value: `$${Math.round(item.estimatedAnnualValue).toLocaleString()} potential value`,
    detail: item.summary,
    tag: index === 0 ? 'Best first move' : item.category,
  })) ?? fallbackFixes
  const [showMore, setShowMore] = useState(false)

  return <div className="fixes-page">
    <PageHeader eyebrow="Fixes" title="What I would fix first." description="A short, ranked list of changes with the clearest upside. Start with one and see exactly why it matters." actions={<Button variant="secondary" onClick={() => navigate('/app/home')}>Back to today <ArrowRight size={15} /></Button>} />
    <section className="fixes-intro panel"><div><span className="eyebrow">A practical starting point</span><h2>Focus on the problem before the software.</h2><p>Gilar connects the signal to its evidence, shows the likely cause, and keeps you in control of every action.</p></div><div className="fixes-intro-stats"><span><strong>{overview?.opportunities.length ?? 5}</strong><small>possible fixes</small></span><span><strong>$184K</strong><small>directional value</small></span><span><strong>1</strong><small>recommended first</small></span></div></section>
    <section className="fixes-section"><SectionTitle title="Start here" description="The first fix has the strongest evidence chain and a draft-only action ready to review." /><div className="fixes-list">{fixes.map((fix, index) => <article className={`fix-row ${index === 0 ? 'featured' : ''}`} key={fix.title}><div className="fix-number">0{index + 1}</div><div className="fix-copy"><div className="fix-row-label"><span className="brief-tag blue">{fix.tag}</span>{index === 0 && <span className="fix-confidence"><Check size={13} /> Strong evidence</span>}</div><h2>{fix.title}</h2><p>{fix.summary}</p><small>{fix.detail}</small></div><div className="fix-visual"><div className={`fix-visual-bar ${index === 1 ? 'amber' : index === 2 ? 'green' : ''}`} style={{ '--fix-width': `${index === 0 ? 91 : index === 1 ? 67 : 54}%` } as React.CSSProperties} /><div className="fix-visual-meta"><span>{index === 0 ? '91%' : index === 1 ? '67%' : '54%'} evidence</span><span>{index === 0 ? 'Low' : index === 1 ? 'Medium' : 'Medium'} effort</span></div></div><div className="fix-value"><strong>{fix.value}</strong><span>directional estimate</span></div><button className="button button-primary" onClick={() => navigate(index === 0 ? '/app/opportunities/root-cause' : '/app/opportunities')}>{index === 0 ? 'Investigate' : 'View fix'} <ArrowRight size={15} /></button></article>)}</div></section>
    <button className="fixes-more" onClick={() => setShowMore(!showMore)}>{showMore ? 'Show fewer fixes' : 'See 5 more fixes'} <ArrowRight size={15} /></button>
    {showMore && <div className="fixes-secondary-grid">{['Make lead response faster', 'Clarify customer ownership', 'Improve inventory planning', 'Tighten renewal follow-up', 'Reduce reporting handoffs'].map((title, index) => <div className="fix-secondary panel" key={title}><span className="fix-secondary-icon"><TrendingUp size={16} /></span><div><strong>{title}</strong><p>{['Sales momentum', 'Customer experience', 'Operations', 'Customer retention', 'Team efficiency'][index]}</p></div><span className="muted">Review later</span></div>)}</div>}
    <section className="fixes-reassurance"><Check size={18} /><div><strong>You stay in control.</strong><p>Gilar can explain and recommend a fix. Nothing is deployed until you approve it.</p></div></section>
  </div>
}

export function ResultsPage() {
  const navigate = useNavigate()
  const overview = useCustomerOverview()
  const [methodologyOpen, setMethodologyOpen] = useState(false)
  const simulation = overview?.simulation
  const outcome = simulation?.outcome
  const roi = simulation?.roiRecord
  const completed = simulation?.status === 'completed'

  return <div className="results-page">
    <PageHeader eyebrow="Results" title="What changed." description="See the result of each approved fix in plain business terms. Estimates stay separate from measured outcomes." actions={<StatusPill tone={completed && !(!outcome && overview?.scenario === 'no_roi') ? 'green' : 'yellow'}>{completed && !(!outcome && overview?.scenario === 'no_roi') ? 'Measured' : overview?.scenario === 'no_roi' ? 'Attribution unavailable' : 'Waiting for a result'}</StatusPill>} />
    {overview?.scenario === 'no_roi' ? <section className="results-next results-no-outcome panel"><div><span className="eyebrow">Measurement complete</span><h2>No measurable ROI is available.</h2><p>The measurement window completed, but current data could not attribute a reliable business result.</p></div><StatusPill tone="yellow">Attribution unavailable</StatusPill></section> : !completed && <section className="results-next panel"><div><span className="eyebrow">Your next step</span><h2>Start with one fix, then come back to measure it.</h2><p>{simulation?.status === 'baseline' ? 'Choose a fix and approve the draft-only action. The 30-day simulation starts only after approval.' : 'The synthetic action is in progress. Advance the demo 30 days from the banner above to see the result.'}</p></div><Button onClick={() => navigate(simulation?.status === 'baseline' ? '/app/opportunities' : '/app/opportunities/deploy')}>{simulation?.status === 'baseline' ? 'See fixes' : 'View action'} <ArrowRight size={15} /></Button></section>}
    {completed && outcome ? <section className="results-hero panel"><div><span className="eyebrow">Measured outcome · 30 days</span><h2>Proposal preparation got faster.</h2><p>Teams moved from 4.1 hours per proposal to 58 minutes. Labor savings are measured; revenue impact remains an estimate.</p></div><div className="results-hero-stat"><strong>{outcome.timeSavedHours ?? 0}h</strong><span>hours saved</span></div><div className="results-hero-stat"><strong>${Math.round(outcome.costSaved ?? 0).toLocaleString()}</strong><span>labor savings</span></div><div className="results-hero-stat"><strong>{roi ? `${(roi.annualizedImpact / 8000).toFixed(1)}x` : '—'}</strong><span>directional ROI</span></div></section> : null}
    <section className="before-after-section"><SectionTitle title="The change at a glance" description="Measured workflow movement, with estimates clearly marked." /><div className="results-comparison-grid"><div className="result-stat before"><span>Proposal preparation</span><strong>4.1h</strong><small>before Gilar</small><div className="result-stat-line red" /></div><div className="result-stat after"><span>Proposal preparation</span><strong>{outcome ? '58m' : '—'}</strong><small>{outcome ? 'after Gilar' : 'after simulation'}</small><div className="result-stat-line green" /></div><div className="result-stat"><span>Lead response</span><strong>17h → 4.2h</strong><small>measured workflow target</small><div className="result-stat-line blue" /></div><div className="result-stat"><span>Sales conversion</span><strong>23% → 27%</strong><small>directional estimate</small><div className="result-stat-line blue" /></div></div><div className="results-outcome-strip"><span><strong>116 hrs</strong><small>time returned</small></span><span><strong>$4,870</strong><small>measured savings</small></span><span><strong>$37K</strong><small>estimated lift</small></span><span><strong>5.2x</strong><small>directional ROI</small></span></div></section>
    <section className="results-grid"><div className="panel result-list"><SectionTitle title="The result in context" description="What Gilar is confident about and what still needs validation." />{[
      [<TrendingDown size={17} />, 'Proposal turnaround', outcome ? 'Measured improvement from 4.1h to 58m.' : 'Currently the clearest constraint on sales speed.', outcome ? 'Measured' : 'Needs action'],
      [<Wallet size={17} />, 'Revenue impact', '$37,000 is an estimated lift based on the synthetic conversion change.', 'Estimated'],
      [<TrendingUp size={17} />, 'Confidence', `${Math.round((outcome?.confidence ?? 0.87) * 100)}% evidence-weighted confidence.`, 'Evidence-backed'],
    ].map(([icon, title, detail, label]) => <div className="result-list-row" key={title as string}><span className="result-list-icon">{icon}</span><span><strong>{title}</strong><small>{detail}</small></span><StatusPill tone={label === 'Measured' ? 'green' : label === 'Estimated' ? 'yellow' : 'blue'}>{label}</StatusPill></div>)}</div><div className="panel result-methodology"><SectionTitle title="How Gilar knows" description="Open the detail only when you want to inspect the method." />{overview?.scenario === 'no_roi' && <p className="results-methodology-empty">ROI methodology will appear once a measurable outcome exists.</p>}<button className="methodology-toggle" onClick={() => setMethodologyOpen(!methodologyOpen)}>{methodologyOpen ? 'Hide measurement details' : 'View measurement details'} <ArrowRight size={15} /></button>{methodologyOpen && <div className="methodology-detail"><p>Gilar compares the same workflow before and after an approved synthetic intervention. It keeps observed measurements, estimated value, and assumptions separate.</p><div><span><strong>Observed</strong> 4.1h → 58m</span><span><strong>Estimated</strong> $37K revenue lift</span><span><strong>Window</strong> {simulation?.targetDays ?? 30} days</span></div></div>}</div></section>
    <section className="results-timeline panel"><SectionTitle title="From signal to result" description="A transparent sequence from the original issue through measurement." /><div className="results-timeline-track">{[['01', 'Before', 'Proposal work averaged 4.1 hours.'], ['02', 'Gilar action', 'Approved draft-only automation prepared the work.'], ['03', 'Measurement', 'The synthetic window tracked the same workflow for 30 days.'], ['04', 'Result', outcome ? 'Time fell to 58 minutes per proposal.' : 'Advance the simulation to record the result.']].map(([number, title, detail], index) => <div className="results-timeline-step" key={title}><span>{number}</span><i className={index === 3 && outcome ? 'complete' : ''} /><strong>{title}</strong><small>{detail}</small></div>)}</div><p className="results-disclosure">Methodology: observed workflow metrics are measured; revenue and ROI remain directional estimates based on the synthetic Northstar history.</p></section>
  </div>
}
