export type Role = 'ADMIN' | 'SUPPORT_AGENT' | 'FIELD_STAFF'
export type Language = 'en' | 'te'

export interface User {
  id: string
  email: string
  fullName: string
  phone: string | null
  role: Role
  preferredLanguage: Language
  active: boolean
}

export interface AuthResponse {
  accessToken: string
  refreshToken: string
  expiresIn: number
  user: User
}

export interface UserLookup {
  id: string
  fullName: string
  role: Role
}

export interface Page<T> {
  content: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
  /** true when the data came from this device's saved copy (no connection) */
  offline?: boolean
}

export interface Customer {
  id: string
  name: string
  company: string | null
  email: string | null
  phone: string | null
  addressLine: string | null
  city: string | null
  state: string | null
  postalCode: string | null
  country: string | null
  latitude: number | null
  longitude: number | null
  notes: string | null
  ownerId: string | null
  createdAt: string
  updatedAt: string
  version: number
}

/** Body for create/update. `id` lets the client choose the id (offline creates); `version` detects conflicts. */
export interface CustomerInput {
  id?: string
  name: string
  company?: string | null
  email?: string | null
  phone?: string | null
  addressLine?: string | null
  city?: string | null
  state?: string | null
  postalCode?: string | null
  country?: string | null
  latitude?: number | null
  longitude?: number | null
  notes?: string | null
  ownerId?: string | null
  version?: number
}

export interface NearbyCustomer {
  customer: Customer
  distanceMeters: number
}

export interface CsvImportResult {
  imported: number
  failed: number
  errors: { row: number; message: string }[]
}

// ---------------------------------------------------------------- sessions & users

export interface Session {
  id: string
  userId: string
  userName: string
  userEmail: string
  deviceName: string
  startedAt: string
  lastActiveAt: string
  expiresAt: string
  current: boolean
}

export interface UserInput {
  email: string
  password?: string
  fullName: string
  phone?: string | null
  role: Role
  preferredLanguage?: Language
}

// ---------------------------------------------------------------- visits

export type VisitOutcome = 'MET' | 'NOT_AVAILABLE' | 'RESCHEDULED' | 'ORDER_TAKEN' | 'ISSUE_REPORTED'
export const VISIT_OUTCOMES: VisitOutcome[] = ['MET', 'NOT_AVAILABLE', 'RESCHEDULED', 'ORDER_TAKEN', 'ISSUE_REPORTED']

export interface Visit {
  id: string
  customerId: string
  customerName: string | null
  userId: string
  userName: string | null
  visitedAt: string
  latitude: number | null
  longitude: number | null
  outcome: VisitOutcome | null
  notes: string | null
  createdAt: string
  updatedAt: string
  version: number
  /** Only on records saved on this device and not yet sent to the server. */
  pending?: boolean
}

export interface VisitInput {
  id?: string
  customerId: string
  visitedAt: string
  latitude?: number | null
  longitude?: number | null
  outcome?: VisitOutcome | null
  notes?: string | null
  version?: number
}

// ---------------------------------------------------------------- leads

export type LeadStatus = 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'UNQUALIFIED' | 'CONVERTED'
export type LeadSource = 'WEBSITE' | 'REFERRAL' | 'WALK_IN' | 'PHONE' | 'CAMPAIGN' | 'OTHER'
export const LEAD_STATUSES: LeadStatus[] = ['NEW', 'CONTACTED', 'QUALIFIED', 'UNQUALIFIED', 'CONVERTED']
export const LEAD_SOURCES: LeadSource[] = ['WEBSITE', 'REFERRAL', 'WALK_IN', 'PHONE', 'CAMPAIGN', 'OTHER']

export interface Lead {
  id: string
  name: string
  company: string | null
  email: string | null
  phone: string | null
  source: LeadSource | null
  status: LeadStatus
  convertedCustomerId: string | null
  ownerId: string | null
  ownerName: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
  version: number
}

export interface LeadInput {
  id?: string
  name: string
  company?: string | null
  email?: string | null
  phone?: string | null
  source?: LeadSource | null
  status?: LeadStatus
  ownerId?: string | null
  notes?: string | null
  version?: number
}

export interface ConvertResult {
  lead: Lead
  customerId: string
  dealId: string | null
}

// ---------------------------------------------------------------- deals

