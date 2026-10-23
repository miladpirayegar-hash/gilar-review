import { useState } from 'react'
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
  const [activeIndex, setActiveIndex] = useState(0)
  if (!metric || !points.length) return <div className="viz-empty chart-empty">{metric?.availability === 'partial' ? 'More history is needed to show this trend.' : 'Connect a source to calculate this trend.'}</div>
  const selectedIndex = Math.min(activeIndex, points.length - 1)
  const path = points.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ')
  const activePoint = points[selectedIndex]
  const activeSeriesPoint = metric.series[selectedIndex]
  const activeLabel = activeSeriesPoint?.label ?? new Date(activeSeriesPoint?.timestamp ?? '').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  const chartId = `chart-${metric.key.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`
  const firstValue = metric.series[0]?.value ?? activePoint.value
  const latestValue = metric.currentValue ?? metric.series[metric.series.length - 1]?.value ?? activePoint.value
  const deltaPercent = metric.percentageChange ?? (firstValue ? ((latestValue - firstValue) / Math.abs(firstValue)) * 100 : 0)
  const trendLabel = deltaPercent > 0 ? 'Up from the start of the period' : deltaPercent < 0 ? 'Down from the start of the period' : 'Holding steady across the period'
  const selectPoint = (index: number) => setActiveIndex(Math.max(0, Math.min(points.length - 1, index)))
  const movePoint = (index: number, direction: number) => (event: React.KeyboardEvent<SVGCircleElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    selectPoint(index + (event.key === 'ArrowRight' ? direction : -direction))
  }
  return <div className="time-series-chart" style={{ minHeight: height }}><div className="chart-y-axis"><span>{formatNumber(Math.max(...metric.series.map((point) => point.value)), metric.unit)}</span><span>{formatNumber(Math.min(...metric.series.map((point) => point.value)), metric.unit)}</span></div><div className="chart-plot"><div className="chart-stat-strip"><span className="chart-stat-current">{formatNumber(latestValue, metric.unit)}</span><span className={`chart-stat-delta ${deltaPercent >= 0 ? 'positive' : 'negative'}`}>{deltaPercent >= 0 ? '↗' : '↘'} {Math.abs(deltaPercent).toFixed(1)}%</span><span className="chart-stat-copy">{trendLabel}</span></div><span className="chart-interaction-hint">Select a point to inspect</span><svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={`${metric.label} time series`}><defs><linearGradient id={`${chartId}-area`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3477e5" stopOpacity=".34" /><stop offset="65%" stopColor="#3477e5" stopOpacity=".12" /><stop offset="100%" stopColor="#3477e5" stopOpacity="0" /></linearGradient><linearGradient id={`${chartId}-line`} x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#3477e5" /><stop offset="100%" stopColor="#16a269" /></linearGradient></defs><g className="chart-grid-lines" aria-hidden="true"><line x1="0" x2="100" y1="20" y2="20" /><line x1="0" x2="100" y1="50" y2="50" /><line x1="0" x2="100" y1="80" y2="80" /></g><path className="chart-area" d={`${path} L 100 100 L 0 100 Z`} style={{ fill: `url(#${chartId}-area)` }} /><path className="chart-line" d={path} style={{ stroke: `url(#${chartId}-line)` }} /><line className="chart-active-guide" x1={activePoint.x} x2={activePoint.x} y1="0" y2="100" /><g className="chart-points">{points.map((point, index) => <circle className={index === selectedIndex ? 'is-active' : ''} key={`${point.timestamp}-${point.value}`} cx={point.x} cy={point.y} r={index === selectedIndex ? '2.4' : '1.6'} tabIndex={0} role="button" aria-label={`${metric.label}, ${metric.series[index]?.label ?? point.label ?? new Date(point.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}: ${formatNumber(metric.series[index]?.value ?? point.value, metric.unit)}`} onMouseEnter={() => selectPoint(index)} onFocus={() => selectPoint(index)} onKeyDown={movePoint(index, 1)} onClick={() => selectPoint(index)} />)}</g></svg><div className="chart-tooltip" style={{ left: `${activePoint.x}%`, top: `${Math.max(5, activePoint.y - 22)}%` }}><strong>{formatNumber(activeSeriesPoint?.value ?? activePoint.value, metric.unit)}</strong><span>{activeLabel}</span></div></div><div className="chart-x-axis">{metric.series.map((point) => <span key={point.timestamp}>{point.label ?? new Date(point.timestamp).toLocaleDateString(undefined, { month: 'short' })}</span>)}</div></div>
}

export function BeforeAfterChart({ label, before, after, unit = 'number', beforeLabel = 'Before', afterLabel = 'After' }: { label: string; before?: number; after?: number; unit?: MetricViewDTO['unit']; beforeLabel?: string; afterLabel?: string }) {
  if (before === undefined || after === undefined) return <div className="before-after-chart before-after-empty" aria-label={`${label} measurement pending`}><div className="before-after-heading"><strong>{label}</strong><span>Measurement pending</span></div><p>Complete the controlled window to compare the observed result.</p></div>
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
