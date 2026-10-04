# GreenWatch AI — Core API Specification & Contract

This document specifies the official HTTP REST API contract for the GreenWatch AI municipal operations platform, complying with the principle: **"AI suggested · human approved"**.

---

## 1. Authentication & Configuration

### Admin Authentication (Admin & Official Access)
Citizens do not have user accounts. System administrators and municipal officials authenticate via credentials defined in environment variables / database records. Successful login sets a signed, `httpOnly`, `SameSite` cookie (`admin_token`) and also returns a Bearer JWT token.

#### `POST /api/admin/login` (alias: `POST /api/auth/login`)
- **Access**: Public (Strict Rate Limited)
- **Request Body**:
  ```json
  {
    "email": "admin@greenwatch.gov",
    "password": "Password123!"
  }
  ```
- **Response `200 OK`**: Sets signed cookie `admin_token`
  ```json
  {
    "success": true,
    "token": "eyJhbGciOi...",
    "user": {
      "id": "u-admin",
      "email": "admin@greenwatch.gov",
      "name": "City Operations Admin",
      "role": "ADMIN",
      "department": null
    }
  }
  ```
- **Error `401 Unauthorized`**: Invalid credentials.

#### `POST /api/admin/logout` (alias: `POST /api/auth/logout`)
- **Access**: Authenticated
- **Response `200 OK`**: Clears `admin_token` cookie
  ```json
  {
    "success": true,
    "message": "Logged out successfully"
  }
  ```

#### `GET /api/admin/me` (alias: `GET /api/auth/me`)
- **Access**: Authenticated (Requires signed cookie or Bearer token)
- **Response `200 OK`**:
  ```json
  {
    "data": {
      "user": {
        "id": "u-admin",
        "email": "admin@greenwatch.gov",
        "name": "City Operations Admin",
        "role": "ADMIN",
        "department": null
      }
    }
  }
  ```

#### `GET /api/config`
- **Access**: Public
- **Response `200 OK`**:
  ```json
  {
    "adminRequired": true
  }
  ```

---

## 2. Reports Endpoints

#### `POST /api/reports`
- **Access**: Public (Strict Rate Limited, Per-IP Daily Cap, Honeypot Checked)
- **Security**: Reject if honeypot (`hp`, `website`, `_hp`) is populated.
- **Request Body**:
  ```json
  {
    "description": "Six or seven garbage bags dumped behind the market dumpsters...",
    "location": {
      "address": "Market Court, behind Block C dumpsters",
      "area": "Riverside District",
      "lat": 40.7123,
      "lng": -74.0021
    },
    "photos": ["https://..."]
  }
  ```
- **Response `201 Created`**:
  ```json
  {
    "data": {
      "id": "r1",
      "ref": "GW-2041",
      "category": "garbage",
      "description": "...",
      "status": "Assigned",
      "priority": "High",
      "department": "Sanitation",
      "workOrder": "WO-1187",
      "dueDate": "2026-10-05T12:00:00.000Z",
      "slaDueAt": "2026-10-05T12:00:00.000Z",
      "activity": [...]
    },
    "steps": [...]
  }
  ```

#### `GET /api/reports`
- **Access**: Public / Official
- **Query Parameters**:
  - `status`: Filter by status (`New`, `Verified`, `Assigned`, `In Progress`, `Resolved`, or `All`)
  - `category`: Filter by category (`garbage`, `tree`, `water`, `plants`, `park`, `blocked`, or `All`)
  - `priority`: Filter by priority (`High`, `Medium`, `Low`, or `All`)
  - `department`: Filter by department (`Sanitation`, `Parks & Forestry`, `Water Utility`, `Public Works`, or `All`)
  - `q`: Search string across reference, description, address, area
  - `sortBy`: Field to sort (`createdAt`, `dueDate`, `slaDueAt`, `priority`, `status`)
  - `sortOrder`: `asc` | `desc` (default `desc`)
  - `page`: Page index, 1-based (default `1`)
  - `limit`: Number of items per page (default `50`, max `100`)
- **Response `200 OK`**:
  ```json
  {
    "data": [...],
    "total": 12,
    "page": 1,
    "limit": 50,
    "totalPages": 1
  }
  ```

#### `GET /api/reports/:id`
- **Access**: Public / Official (Identified by internal ID `r1` or reference `GW-2041`)
- **Response `200 OK`**:
  ```json
  {
    "data": { ...report details... }
  }
  ```
- **Error `404 Not Found`**: When ID does not match any report.

#### `GET /api/track/:reference`
- **Access**: Public (Citizen-Safe View)
- **Constraint**: Strips internal notes (`isInternal: true`) and personal contact information.
- **Response `200 OK`**:
  ```json
  {
    "data": {
      "ref": "GW-2041",
      "category": "garbage",
      "description": "...",
      "status": "In Progress",
      "priority": "High",
      "department": "Sanitation",
      "location": { "address": "Market Court", "area": "Riverside District" },
      "createdAt": "2026-10-01T10:00:00Z",
      "updatedAt": "2026-10-03T09:00:00Z",
      "dueDate": "2026-10-05T12:00:00Z",
      "slaDueAt": "2026-10-05T12:00:00Z",
      "resolvedAt": null,
      "timeline": [
        { "status": "New", "at": "2026-10-01T10:00:00Z" },
        { "status": "Assigned", "at": "2026-10-01T10:05:00Z" },
        { "status": "In Progress", "at": "2026-10-02T08:00:00Z" }
      ],
      "activity": [
        { "kind": "agent", "who": "Triage Agent", "text": "Classified as Illegal Garbage Dumping", "at": "..." }
      ]
    }
  }
  ```

