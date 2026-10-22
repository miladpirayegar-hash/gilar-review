import type { ISODate } from '../../../shared/domain/models'

export type QuickBooksJson = Record<string, unknown>

export interface QuickBooksQueryResponse {
  QueryResponse?: Record<string, unknown>
  time?: string
}

export interface QuickBooksReportResponse extends QuickBooksJson {
  Header?: QuickBooksJson
  Columns?: QuickBooksJson
  Rows?: QuickBooksJson
}

export interface QuickBooksSyncPayload {
  company?: QuickBooksJson
  records: QuickBooksJson[]
  recordsByType: Record<string, number>
  financialReports: Record<string, QuickBooksReportResponse>
  synchronizedAt: ISODate
}

export const quickBooksEntityTypes = ['Customer', 'Vendor', 'Account', 'Invoice', 'Payment', 'Bill', 'Purchase', 'Item'] as const
export type QuickBooksEntityType = typeof quickBooksEntityTypes[number]
