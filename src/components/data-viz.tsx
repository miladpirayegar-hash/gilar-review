import type { MetricSeriesPoint, MetricViewDTO } from '../../shared/contracts/metrics'
import { formatMetric, formatMetricDelta, formatNumber, normalizedPoints, trendTone } from '../services/metricPresentation'

export function MiniSparkline({ series, tone = 'blue', label }: { series: MetricSeriesPoint[]; tone?: 'blue' | 'green' | 'red' | 'amber'; label?: string }) {
  const points = normalizedPoints(series)
  const path = points.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ')
  return <svg className={`viz-sparkline ${tone}`} viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={label ?? 'Metric trend'}>{points.length > 1 && <path d={path} fill="none" vectorEffect="non-scaling-stroke" />}</svg>
}

export function MetricTrend({ metric, compact = false }: { metric?: MetricViewDTO; compact?: boolean }) {
  if (!metric || metric.availability === 'insufficient' || metric.currentValue === undefined) return <div className="viz-empty">Not enough data yet</div>
  return <div className={`metric-trend ${compact ? 'compact' : ''}`}><div className="metric-trend-copy"><strong>{formatMetric(metric)}</strong><span className={`trend-value ${trendTone(metric)}`}>{metric.direction === 'up' ? '↑' : metric.direction === 'down' ? '↓' : '→'} {formatMetricDelta(metric)}</span><small>{metric.period} · {metric.evidenceState}</small></div><MiniSparkline series={metric.series} tone={trendTone(metric) === 'positive' ? 'green' : trendTone(metric) === 'negative' ? 'red' : 'blue'} label={`${metric.label} trend`} /></div>
}

export function TimeSeriesChart({ metric, height = 180 }: { metric?: MetricViewDTO; height?: number }) {
  const points = normalizedPoints(metric?.series ?? [])
  if (!metric || !points.length) return <div className="viz-empty chart-empty">{metric?.availability === 'partial' ? 'More history is needed to show this trend.' : 'Connect a source to calculate this trend.'}</div>
  const path = points.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ')
  return <div className="time-series-chart" style={{ minHeight: height }}><div className="chart-y-axis"><span>{formatNumber(Math.max(...metric.series.map((point) => point.value)), metric.unit)}</span><span>{formatNumber(Math.min(...metric.series.map((point) => point.value)), metric.unit)}</span></div><svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={`${metric.label} time series`}><path className="chart-area" d={`${path} L 100 100 L 0 100 Z`} /><path className="chart-line" d={path} /><g className="chart-points">{points.map((point) => <circle key={`${point.timestamp}-${point.value}`} cx={point.x} cy={point.y} r="1.6" />)}</g></svg><div className="chart-x-axis">{metric.series.map((point) => <span key={point.timestamp}>{point.label ?? new Date(point.timestamp).toLocaleDateString(undefined, { month: 'short' })}</span>)}</div></div>
}

export function BeforeAfterChart({ label, before, after, unit = 'number', beforeLabel = 'Before', afterLabel = 'After' }: { label: string; before?: number; after?: number; unit?: MetricViewDTO['unit']; beforeLabel?: string; afterLabel?: string }) {
  if (before === undefined || after === undefined) return <div className="viz-empty">Complete the measurement window to compare results.</div>
  const max = Math.max(Math.abs(before), Math.abs(after), 1)
  return <div className="before-after-chart" aria-label={`${label} before and after`}><div className="before-after-heading"><strong>{label}</strong><span>Observed workflow comparison</span></div><div className="before-after-bars"><div><span>{beforeLabel}</span><i className="before-bar" style={{ width: `${Math.max(8, Math.abs(before) / max * 100)}%` }} /><strong>{formatNumber(before, unit)}</strong></div><div><span>{afterLabel}</span><i className="after-bar" style={{ width: `${Math.max(8, Math.abs(after) / max * 100)}%` }} /><strong>{formatNumber(after, unit)}</strong></div></div></div>
}

export function RankedBarChart({ rows, valueLabel = 'Potential value' }: { rows: Array<{ id: string; label: string; value: number; confidence?: number }>; valueLabel?: string }) {
  if (!rows.length) return <div className="viz-empty">No ranked opportunities are available.</div>
  const max = Math.max(...rows.map((row) => row.value), 1)
  return <div className="ranked-bar-chart"><div className="chart-caption"><span>Ranked by evidence-weighted priority</span><small>{valueLabel}</small></div>{rows.map((row, index) => <div className="ranked-bar-row" key={row.id}><span className="ranked-bar-rank">{String(index + 1).padStart(2, '0')}</span><div><strong>{row.label}</strong><i><b style={{ width: `${Math.max(6, row.value / max * 100)}%` }} /></i></div><span className="ranked-bar-value">{formatNumber(row.value, 'currency')}</span>{row.confidence !== undefined && <small>{Math.round(row.confidence * 100)}% confidence</small>}</div>)}</div>
}

export function CausalFlow({ nodes }: { nodes: Array<{ label: string; value: string; status: 'observed' | 'inferred' | 'unknown'; detail?: string }> }) {
  if (!nodes.length) return <div className="viz-empty">Gilar needs more linked evidence to explain this issue.</div>
  return <div className="causal-flow" aria-label="Causal evidence flow">{nodes.map((node, index) => <div className="causal-flow-item" key={`${node.label}-${index}`}><span className={`causal-state ${node.status}`}>{node.status}</span><strong>{node.value}</strong><span>{node.label}</span>{node.detail && <small>{node.detail}</small>}{index < nodes.length - 1 && <i aria-hidden="true" />}</div>)}</div>
}

export function ActionStatusTimeline({ lifecycle, currentStatus }: { lifecycle: string[]; currentStatus: string }) {
  const stages = ['proposed', 'awaiting_approval', 'approved', 'running', 'completed']
  return <div className="action-status-timeline">{stages.map((stage, index) => { const activeIndex = stages.indexOf(currentStatus === 'queued' ? 'running' : currentStatus); const complete = lifecycle.includes(stage) && (activeIndex < 0 || index <= activeIndex); return <div className={`action-stage ${complete ? 'complete' : ''} ${stage === currentStatus ? 'current' : ''}`} key={stage}><span>{complete ? '✓' : index + 1}</span><strong>{stage.replace('_', ' ')}</strong>{index < stages.length - 1 && <i />}</div> })}</div>
}

export function SimpleDataTable({ columns, rows }: { columns: string[]; rows: Array<Array<string | number | React.ReactNode>> }) {
  if (!rows.length) return <div className="viz-empty">No records available.</div>
  return <div className="simple-data-table"><div className="simple-data-table-head">{columns.map((column) => <span key={column}>{column}</span>)}</div>{rows.map((row, index) => <div className="simple-data-table-row" key={index}>{row.map((cell, cellIndex) => <span key={cellIndex}>{cell}</span>)}</div>)}</div>
}
