import type { BusinessHealthScoreDTO, DashboardDTO, OpportunityDTO } from './dto'

export interface ApiError { code: string; message: string; requestId?: string }
export interface ApiResponse<T> { data: T; error?: never }
export interface ApiFailure { data?: never; error: ApiError }
export type ApiResult<T> = ApiResponse<T> | ApiFailure

export interface DashboardResponse extends ApiResponse<DashboardDTO> {}
export interface BusinessHealthResponse extends ApiResponse<BusinessHealthScoreDTO> {}
export interface OpportunitiesResponse extends ApiResponse<OpportunityDTO[]> {}
