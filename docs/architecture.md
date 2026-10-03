# GreenWatch AI — System Architecture Specification

## 1. Architectural Philosophy
GreenWatch AI is an AI-coordinated civic engagement and municipal operations platform operating under the principle **"AI suggested · human approved"**.
- Citizens can report environmental hazards without accounts and track issues using human-readable reference IDs (`GW-XXXX`).
- AI agents run an autonomous pipeline to classify, assess evidence, identify duplicates, evaluate hazard risk, route to municipal departments, and generate work orders.
- City officials maintain final authority over work orders, crew dispatch, SLA adjustments, and resolution sign-offs.

---

## 2. Entity-Relationship Diagram (ERD)

```mermaid
erDiagram
    USER ||--o{ REPORT : "is assigned to"
    USER ||--o{ WORK_ORDER : "works on"
    DEPARTMENT ||--o{ USER : "employs"
    DEPARTMENT ||--o{ REPORT : "handles"
    DEPARTMENT ||--o{ WORK_ORDER : "manages"

    REPORT ||--|| LOCATION : "occurs at"
    REPORT ||--o{ PHOTO : "contains evidence"
    REPORT ||--|| AI_METADATA : "analyzed by"
    REPORT ||--o{ ACTIVITY : "audited by"
    REPORT ||--o| WORK_ORDER : "dispatches"

    USER {
        string id PK "cuid"
        string email UK "Official email"
        string passwordHash "bcrypt hash"
        string name "Full name (e.g. M. Alvarez)"
        string role "OFFICIAL | ADMIN"
        string department FK "Nullable for Admin"
        datetime createdAt
        datetime updatedAt
    }

    DEPARTMENT {
        string id PK
        string name UK "Sanitation, Parks & Forestry, etc."
        string code "SAN, PKF, WAT, PUB"
    }

    REPORT {
        string id PK "r{timestamp} or cuid"
        string ref UK "GW-XXXX reference"
        string category "garbage | tree | water | plants | park | blocked"
        string description "Citizen narrative"
        string priority "High | Medium | Low"
        string status "New | Verified | Assigned | In Progress | Resolved"
        string department FK
        string assignee "Display name of assigned official"
        string assignedUserId FK "Nullable"
        string workOrderRef UK "WO-XXXX"
        datetime dueDate "SLA deadline"
        datetime resolvedAt "Nullable"
        datetime createdAt
        datetime updatedAt
    }

    LOCATION {
        string id PK
        string reportId FK
        string address "Street address or landmark"
        string area "Neighborhood / district"
        float lat "Nullable GPS latitude"
        float lng "Nullable GPS longitude"
    }

    PHOTO {
        string id PK
        string reportId FK
        string url "Static asset or upload URL"
        datetime createdAt
    }

    AI_METADATA {
        string id PK
        string reportId FK
        string severity "High | Medium | Low"
        string reason "Explanation of hazard risk"
        string evidence "Good | Needs more info"
        int confidence "0 - 100 percentage"
        int similarCount "Number of duplicates nearby"
        json similarIds "Array of linked report IDs"
        datetime createdAt
    }

    ACTIVITY {
        string id PK
        string reportId FK
        string kind "agent | human"
        string who "Agent name or official name"
        string text "Action description or note"
        datetime createdAt
    }

    WORK_ORDER {
        string id PK
        string ref UK "WO-XXXX"
        string reportId FK
        string department FK
        string status "Pending | Dispatched | In Progress | Completed"
        string assignedTo "Official name"
        string assignedUserId FK "Nullable"
        datetime dueDate "Calculated SLA"
        datetime completedAt "Nullable"
        datetime createdAt
        datetime updatedAt
    }
```

---

## 3. Server Folder Structure (`/server`)

```text
/server
├── .env.example              # Template environment variables (committed)
├── .env                      # Local environment secrets (gitignored)
├── .gitignore                # Git exclusions
├── docker-compose.yml        # PostgreSQL 16 local container infrastructure
├── package.json              # Server dependencies and lifecycle scripts
├── vitest.config.js          # Vitest unit & integration test configuration
├── prisma/
│   ├── schema.prisma         # Database schema (PostgreSQL provider)
│   └── seed.js               # Database seeder (12 municipal reports & accounts)
├── src/
│   ├── app.js                # Express application setup, middlewares, routes
│   ├── server.js             # HTTP listener and graceful shutdown
│   ├── config.js             # Validated environment configuration
│   ├── agents/               # Modular AI Agent Pipeline
│   │   ├── triageAgent.js    # Triage Agent (category & confidence)
│   │   ├── evidenceAgent.js  # Evidence Agent (photos & detail quality)
│   │   ├── duplicateAgent.js # Duplicate Detection (spatial & category scan)
│   │   ├── priorityAgent.js  # Priority Agent (hazard risk & SLA days)
│   │   ├── routingAgent.js   # Department Routing (municipal jurisdiction)
│   │   ├── workOrderAgent.js # Work Order Dispatcher (WO-XXXX & due date)
│   │   ├── followUpAgent.js  # Follow-up Agent (overdue escalation & confirmation)
│   │   └── pipeline.js       # Orchestrator coordinating all 7 stages
│   ├── db/
│   │   ├── client.js         # Unified Prisma database access + resilient fallback
│   │   └── seedData.js       # Canonical seed records matching frontend mock data
│   ├── lib/
│   │   └── errors.js         # AppError classes (BadRequest, NotFound, etc.)
│   ├── middleware/
│   │   ├── auth.js           # JWT verification & role-based access control
│   │   ├── errorHandler.js   # Unified { error: { code, message, details } } handler
│   │   └── validate.js       # Zod schema validation middleware
│   ├── routes/
│   │   ├── auth.js           # /api/auth endpoints (login, register, me)
│   │   ├── reports.js        # /api/reports endpoints (CRUD, tracking, notes)
│   │   ├── analytics.js      # /api/analytics endpoints (KPIs, trends, rates)
│   │   └── health.js         # /api/health endpoint
│   ├── schemas/
│   │   ├── authSchema.js     # Zod input schemas for authentication
│   │   └── reportSchema.js   # Zod input schemas for report submissions & queries
│   └── services/
│       ├── authService.js    # JWT generation, bcrypt verification
│       ├── reportService.js  # Pipeline execution, report queries & updates
│       └── analyticsService.js# Metric aggregation & SLA calculations
└── tests/
    ├── setup.js              # Test database reset before each test
    ├── agents.test.js        # Unit tests for all 7 agents and fallback paths
    ├── auth.test.js          # Authentication & JWT test cases
    ├── reports.test.js       # Report lifecycle, validation, and filter tests
    └── analytics.test.js     # Analytics, KPI, and health check tests
```

