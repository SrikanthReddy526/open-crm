# Open CRM — REST API

Base path: `/api`. All endpoints except those marked **public** need `Authorization: Bearer <accessToken>`.
Send `Accept-Language: en` or `te` to get error messages in English or Telugu.

All endpoints below are built and covered by the end-to-end API checks.

## Conventions

| Topic | Rule |
|---|---|
| IDs | UUID strings. Clients may supply `id` on create (offline-created records); repeating a create with the same `id` returns the existing record |
| Paging | `?page=0&size=20&sort=field,asc` → `{ content, page, size, totalElements, totalPages }` (max size 100) |
| Conflicts | Updates send the `version` they last saw; a stale version → `409` |
| Deletes | Soft delete (row kept with `deleted_at`, so devices can sync the deletion) |
| Errors | `{ status, code, message, fieldErrors: { field: message }, timestamp }` — `message` is translated |
| Roles | `ADMIN`, `SUPPORT_AGENT`, `FIELD_STAFF`. Field staff only see records assigned to them (customers/leads/deals they own, their visits and reminders, tickets they raised or are assigned) |
| Times | ISO-8601 UTC (`2026-11-07T09:30:00Z`). "Today", "this month" use `APP_TIMEZONE` (default Asia/Kolkata) |
| Money | `amount` as a number, `currency` defaults to `INR` |

## Health
| Method | Path | Who |
|---|---|---|
| GET | `/api/health` | public |

## Auth, profile & sessions
| Method | Path | Body / notes | Who |
|---|---|---|---|
| POST | `/api/auth/login` | `{ email, password, deviceName }` → `{ accessToken, refreshToken, expiresIn, user }` | public |
| POST | `/api/auth/refresh` | `{ refreshToken }` → new pair (old refresh token revoked) | public |
| POST | `/api/auth/logout` | `{ refreshToken }` — this device only | public |
| GET | `/api/auth/me` | current user | any |
| PATCH | `/api/auth/me` | `{ fullName, phone, preferredLanguage }` | any |
| POST | `/api/auth/me/password` | `{ currentPassword, newPassword }` — logs out the user's other devices | any |
| GET | `/api/auth/sessions` | my logged-in devices (`current: true` = this one) | any |
| DELETE | `/api/auth/sessions/{id}` | log out one of my devices | any |

Access tokens last 15 minutes, so a logged-out device loses access within 15 minutes.

## Users (admin)
| Method | Path | Notes | Who |
|---|---|---|---|
| GET | `/api/users` | all users | ADMIN |
| GET | `/api/users/{id}` | | ADMIN |
| POST | `/api/users` | `{ email, password, fullName, phone, role, preferredLanguage }` | ADMIN |
| PUT | `/api/users/{id}` | `{ email, fullName, phone, role, preferredLanguage }` (cannot remove own admin role) | ADMIN |
| PATCH | `/api/users/{id}/active` | `{ active }` — deactivating logs the user out everywhere (cannot deactivate self) | ADMIN |
| POST | `/api/users/{id}/reset-password` | `{ newPassword }` — logs the user out everywhere | ADMIN |
| GET | `/api/users/lookup` | `[{ id, fullName, role }]` of active users, for dropdowns | any |
| GET | `/api/users/sessions?userId=` | active devices of everyone (or one user) | ADMIN |
| DELETE | `/api/users/sessions/{sessionId}` | log out any device | ADMIN |
| DELETE | `/api/users/{id}/sessions` | log out all devices of a user | ADMIN |

## Customers
| Method | Path | Notes | Who |
|---|---|---|---|
| GET | `/api/customers?q=&page=&size=&sort=` | search name/company/phone/email/city; sort `name`, `city`, `createdAt`, `updatedAt` | any |
| GET | `/api/customers/{id}` | | any |
| POST | `/api/customers` | `CustomerRequest` | any |
| PUT | `/api/customers/{id}` | include `version` | any (field staff cannot reassign) |
| DELETE | `/api/customers/{id}` | | ADMIN |
| GET | `/api/customers/nearby?lat=&lng=&radiusKm=5&limit=50` | `[{ customer, distanceMeters }]`, nearest first | any |
| GET | `/api/customers/in-area?south=&west=&north=&east=&limit=500` | customers inside the visible map rectangle | any |
| GET | `/api/customers/export?q=` | CSV (UTF-8 with BOM) | ADMIN, SUPPORT_AGENT |
| GET | `/api/customers/import/template` | sample CSV | any |
| POST | `/api/customers/import` | multipart `file` → `{ imported, failed, errors: [{ row, message }] }` | ADMIN |

`CustomerRequest`: `{ id?, name*, company, email, phone, addressLine, city, state, postalCode, country, latitude, longitude, notes, ownerId, version }`

## Field visits
| Method | Path | Notes |
|---|---|---|
| GET | `/api/visits?customerId=&userId=&from=&to=&page=&size=` | newest first; field staff: own only |
| GET | `/api/visits/{id}` | |
| POST | `/api/visits` | `{ id, customerId*, visitedAt*, latitude, longitude, outcome, notes }` — `visitedAt` is the device time (max 10 min in the future) |
| PUT | `/api/visits/{id}` | include `version`; only the author or an admin |
| DELETE | `/api/visits/{id}` | only the author or an admin |

