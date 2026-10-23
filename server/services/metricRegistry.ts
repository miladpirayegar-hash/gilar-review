import type { BusinessMetric, MetricObservation } from '../../shared/domain/models'
import type { MetricDirection, MetricEvidenceState, MetricRegistryDTO, MetricSeriesPoint, MetricViewDTO } from '../../shared/contracts/metrics'

export interface MetricRegistryInput {
  metrics: BusinessMetric[]
  observations: MetricObservation[]
  asOf: string
  keyAliases?: Record<string, string>
  sourceSystems?: Record<string, string[]>
  series?: Record<string, MetricSeriesPoint[]>
  metadata?: Record<string, Partial<Pick<MetricViewDTO, 'calculationMethod' | 'confidence' | 'coverage' | 'freshness' | 'evidenceState' | 'availability' | 'period'>>>
}

function direction(current?: number, previous?: number): MetricDirection {
  if (current === undefined || previous === undefined || current === previous) return 'flat'
  return current > previous ? 'up' : 'down'
}

function percentageChange(current?: number, previous?: number): number | undefined {
  if (current === undefined || previous === undefined || previous === 0) return undefined
  return Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10
}

function defaultSeries(current?: number, previous?: number, asOf?: string): MetricSeriesPoint[] {
  if (current === undefined && previous === undefined) return []
  const end = asOf ?? new Date().toISOString()
  const endDate = new Date(end)
  const start = new Date(endDate.getTime() - 30 * 86_400_000).toISOString()
  return [
    ...(previous === undefined ? [] : [{ timestamp: start, value: previous, label: 'Previous' }]),
    ...(current === undefined ? [] : [{ timestamp: end, value: current, label: 'Current' }]),
  ]
}

export function buildMetricRegistry(input: MetricRegistryInput): MetricRegistryDTO {
  const metrics = input.metrics.map((metric) => {
    const rows = input.observations.filter((observation) => observation.metricId === metric.id).sort((left, right) => left.periodEnd.localeCompare(right.periodEnd))
    const previous = rows.length > 1 ? rows.at(-2)?.value : undefined
    const current = rows.at(-1)?.value
    const overrides = input.metadata?.[metric.key] ?? {}
    const view: MetricViewDTO = {
      key: input.keyAliases?.[metric.key] ?? metric.key,
      label: metric.name,
      unit: metric.unit,
      currentValue: current,
      previousValue: previous,
      direction: direction(current, previous),
      percentageChange: percentageChange(current, previous),
      period: overrides.period ?? 'Current comparison period',
      sourceSystems: input.sourceSystems?.[metric.key] ?? [],
      calculationMethod: overrides.calculationMethod ?? 'Current observation compared with the immediately preceding observation.',
      confidence: overrides.confidence ?? (rows.length ? .85 : 0),
      coverage: overrides.coverage ?? (rows.length ? 1 : 0),
      timestamp: rows.at(-1)?.observedAt ?? input.asOf,
      freshness: overrides.freshness ?? 'Current workspace snapshot',
      evidenceState: overrides.evidenceState ?? 'observed',
      availability: overrides.availability ?? (rows.length > 1 ? 'available' : rows.length === 1 ? 'partial' : 'insufficient'),
      series: input.series?.[metric.key] ?? (rows.length ? rows.map((row) => ({ timestamp: row.periodEnd, value: row.value })) : defaultSeries(current, previous, input.asOf)),
    }
    return view
  })
  return { asOf: input.asOf, metrics }
}

export function metricValue(registry: MetricRegistryDTO | undefined, key: string): MetricViewDTO | undefined {
  return registry?.metrics.find((metric) => metric.key === key)
}

export function formatMetricValue(metric: MetricViewDTO | undefined, missing = 'Not enough data yet'): string {
  if (!metric || metric.currentValue === undefined || metric.availability === 'insufficient') return missing
  const value = metric.currentValue
  if (metric.unit === 'currency') return `$${Math.round(value).toLocaleString()}`
  if (metric.unit === 'percentage') return `${(value * 100).toFixed(value < 1 ? 0 : 1)}%`
  if (metric.unit === 'hours') return `${value.toFixed(value % 1 ? 1 : 0)}h`
  if (metric.unit === 'minutes') return `${Math.round(value)} min`
  if (metric.unit === 'days') return `${value.toFixed(value % 1 ? 1 : 0)} days`
  return value.toLocaleString()
}

export function formatMetricChange(metric: MetricViewDTO | undefined, missing = 'No comparison'): string {
  if (!metric || metric.percentageChange === undefined) return missing
  const sign = metric.percentageChange > 0 ? '+' : ''
  return `${sign}${metric.percentageChange.toFixed(1)}%`
}

export function metricEvidenceStateLabel(state: MetricEvidenceState): string {
  return state[0].toUpperCase() + state.slice(1)
}
