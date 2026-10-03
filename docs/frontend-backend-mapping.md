# GreenWatch AI — Frontend to Backend Mapping Specification

This document maps every store function, page action, and UI component from the React 19 frontend to its corresponding REST API endpoint.

---

## 1. Store Functions Mapping (`src/data/store.js`)

| Store Function | Method | REST API Endpoint | Request Payload | Response Data | Purpose & UI Location |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `useReports()` | `GET` | `/api/reports?limit=100` | None | `{ data: Report[], total: number }` | Replaces in-memory array. Hydrates `Dashboard.jsx`, `Charts.jsx`, `ReportDetail.jsx`. |
| `useRole()` / `setRole(role)` | Client State / LocalStorage | *(Client-side state or `/api/auth/me`)* | None | `{ role: "citizen" \| "official" }` | In demo mode, persisted in local client state. In production mode, controlled via JWT token (`/api/auth/login`). |
| `getReportById(id)` | `GET` | `/api/reports/{id}` | None | `{ data: Report }` | Retrieves report details in `ReportDetail.jsx` by database identifier. |
| `getReportByRef(ref)` | `GET` | `/api/reports/{ref}` | None | `{ data: Report }` | Resolves public tracking queries in `TrackReport.jsx` via `GW-XXXX`. |
| `addReport(report)` | `POST` | `/api/reports` | `CreateReportRequest`: `{ description, location: { address, area, lat, lng }, photos }` | `CreateReportResponse`: `{ data: Report, steps: AgentStep[] }` | Called in `ReportIssue.jsx`. Triggers the 7-stage AI agent pipeline on the backend. |
| `patchReport(id, patch, entry)` | `PATCH` | `/api/reports/{id}` | `UpdateReportRequest`: `{ status?, priority?, department?, assignee?, dueDate?, activityEntry? }` | `{ data: Report }` | Used in `ReportDetail.jsx` for status changes, official assignment, SLA due date edits, and notes. |
| `appendActivity(id, entry)` | `POST` | `/api/reports/{id}/activity` | `AddActivityRequest`: `{ kind: "agent"\|"human", who: string, text: string }` | `{ data: Report }` | Appends notes and external inspection audit records. |
| `nextRef()` | Server-side generator | Handled in `POST /api/reports` | Generated via database sequence or max ID | Returns next formatted `GW-XXXX` | Eliminated from client; guaranteed atomic and collision-free on server. |
| `nextWorkOrder()` | Server-side generator | Handled in `POST /api/reports` | Generated via database sequence or max ID | Returns next formatted `WO-XXXX` | Eliminated from client; dispatched automatically by Work Order Agent. |
| `newId()` | Server-side generator | Handled in `POST /api/reports` | CUID / UUID generation in Prisma | Returns unique ID | Eliminated from client. |

---

## 2. Page & Component Action Mapping

### 1. `ReportIssue.jsx`
| Action in UI | Replaced By | Endpoint | Notes |
| :--- | :--- | :--- | :--- |
| `submit(e)` | `POST /api/reports` | `POST /api/reports` | Passes citizen description, address, area, lat/lng, and photos. Returns server-executed pipeline results and animated steps. |
| `classifyIssue()` | Backend AI Pipeline | `POST /api/reports` (or `POST /api/reports/analyze` for live preview) | Heuristic/LLM triage moved to backend. Output strictly validated via Zod. |
| `buildAgentSteps()` | Backend Telemetry | `steps` array in `POST /api/reports` response | Stepper telemetry is generated server-side to guarantee consistency with actual executed agents. |
| `PhotoUploader.jsx` | File Upload Endpoint | `POST /api/reports/upload-photo` | Handles binary image upload (JPG/PNG, up to 10MB) and returns persistent static URL. |

### 2. `TrackReport.jsx`
| Action in UI | Replaced By | Endpoint | Notes |
| :--- | :--- | :--- | :--- |
| `search(e)` | Reference Lookup | `GET /api/reports/{ref}` | Looks up ticket by reference `GW-XXXX`. Returns 404 with standard envelope if not found. |
| Display Timeline | Status Progression | Derived from `report.status` | Uses `StatusTimeline.jsx` with real-time status from server. |
| Display Activity | Audit Trail | `report.activity` array | Chronological activity log from `GET /api/reports/{ref}`. |

