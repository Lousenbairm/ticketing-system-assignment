# API Specification

Base URL: `http://localhost:3000`

---

## Ticket Object

All endpoints that return a ticket return this shape:

```json
{
  "id": "uuid",
  "title": "string",
  "customerName": "string",
  "customerEmail": "string",
  "description": "string",
  "status": "OPEN | IN_PROGRESS | RESOLVED | CLOSED",
  "priority": "LOW | MEDIUM | HIGH",
  "createdAt": "ISO datetime",
  "updatedAt": "ISO datetime",
  "resolvedAt": "ISO datetime | null"
}
```

---

## Response Codes

| Code | Meaning | When |
|------|---------|------|
| `200` | OK | Successful GET or PUT |
| `201` | Created | Successful POST |
| `400` | Bad Request | Validation failure, invalid UUID, disallowed status transition |
| `404` | Not Found | Ticket ID does not exist |

### 400 cases in detail

| Endpoint | Cause |
|----------|-------|
| `POST /tickets` | Missing required field, invalid email, extra unknown field |
| `GET /tickets` | `status` query param is not a valid enum value |
| `GET /tickets/:id` | `:id` is not a valid UUID format |
| `PUT /tickets/:id/status` | `:id` is not a valid UUID format |
| `PUT /tickets/:id/status` | `status: CLOSED` — only the scheduler can set this |
| `PUT /tickets/:id/status` | Transition not allowed (e.g. `OPEN → RESOLVED`) |

---

## Endpoints

### POST /tickets
Create a new ticket.

**Body:**
```json
{
  "title": "string (required, max 255)",
  "customerName": "string (required, max 255)",
  "customerEmail": "email (required)",
  "description": "string (required)",
  "priority": "LOW | MEDIUM | HIGH (optional, default: MEDIUM)"
}
```

**Responses:**
- `201` — ticket object; `status` defaults to `OPEN`
- `400` — validation failure (missing field, invalid email, extra field)

---

### GET /tickets
List all tickets, newest first.

**Query params (all optional):**
```
?status=OPEN|IN_PROGRESS|RESOLVED|CLOSED
?q=<search string>   — case-insensitive match on title or description
```

**Responses:**
- `200` — array of ticket objects (empty array if none match)
- `400` — invalid `status` value

---

### GET /tickets/:id
Get a single ticket by UUID.

**Responses:**
- `200` — ticket object
- `400` — `:id` is not a valid UUID
- `404` — ticket not found

---

### PUT /tickets/:id/status
Update a ticket's status.

**Body:**
```json
{ "status": "OPEN | IN_PROGRESS | RESOLVED | CLOSED" }
```

**Valid transitions (API):**
```
OPEN → IN_PROGRESS
IN_PROGRESS → RESOLVED
```

**Responses:**
- `200` — updated ticket object; `resolvedAt` is set when transitioning to `RESOLVED`
- `400` — `:id` is not a valid UUID
- `400` — `CLOSED` requested (auto-closed by scheduler only)
- `400` — transition not allowed (e.g. OPEN → RESOLVED)
- `404` — ticket not found

---

## Status Machine

```
OPEN ──→ IN_PROGRESS ──→ RESOLVED ──→ CLOSED (cron only, runs 02:00 AM daily)
```

- `CLOSED` is set automatically after a ticket has been in `RESOLVED` state for 3+ days.
- `PUT /tickets/:id/status` with `CLOSED` always returns `400`.
