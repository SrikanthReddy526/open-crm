import { api } from './client'
import type {
  ConvertResult,
  DashboardSummary,
  Deal,
  DealInput,
  DealStage,
  Lead,
  LeadInput,
  LeadStatus,
  Page,
  Reminder,
  ReminderDue,
  ReminderInput,
  ReminderStatus,
  StageSummary,
  SyncMutation,
  SyncPullResponse,
  SyncResult,
  Ticket,
  TicketComment,
  TicketHistoryEntry,
  TicketInput,
  TicketPriority,
  TicketStats,
  TicketStatus,
  Visit,
  VisitInput,
} from './types'

const data = <T,>(r: { data: T }) => r.data

/** Drops undefined/empty values so the URL stays clean (?status=&q= → nothing). */
function clean(params: Record<string, unknown>) {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)) continue
    out[k] = Array.isArray(v) ? v.join(',') : v
  }
  return out
}

// ---------------------------------------------------------------- visits

export interface VisitListParams {
  customerId?: string
  userId?: string
  from?: string
  to?: string
  page?: number
  size?: number
}

export const visitsApi = {
  list: (p: VisitListParams) => api.get<Page<Visit>>('/api/visits', { params: clean({ ...p }) }).then(data),
  create: (input: VisitInput) => api.post<Visit>('/api/visits', input).then(data),
  update: (id: string, input: VisitInput) => api.put<Visit>(`/api/visits/${id}`, input).then(data),
  remove: (id: string) => api.delete(`/api/visits/${id}`),
}

// ---------------------------------------------------------------- leads

export interface LeadListParams {
  q?: string
  status?: LeadStatus
  includeConverted?: boolean
  page?: number
  size?: number
}

export const leadsApi = {
  list: (p: LeadListParams) => api.get<Page<Lead>>('/api/leads', { params: clean({ ...p }) }).then(data),
  get: (id: string) => api.get<Lead>(`/api/leads/${id}`).then(data),
  create: (input: LeadInput) => api.post<Lead>('/api/leads', input).then(data),
  update: (id: string, input: LeadInput) => api.put<Lead>(`/api/leads/${id}`, input).then(data),
  setStatus: (id: string, status: LeadStatus) => api.patch<Lead>(`/api/leads/${id}/status`, { status }).then(data),
  convert: (id: string, body: { createDeal: boolean; dealTitle?: string; amount?: number }) =>
    api.post<ConvertResult>(`/api/leads/${id}/convert`, body).then(data),
  remove: (id: string) => api.delete(`/api/leads/${id}`),
}

// ---------------------------------------------------------------- deals

export interface DealListParams {
  q?: string
  stage?: DealStage
  customerId?: string
  page?: number
  size?: number
  sort?: string
}

export const dealsApi = {
  list: (p: DealListParams) => api.get<Page<Deal>>('/api/deals', { params: clean({ ...p }) }).then(data),
  get: (id: string) => api.get<Deal>(`/api/deals/${id}`).then(data),
  create: (input: DealInput) => api.post<Deal>('/api/deals', input).then(data),
  update: (id: string, input: DealInput) => api.put<Deal>(`/api/deals/${id}`, input).then(data),
  setStage: (id: string, stage: DealStage) => api.patch<Deal>(`/api/deals/${id}/stage`, { stage }).then(data),
  pipeline: () => api.get<StageSummary[]>('/api/deals/pipeline').then(data),
  remove: (id: string) => api.delete(`/api/deals/${id}`),
}

// ---------------------------------------------------------------- reminders

export interface ReminderListParams {
  status?: ReminderStatus | 'ALL'
  due?: ReminderDue
  everyone?: boolean
  customerId?: string
  leadId?: string
  dealId?: string
  page?: number
  size?: number
}

export const remindersApi = {
  list: (p: ReminderListParams) =>
    api.get<Page<Reminder>>('/api/reminders', { params: clean({ ...p }) }).then(data),
  create: (input: ReminderInput) => api.post<Reminder>('/api/reminders', input).then(data),
  update: (id: string, input: ReminderInput) => api.put<Reminder>(`/api/reminders/${id}`, input).then(data),
  complete: (id: string) => api.patch<Reminder>(`/api/reminders/${id}/complete`).then(data),
  snooze: (id: string, until: string) => api.patch<Reminder>(`/api/reminders/${id}/snooze`, { until }).then(data),
  remove: (id: string) => api.delete(`/api/reminders/${id}`),
}

// ---------------------------------------------------------------- tickets

export interface TicketListParams {
  q?: string
  status?: TicketStatus[]
  priority?: TicketPriority[]
  assignedTo?: string
  unassigned?: boolean
  customerId?: string
  page?: number
  size?: number
}

export const ticketsApi = {
  list: (p: TicketListParams) => api.get<Page<Ticket>>('/api/tickets', { params: clean({ ...p }) }).then(data),
  get: (id: string) => api.get<Ticket>(`/api/tickets/${id}`).then(data),
  create: (input: TicketInput) => api.post<Ticket>('/api/tickets', input).then(data),
  update: (id: string, input: TicketInput) => api.put<Ticket>(`/api/tickets/${id}`, input).then(data),
  setStatus: (id: string, status: TicketStatus) =>
    api.patch<Ticket>(`/api/tickets/${id}/status`, { status }).then(data),
  assign: (id: string, userId: string | null) =>
    api.patch<Ticket>(`/api/tickets/${id}/assign`, { userId }).then(data),
  comments: (id: string) => api.get<TicketComment[]>(`/api/tickets/${id}/comments`).then(data),
  addComment: (id: string, body: string, internal: boolean) =>
    api.post<TicketComment>(`/api/tickets/${id}/comments`, { body, internal }).then(data),
  history: (id: string) => api.get<TicketHistoryEntry[]>(`/api/tickets/${id}/history`).then(data),
  stats: () => api.get<TicketStats>('/api/tickets/stats').then(data),
  remove: (id: string) => api.delete(`/api/tickets/${id}`),
}

// ---------------------------------------------------------------- AI agent assistant

export interface AiStatus {
  enabled: boolean
  provider: string | null
}
export interface AiText {
  text: string
  provider: string
}
/** Local models on a CPU can take a minute or two, so these calls wait longer than the default 30 s. */
const AI_TIMEOUT = 200_000

export const aiApi = {
  status: () => api.get<AiStatus>('/api/ai/status').then(data),
  summary: (ticketId: string) =>
    api.post<AiText>(`/api/tickets/${ticketId}/ai/summary`, null, { timeout: AI_TIMEOUT }).then(data),
  reply: (ticketId: string, language: 'en' | 'te', instructions: string) =>
    api
      .post<AiText>(`/api/tickets/${ticketId}/ai/reply`, { language, instructions: instructions.trim() || null }, { timeout: AI_TIMEOUT })
      .then(data),
}

// ---------------------------------------------------------------- dashboard & sync

export const dashboardApi = {
  summary: () => api.get<DashboardSummary>('/api/dashboard/summary').then(data),
}

export const syncApi = {
  pull: (since: string | null) =>
    api.get<SyncPullResponse>('/api/sync/pull', { params: since ? { since } : {} }).then(data),
  push: (mutations: SyncMutation[]) =>
    api.post<{ results: SyncResult[] }>('/api/sync/push', { mutations }).then((r) => r.data.results),
}