### 3. `Dashboard.jsx`
| Action in UI | Replaced By | Endpoint | Notes |
| :--- | :--- | :--- | :--- |
| Table Data & Pagination | Filtered Reports List | `GET /api/reports?status={}&category={}&priority={}&department={}&q={}&page={}&limit={}` | Backend executes filtering and pagination. Returns `{ data, total, page, limit, totalPages }`. |
| Needs Attention Card | Filtered Query | `GET /api/reports?status=In%20Progress&priority=High` | Or calculated from open reports where `isOverdue` is true. |
| Stat Cards (New, In Progress, Overdue, Resolved Today) | KPI Endpoint | `GET /api/analytics/kpis` (or `/api/analytics`) | Returns aggregated counts `{ fresh, active, overdue, resolvedToday }`. |
| Reports Over Time (`TrendChart`) | Analytics Trends | `GET /api/analytics/trends` | Returns 14-day history array: `[{ day, filed, resolved }]`. |
| Category Breakdown (`CategoryChart`) | Category Metrics | `GET /api/analytics/categories` | Returns count per category: `{ garbage, tree, water, plants, park, blocked }`. |
| Department SLA Rates (`DeptRateChart`) | Department Metrics | `GET /api/analytics/departments` | Returns SLA compliance percentages: `[{ name, rate }]`. |

### 4. `ReportDetail.jsx`
| Action in UI | Replaced By | Endpoint | Notes |
| :--- | :--- | :--- | :--- |
| Page Initial Load | Report Retrieval | `GET /api/reports/{id}` | Fetches full report with nested photos, AI metadata, activity, and work order. |
| `changeStatus(value)` | Status Transition | `PATCH /api/reports/{id}/status` or `PATCH /api/reports/{id}` | Validates allowed state transitions. Automatically records `resolvedAt` and triggers Follow-up Agent if `Resolved`. |
| `addNote()` | Add Activity Note | `POST /api/reports/{id}/activity` | Appends `{ kind: "human", who: "Official Name", text: note }`. |
| Reassign Official (`WorkOrderCard.jsx`) | Work Order Update | `PATCH /api/reports/{id}/work-order` | Updates `assignee`. If status was `New` or `Verified`, auto-promotes to `Assigned`. |
| Change Due Date (`WorkOrderCard.jsx`) | Work Order SLA Edit | `PATCH /api/reports/{id}/work-order` | Updates `dueDate` and appends human activity note. |
| Follow-up Evaluation (`FollowupCard.jsx`) | Follow-up Agent Evaluation | `POST /api/reports/{id}/follow-up` | Evaluates overdue state (>48h silence) and prompts for citizen confirmation. |
| Officials Dropdown | Staff Directory | `GET /officials` | Populates assignment dropdown grouped by department. |

---

## 3. Data Gaps Identified & Proposed Resolutions

| # | Identified Gap in Frontend | Impact | Proposed Backend Resolution |
| :--- | :--- | :--- | :--- |
| **1** | **Client-side ID Generation (`nextRef`, `nextWorkOrder`, `newId`)** | High concurrency risk; if two citizens submit at the same time, ID collision occurs. | Move sequence generation to the database (`GW-XXXX` and `WO-XXXX` generated atomically in `POST /api/reports`). |
| **2** | **Client-side AI Pipeline Heuristics (`classifyIssue`)** | Untrusted client execution; business rules and LLM credentials would leak into browser bundle. | Move all 7 agents (`Triage`, `Evidence`, `Duplicate`, `Priority`, `Routing`, `WorkOrder`, `Follow-up`) into `/server/src/agents/`. Client simply receives the verified result. |
| **3** | **Unauthenticated Status Modification** | Any citizen could toggle role to "Official" in the navbar and resolve or delete tickets. | Implement JWT Bearer token authentication for official endpoints (`PATCH /api/reports/{id}`, `POST /api/reports/{id}/activity`). Citizen endpoints (`POST /api/reports`, `GET /api/reports/{ref}`) remain public. |
| **4** | **Blob URL Photo Storage** | `URL.createObjectURL(file)` is temporary and destroyed upon browser refresh. | Provide `POST /api/reports/upload-photo` for persisting image uploads to disk/cloud storage with stable URLs. |
| **5** | **Pagination & Scaling** | In-memory store loads all 1284 historical records into client memory. | Implement server-side pagination (`page`, `limit`) on `GET /api/reports` with indexed query filters on `category`, `status`, `priority`, and `department`. |