`outcome`: `MET`, `NOT_AVAILABLE`, `RESCHEDULED`, `ORDER_TAKEN`, `ISSUE_REPORTED`

## Leads
| Method | Path | Notes |
|---|---|---|
| GET | `/api/leads?q=&status=&includeConverted=false&ownerId=&page=&size=&sort=` | without `status`: all except CONVERTED |
| GET / PUT / DELETE | `/api/leads/{id}` | |
| POST | `/api/leads` | `{ id?, name*, company, email, phone, source, status, ownerId, notes }` |
| PATCH | `/api/leads/{id}/status` | `{ status }` — NEW, CONTACTED, QUALIFIED, UNQUALIFIED (CONVERTED only via convert) |
| POST | `/api/leads/{id}/convert` | `{ createDeal?, dealTitle?, amount? }` → `{ lead, customerId, dealId }`; second convert → 409 |

`source`: `WEBSITE`, `REFERRAL`, `WALK_IN`, `PHONE`, `CAMPAIGN`, `OTHER`

## Deals
| Method | Path | Notes |
|---|---|---|
| GET | `/api/deals?q=&stage=&customerId=&ownerId=&page=&size=&sort=` | sort `title`, `amount`, `expectedCloseDate`, `createdAt`, `updatedAt` |
| GET / PUT / DELETE | `/api/deals/{id}` | |
| POST | `/api/deals` | `{ id?, customerId*, title*, amount*, currency, stage, expectedCloseDate, ownerId }` |
| PATCH | `/api/deals/{id}/stage` | `{ stage }` — sets `closedAt` on WON/LOST, clears it when reopened |
| GET | `/api/deals/pipeline` | `[{ stage, count, totalAmount }]` for all 5 stages |

`stage`: `PROSPECTING`, `PROPOSAL`, `NEGOTIATION`, `WON`, `LOST`

## Follow-up reminders
| Method | Path | Notes |
|---|---|---|
| GET | `/api/reminders?status=PENDING&due=ALL&everyone=false&assignedTo=&customerId=&leadId=&dealId=` | `status`: PENDING, DONE, CANCELLED or ALL; `due`: ALL, OVERDUE, TODAY, WEEK, UPCOMING; soonest first. Defaults to my reminders; `everyone=true` (admin/support) shows all |
| GET / PUT / DELETE | `/api/reminders/{id}` | |
| POST | `/api/reminders` | `{ id?, title*, description, dueAt*, status, assignedTo, customerId \| leadId \| dealId }` (at most one link) |
| PATCH | `/api/reminders/{id}/complete` | |
| PATCH | `/api/reminders/{id}/snooze` | `{ until }` (future time) |

## Support tickets
| Method | Path | Notes |
|---|---|---|
| GET | `/api/tickets?q=&status=OPEN,IN_PROGRESS&priority=&assignedTo=&unassigned=&customerId=&page=&size=&sort=` | `q` matches subject or `#1042` |
| GET | `/api/tickets/{id}` | |
| POST | `/api/tickets` | `{ id?, customerId*, subject*, description, priority, assignedTo }` |
| PUT | `/api/tickets/{id}` | subject/description/priority/customer — support or the creator |
| PATCH | `/api/tickets/{id}/status` | `{ status }` — support or the assignee; writes the history |
| PATCH | `/api/tickets/{id}/assign` | `{ userId \| null }` — ADMIN, SUPPORT_AGENT |
| DELETE | `/api/tickets/{id}` | ADMIN |
| GET / POST | `/api/tickets/{id}/comments` | `{ body, internal }` — internal notes are only visible to admin/support |
| GET | `/api/tickets/{id}/history` | status timeline |
| GET | `/api/tickets/stats` | `{ byStatus, openByPriority, open, urgentOpen, assignedToMeOpen }` |

## Offline sync
| Method | Path | Notes |
|---|---|---|
| GET | `/api/sync/pull?since=<serverTime>` | `{ serverTime, full, customers, visits, reminders, deleted: { customers, visits, reminders } }` — records this user keeps offline. No `since` = full download |
| POST | `/api/sync/push` | `{ mutations: [{ mutationId, entity: customer\|visit\|reminder, op: CREATE\|UPDATE\|DELETE, id, baseVersion, data }] }` (max 200) → `{ results: [{ mutationId, status: APPLIED\|DUPLICATE\|CONFLICT\|REJECTED, message, data }] }`. Each mutation is applied in its own transaction; `processed_mutations` makes re-sending safe; on CONFLICT `data` is the server copy |

## Dashboard
| Method | Path | Notes |
|---|---|---|
| GET | `/api/dashboard/summary` | customers, open/urgent/my tickets, reminders due today/overdue (mine), open pipeline value, won this month, new leads (7 days), visits today, pipeline per stage |