---

## 3. Work Orders & State Machine

### Status State Machine Transitions
Allowed progression:
1. `New` -> `Verified` or `Assigned`
2. `Verified` -> `Assigned`
3. `Assigned` -> `In Progress`
4. `In Progress` -> `Resolved`
5. `Resolved` -> `In Progress` (citizen reopening within dispute window)

Any move not permitted by the state machine returns **`409 Conflict`** (`ILLEGAL_STATUS_TRANSITION`).
Every transition atomically logs an `ActivityLog` entry.

#### `PATCH /api/reports/:id/status` (or `PATCH /api/reports/:id`)
- **Access**: Official / Admin Only (Requires authentication)
- **Request Body**:
  ```json
  {
    "status": "In Progress"
  }
  ```
- **Response `200 OK`**: Updated report.
- **Error `401 Unauthorized`**: When unauthenticated.
- **Error `409 Conflict`**: Illegal status transition.

#### `PATCH /api/reports/:id/work-order`
- **Access**: Official / Admin Only
- **Request Body**:
  ```json
  {
    "assignee": "M. Alvarez",
    "dueDate": "2026-10-08T18:00:00.000Z"
  }
  ```
- **Rules**:
  - Assigning an official when status is `New` or `Verified` auto-promotes status to `Assigned`.
  - Updating `dueDate` updates SLA deadline and records activity log.

---

## 4. Activity Logs & Official Notes

#### `GET /api/reports/:id/activity`
- **Access**: Public / Official
- **Rules**: Unauthenticated requests receive only public logs (`isInternal !== true`). Authenticated officials receive all logs including internal notes.
- **Response `200 OK`**:
  ```json
  {
    "data": [
      {
        "id": "act-1",
        "kind": "human",
        "who": "M. Alvarez",
        "text": "Internal crew shift notes",
        "isInternal": true,
        "createdAt": "2026-10-03T11:00:00.000Z"
      }
    ]
  }
  ```

#### `POST /api/reports/:id/activity`
- **Access**: Official / Admin Only (Requires authentication)
- **Request Body**:
  ```json
  {
    "text": "Crew scheduled for tomorrow morning.",
    "isInternal": true,
    "who": "M. Alvarez"
  }
  ```
- **Response `200 OK`**: Updated report with newly appended activity log.

---

## 5. Dashboard & Analytics Endpoints

#### `GET /api/dashboard/kpis` (alias: `GET /api/analytics/kpis`)
- **Access**: Public / Official
- **Response `200 OK`**:
  ```json
  {
    "data": {
      "fresh": 4,
      "inProgress": 4,
      "in-progress": 4,
      "active": 4,
      "overdue": 2,
      "resolvedToday": 2
    }
  }
  ```
  *(Overdue is computed server-side where `(dueDate < now || slaDueAt < now) && status !== "Resolved"`)*

#### `GET /api/dashboard/attention`
- **Access**: Public / Official
- **Response `200 OK`**: Returns reports that are overdue or high priority and active.

#### `GET /api/analytics/categories`
- **Access**: Public / Official
- **Response `200 OK`**:
  ```json
  {
    "data": {
      "garbage": 3,
      "tree": 2,
      "water": 2,
      "park": 2,
      "blocked": 2,
      "plants": 1
    }
  }
  ```

#### `GET /api/analytics/trend` (alias: `GET /api/analytics/trends`, `GET /trend`)
- **Access**: Public / Official
- **Response `200 OK`**: 14-day zero-filled chronological array:
  ```json
  {
    "data": [
      { "date": "2026-09-20", "day": "Sep 20", "filed": 4, "resolved": 3 },
      ...
    ]
  }
  ```

#### `GET /api/analytics/departments` (alias: `GET /api/departments`, `GET /departments`)
- **Access**: Public / Official
- **Response `200 OK`**:
  ```json
  {
    "data": [
      { "name": "Sanitation", "total": 5, "resolved": 2, "overdue": 1, "rate": 84 },
      { "name": "Parks & Forestry", "total": 3, "resolved": 0, "overdue": 1, "rate": 76 },
      { "name": "Water Utility", "total": 2, "resolved": 1, "overdue": 0, "rate": 91 },
      { "name": "Public Works", "total": 2, "resolved": 1, "overdue": 0, "rate": 81 }
    ]
  }
  ```

#### `GET /api/officials`
- **Access**: Public / Official
- **Response `200 OK`**:
  ```json
  {
    "data": [
      { "id": "u-alvarez", "name": "M. Alvarez", "department": "Sanitation", "role": "OFFICIAL" },
      ...
    ]
  }
  ```