---

## 4. Status State Machine & Allowed Transitions

```mermaid
stateDiagram-v2
    [*] --> New: Citizen submits report
    New --> Verified: Evidence verified / initial review
    New --> Assigned: Assigned to department official
    Verified --> Assigned: Work order assigned to crew
    Assigned --> In_Progress: Crew begins work on site
    In_Progress --> Resolved: Crew completes work / Official approves
    Assigned --> Resolved: Immediate resolution (minor/duplicate)

    state In_Progress {
        [*] --> Working
        Working --> Escalated: Overdue >48h without update (Follow-up Agent)
        Escalated --> Working: Official updates note
    }

    Resolved --> In_Progress: Citizen re-reports within 24h
    Resolved --> [*]: Loop closed after 24h
```

### Transition Guard Rules:
1. **Citizen Submission**: Always enters state `Assigned` (when AI pipeline identifies category & department) or `New` (if manual triage required).
2. **Assigning an Official**: If report is `New` or `Verified`, assigning an official automatically transitions status to `Assigned`.
3. **Work Execution**: Official marks status `In Progress` when field crew is dispatched or on site.
4. **Resolution**: Marking status `Resolved` records `resolvedAt` timestamp and automatically triggers the **Follow-up Agent** to notify the citizen for confirmation.
5. **Reopening**: If citizen disputes resolution within 24 hours, official can return ticket to `In Progress`. After 24h of silence, the loop is permanently closed.

---

## 5. Agent Pipeline Sequence Diagram

```mermaid
sequenceDiagram
    autonumber
    actor Citizen
    participant API as Express API (/api/reports)
    participant Triage as 1. Triage Agent
    participant Evidence as 2. Evidence Agent
    participant Duplicate as 3. Duplicate Detection Agent
    participant Priority as 4. Priority Agent
    participant Routing as 5. Department Routing Agent
    participant WorkOrder as 6. Work Order Agent
    participant DB as Database (Postgres)
    actor Official
    participant FollowUp as 7. Follow-up Agent

    Citizen->>API: POST /api/reports (description, location, photos)
    activate API
    API->>Triage: Classify text & photo cues
    Triage-->>API: category, confidence, label
    API->>Evidence: Assess photo count & description depth
    Evidence-->>API: evidence ("Good" | "Needs more info")
    API->>Duplicate: Scan open reports in area & category
    Duplicate-->>API: similarCount, similarIds, isDuplicate
    API->>Priority: Assess public hazard (schools, water, health)
    Priority-->>API: priority ("High"|"Medium"|"Low"), SLA days, reason
    API->>Routing: Map category to municipal jurisdiction
    Routing-->>API: department, rationale
    API->>WorkOrder: Generate WO-XXXX & SLA dueDate
    WorkOrder-->>API: workOrderRef, dueDate
    API->>DB: Save Report, AI Metadata, Work Order, Activity Logs
    DB-->>API: Persisted Report (GW-XXXX)
    API-->>Citizen: 201 Created (report + animated steps)
    deactivate API

    opt Official Review & Execution
        Official->>API: PATCH /api/reports/GW-XXXX (assignee, status: "In Progress")
        API->>DB: Update status & append human activity log
        Official->>API: PATCH /api/reports/GW-XXXX (status: "Resolved")
        API->>DB: Set resolvedAt & log resolution
        API->>FollowUp: Trigger resolution notification
        FollowUp->>DB: Log "Citizen notified and asked to confirm the fix"
    end

    opt SLA Monitoring Check
        API->>FollowUp: Check overdue reports (now > dueDate)
        alt Overdue >48h without update
            FollowUp->>DB: Log "Escalated: reminder sent to crew supervisor"
        else Overdue <48h
            FollowUp->>DB: Log "Update requested from department team"
        end
    end
```
