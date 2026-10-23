import type { MetricRegistryDTO, MetricSeriesPoint, MetricViewDTO } from '../../shared/contracts/metrics'

export function metricByKey(registry: MetricRegistryDTO | undefined, key: string): MetricViewDTO | undefined {
  return registry?.metrics.find((metric) => metric.key === key)
}

export function formatMetric(metric: MetricViewDTO | undefined, missing = 'Not enough data yet'): string {
  if (!metric || metric.currentValue === undefined || metric.availability === 'insufficient') return missing
  const value = metric.currentValue
  if (metric.unit === 'currency') return `$${Math.round(value).toLocaleString()}`
  if (metric.unit === 'percentage') return `${(value * 100).toFixed(value < 1 ? 0 : 1)}%`
  if (metric.unit === 'duration' || metric.unit === 'hours') return `${value.toFixed(value % 1 ? 1 : 0)}h`
  if (metric.unit === 'minutes') return `${Math.round(value)}m`
  if (metric.unit === 'days') return `${value.toFixed(value % 1 ? 1 : 0)} days`
  return value.toLocaleString()
}

export function formatMetricDelta(metric: MetricViewDTO | undefined, missing = 'No comparison'): string {
  if (!metric || metric.percentageChange === undefined) return missing
  const sign = metric.percentageChange > 0 ? '+' : ''
  return `${sign}${metric.percentageChange.toFixed(1)}%`
}

export function formatNumber(value: number | undefined, unit: MetricViewDTO['unit'] = 'number'): string {
  if (value === undefined || !Number.isFinite(value)) return '—'
  if (unit === 'currency') return `$${Math.round(value).toLocaleString()}`
  if (unit === 'percentage') return `${(value * 100).toFixed(0)}%`
  if (unit === 'duration' || unit === 'hours') return `${value.toFixed(value % 1 ? 1 : 0)}h`
  if (unit === 'minutes') return `${Math.round(value)}m`
  if (unit === 'days') return `${value.toFixed(value % 1 ? 1 : 0)} days`
  return value.toLocaleString()
}

export function normalizedPoints(series: MetricSeriesPoint[]): Array<MetricSeriesPoint & { x: number; y: number }> {
  if (!series.length) return []
  const values = series.map((point) => point.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const spread = max - min || 1
  return series.map((point, index) => ({ ...point, x: series.length === 1 ? 50 : (index / (series.length - 1)) * 100, y: 100 - ((point.value - min) / spread) * 86 - 7 }))
}

export function trendTone(metric?: MetricViewDTO): 'positive' | 'negative' | 'neutral' {
  if (!metric || metric.direction === 'flat') return 'neutral'
  const inverse = ['overdue_receivables', 'lead_response_time', 'software_spend', 'inventory_days_remaining'].includes(metric.key)
  return metric.direction === (inverse ? 'down' : 'up') ? 'positive' : 'negative'
}
