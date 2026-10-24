import { useMemo, useState } from 'react'
import type { Opportunity } from '../../shared/domain/models'
import type { MetricViewDTO } from '../../shared/contracts/metrics'
import type { BusinessHealthScoreDTO } from '../../shared/contracts/dto'
import type { SyntheticOverview } from '../services/syntheticService'
import { formatMetric, formatMetricDelta, formatNumber, normalizedPoints, trendTone } from '../services/metricPresentation'

function Sparkline({ metric }: { metric: MetricViewDTO }) {
  const points = normalizedPoints(metric.series)
  const path = points.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ')
  const tone = trendTone(metric)
  return <svg className={`ed-sparkline ${tone}`} viewBox="0 0 100 36" preserveAspectRatio="none" role="img" aria-label={`${metric.label} trend`}>
    <path className="ed-sparkline-area" d={`${path} L 100 36 L 0 36 Z`} />
    {points.length > 1 && <path className="ed-sparkline-line" d={path} />}
  </svg>
}

export function EditorialMetricStrip({ metrics }: { metrics: MetricViewDTO[] }) {
  if (!metrics.length) return <div className="ed-empty">Business pulse is waiting for connected data.</div>
  return <section className="ed-metric-strip" aria-label="Business pulse">
    <div className="ed-metric-intro"><span className="ed-kicker"><i className="ed-live-dot" /> Current workspace</span><h2>Business pulse</h2><p>Live metrics from the current comparison period.</p></div>
    <div className="ed-metric-items">{metrics.map((metric) => <article className="ed-metric" key={metric.key}>
      <div className="ed-metric-heading"><span>{metric.label}</span><span className={`ed-delta ${trendTone(metric)}`}>{metric.direction === 'up' ? '↗' : metric.direction === 'down' ? '↘' : '→'} {formatMetricDelta(metric)}</span></div>
      <strong>{formatMetric(metric)}</strong>
      <span className="ed-metric-meta">{metric.period} · {metric.evidenceState}</span>
      <Sparkline metric={metric} />
    </article>)}</div>
  </section>
}

export function ImpactEffortDiagram({ opportunities, onSelect }: { opportunities: Opportunity[]; onSelect: (opportunity: Opportunity) => void }) {
  const visible = opportunities.slice(0, 8)
  const maxValue = Math.max(...visible.map((item) => item.estimatedAnnualValue), 1)
  const maxEffort = Math.max(...visible.map((item) => item.implementationDifficulty), 4)
  if (!visible.length) return <div className="ed-empty">No opportunities are available for comparison.</div>
  return <div className="ed-quadrant" aria-label="Impact and effort comparison">
    <div className="ed-quadrant-heading"><div><span className="ed-kicker">Decision map</span><h3>Impact × effort</h3></div><span>Click an opportunity to open its evidence</span></div>
    <div className="ed-quadrant-plot"><span className="ed-quadrant-y-label">Potential value</span><span className="ed-quadrant-x-label">Implementation effort</span><span className="ed-quadrant-label top-left">Quick wins</span><span className="ed-quadrant-label top-right">Strategic bets</span><span className="ed-quadrant-label bottom-left">Low lift</span><span className="ed-quadrant-label bottom-right">Defer</span>
      {visible.map((item, index) => { const left = Math.min(88, Math.max(8, item.implementationDifficulty / maxEffort * 100)); const bottom = Math.min(88, Math.max(10, item.estimatedAnnualValue / maxValue * 78 + 7)); return <button className={`ed-opportunity-dot ${index === 0 ? 'featured' : ''}`} key={item.id} style={{ left: `${left}%`, bottom: `${bottom}%` }} onClick={() => onSelect(item)} aria-label={`${item.title}, ${formatNumber(item.estimatedAnnualValue, 'currency')} potential value`}><span>{String(index + 1).padStart(2, '0')}</span><b>{item.title}</b></button> })}
    </div>
  </div>
}

export function CausalDiagram({ signal, evidence, cause, impact }: { signal: string; evidence: string; cause: string; impact: string }) {
  const nodes = [{ label: 'Signal', value: signal, state: 'observed' }, { label: 'Evidence', value: evidence, state: 'observed' }, { label: 'Likely cause', value: cause, state: 'inferred' }, { label: 'Business impact', value: impact, state: 'estimated' }]
  return <section className="ed-causal" aria-label="Causal evidence path"><div className="ed-diagram-heading"><div><span className="ed-kicker">Evidence path</span><h3>How the signal connects.</h3></div><span>Observed facts remain separate from inference.</span></div><div className="ed-causal-flow">{nodes.map((node, index) => <div className="ed-causal-node" key={node.label}><span className={`ed-state ${node.state}`}>{node.state}</span><small>{node.label}</small><strong>{node.value}</strong>{index < nodes.length - 1 && <i className="ed-arrow" aria-hidden="true">→</i>}</div>)}</div></section>
}

export function ProcessDiagram({ steps }: { steps: Array<{ label: string; detail: string; state?: 'complete' | 'current' | 'next' }> }) {
  return <div className="ed-process" aria-label="Fix process">{steps.map((step, index) => <div className={`ed-process-step ${step.state ?? 'next'}`} key={step.label}><span className="ed-process-index">{String(index + 1).padStart(2, '0')}</span><div><strong>{step.label}</strong><p>{step.detail}</p></div>{index < steps.length - 1 && <i className="ed-process-arrow" aria-hidden="true">→</i>}</div>)}</div>
}

function polarPoint(index: number, total: number, radius: number, center = 50) {
  const angle = -Math.PI / 2 + (index / total) * Math.PI * 2
  return { x: center + Math.cos(angle) * radius, y: center + Math.sin(angle) * radius }
}