export type DealStage = 'PROSPECTING' | 'PROPOSAL' | 'NEGOTIATION' | 'WON' | 'LOST'
export const DEAL_STAGES: DealStage[] = ['PROSPECTING', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST']

export interface Deal {
  id: string
  customerId: string
  customerName: string | null
  title: string
  amount: number
  currency: string
  stage: DealStage
  expectedCloseDate: string | null
  closedAt: string | null
  ownerId: string | null
  ownerName: string | null
  createdAt: string
  updatedAt: string
  version: number
}

export interface DealInput {
  id?: string
  customerId: string
  title: string
  amount: number
  currency?: string
  stage?: DealStage
  expectedCloseDate?: string | null
  ownerId?: string | null
  version?: number
}

export interface StageSummary {
  stage: DealStage
  count: number
  totalAmount: number
}

// ---------------------------------------------------------------- reminders

export type ReminderStatus = 'PENDING' | 'DONE' | 'CANCELLED'
export type ReminderDue = 'ALL' | 'OVERDUE' | 'TODAY' | 'WEEK' | 'UPCOMING'

export interface Reminder {
  id: string
  title: string
  description: string | null
  dueAt: string
  status: ReminderStatus
  assignedTo: string
  assignedToName: string | null
  customerId: string | null
  customerName: string | null
  leadId: string | null
  dealId: string | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
  version: number
  pending?: boolean
}

export interface ReminderInput {
  id?: string
  title: string
  description?: string | null
  dueAt: string
  status?: ReminderStatus
  assignedTo?: string | null
  customerId?: string | null
  leadId?: string | null
  dealId?: string | null
  version?: number
}

// ---------------------------------------------------------------- tickets

export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'ON_HOLD' | 'RESOLVED' | 'CLOSED'
export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
export const TICKET_STATUSES: TicketStatus[] = ['OPEN', 'IN_PROGRESS', 'ON_HOLD', 'RESOLVED', 'CLOSED']
export const OPEN_TICKET_STATUSES: TicketStatus[] = ['OPEN', 'IN_PROGRESS', 'ON_HOLD']
export const TICKET_PRIORITIES: TicketPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT']

export interface Ticket {
  id: string
  ticketNumber: number
  customerId: string
  customerName: string | null
  subject: string
  description: string | null
  status: TicketStatus
  priority: TicketPriority
  assignedTo: string | null
  assignedToName: string | null
  createdBy: string | null
  createdByName: string | null
  resolvedAt: string | null
  createdAt: string
  updatedAt: string
  version: number
}

export interface TicketInput {
  id?: string
  customerId: string
  subject: string
  description?: string | null
  priority?: TicketPriority
  assignedTo?: string | null
  version?: number
}

export interface TicketComment {
  id: string
  authorId: string | null
  authorName: string | null
  body: string
  internal: boolean
  createdAt: string
}

export interface TicketHistoryEntry {
  fromStatus: TicketStatus | null
  toStatus: TicketStatus
  changedBy: string | null
  changedByName: string | null
  changedAt: string
}

export interface TicketStats {
  byStatus: Record<TicketStatus, number>
  openByPriority: Record<TicketPriority, number>
  open: number
  urgentOpen: number
  assignedToMeOpen: number
}

// ---------------------------------------------------------------- dashboard & sync

export interface DashboardSummary {
  customers: number
  openTickets: number
  urgentTickets: number
  myOpenTickets: number
  ticketsByStatus: Record<TicketStatus, number>
  remindersToday: number
  remindersOverdue: number
  pipelineValue: number
  pipelineCount: number
  pipeline: StageSummary[]
  wonThisMonth: number
  wonThisMonthCount: number
  newLeadsThisWeek: number
  visitsToday: number
}

export type SyncEntity = 'customer' | 'visit' | 'reminder'
export type SyncOp = 'CREATE' | 'UPDATE' | 'DELETE'

export interface SyncMutation {
  mutationId: string
  entity: SyncEntity
  op: SyncOp
  id: string
  baseVersion?: number | null
  data?: Record<string, unknown>
}

export interface SyncPullResponse {
  serverTime: string
  full: boolean
  customers: Customer[]
  visits: Visit[]
  reminders: Reminder[]
  deleted: { customers: string[]; visits: string[]; reminders: string[] }
}

export interface SyncResult {
  mutationId: string
  status: 'APPLIED' | 'DUPLICATE' | 'CONFLICT' | 'REJECTED'
  message: string | null
  data: unknown
}