export function BusinessHealthDiagram({ health }: { health: BusinessHealthScoreDTO }) {
  const dimensions = health.dimensions.slice(0, 5)
  const [active, setActive] = useState(0)
  const confidence = Math.round((health.coverage ?? []).reduce((sum, item) => sum + item.confidence, 0) / Math.max(1, (health.coverage ?? []).length) * 100)
  const points = dimensions.map((dimension, index) => { const point = polarPoint(index, dimensions.length, Math.max(9, dimension.score / 100 * 35)); return `${point.x},${point.y}` }).join(' ')
  const activeDimension = dimensions[active] ?? dimensions[0]
  if (!dimensions.length) return <div className="ed-empty">Business health is waiting for enough evidence.</div>
  return <section className="ed-health" aria-label="Business health map"><div className="ed-diagram-heading"><div><span className="ed-kicker">Terrain map</span><h3>Business health</h3></div><span>{health.overallScore} / 100 · grade {health.grade}</span></div><div className="ed-health-layout"><svg className="ed-radar" viewBox="0 0 100 100" role="img" aria-label="Business health radar">
    {[35, 26, 17, 8].map((radius) => <polygon key={radius} points={dimensions.map((_, index) => { const point = polarPoint(index, dimensions.length, radius); return `${point.x},${point.y}` }).join(' ')} />)}
    {dimensions.map((dimension, index) => { const outer = polarPoint(index, dimensions.length, 35); const point = polarPoint(index, dimensions.length, Math.max(9, dimension.score / 100 * 35)); return <g key={dimension.key}><line x1="50" y1="50" x2={outer.x} y2={outer.y} /><circle className={index === active ? 'active' : ''} cx={point.x} cy={point.y} r={index === active ? 2.8 : 2} tabIndex={0} role="button" aria-label={`${dimension.label}: ${dimension.score}`} onClick={() => setActive(index)} onFocus={() => setActive(index)} /></g> })}
    <polygon className="ed-radar-value" points={points} />
  </svg><div className="ed-health-readout"><span className="ed-score">{activeDimension?.score}</span><span className="ed-health-confidence"><strong>{confidence}%</strong> <small>evidence confidence</small></span><strong>{activeDimension?.label}</strong><p>{activeDimension?.score >= 70 ? 'A stable signal with healthy supporting evidence.' : 'A signal worth reviewing before it becomes a constraint.'}</p><div className="ed-health-legend">{dimensions.map((dimension, index) => <button className={index === active ? 'active' : ''} key={dimension.key} onClick={() => setActive(index)}><i />{dimension.label}<b>{dimension.score}</b></button>)}</div></div></div></section>
}

export function IntegrationMap({ sources }: { sources: SyntheticOverview['sources'] }) {
  const connected = sources.filter((source) => source.status === 'connected')
  const visible = connected.slice(0, 5)
  return <section className="ed-integration-map" aria-label="Business graph"><div className="ed-diagram-heading"><div><span className="ed-kicker">Business graph</span><h3>Connected tools → Gilar → decisions</h3></div><span>{connected.length} sources connected</span></div><div className="ed-flow-map"><div className="ed-flow-column"><small>Sources</small>{visible.map((source) => <div className="ed-flow-node" key={source.provider}><i className="ed-source-mark" /><span><strong>{source.displayName}</strong><small>{source.recordCount.toLocaleString()} records</small></span></div>)}</div><div className="ed-flow-core"><span className="ed-core-mark">G</span><strong>Business Graph</strong><small>Signals, evidence, outcomes</small></div><div className="ed-flow-column"><small>Consumers</small>{['Today', 'Fixes', 'Results'].map((name) => <div className="ed-flow-node" key={name}><i className="ed-consumer-mark" /><span><strong>{name}</strong><small>decision surface</small></span></div>)}</div></div></section>
}

export function BeforeAfterBand({ items }: { items: Array<{ label: string; before?: string; after?: string; delta?: string; state: 'measured' | 'estimated' | 'projected' }> }) {
  return <div className="ed-before-after" aria-label="Before and after results">{items.map((item) => <div className="ed-result-metric" key={item.label}><span className="ed-state-label">{item.state}</span><strong>{item.before ?? '—'} <i>→</i> {item.after ?? '—'}</strong><small>{item.label}</small>{item.delta && <b>{item.delta}</b>}</div>)}</div>
}

export function EditorialSignalMap() {
  return <div className="ed-signal-map" aria-label="Gilar signal map"><div className="ed-signal-caption"><span className="ed-kicker">Business signal map</span><strong>From signal to next move.</strong><p>Gilar brings scattered operating evidence into one decision path.</p></div><svg viewBox="0 0 520 300" role="img" aria-label="Signals converge into a decision path"><path className="ed-signal-route" d="M30 78 C150 78 156 210 270 210 S360 56 492 56 M30 208 C130 208 160 112 270 112 S380 210 492 210" /><circle className="ed-signal-node risk" cx="30" cy="78" r="8" /><circle className="ed-signal-node source" cx="30" cy="208" r="8" /><circle className="ed-signal-node focus" cx="270" cy="112" r="10" /><circle className="ed-signal-node outcome" cx="492" cy="56" r="8" /><circle className="ed-signal-node outcome" cx="492" cy="210" r="8" /></svg><div className="ed-signal-label label-a"><b>01</b>Sales signal</div><div className="ed-signal-label label-b"><b>02</b>Connected evidence</div><div className="ed-signal-label label-c"><b>03</b>Decision path</div><div className="ed-signal-label label-d"><b>04</b>Measured result</div></div>
}
