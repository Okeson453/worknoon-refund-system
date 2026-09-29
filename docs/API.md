# API Reference

Base URL: `http://localhost:8080/api` in development, `http://localhost:3000/api` through the nginx
container (same origin as the web client).

* Request and response bodies are JSON (`Content-Type: application/json`).
* The request body is limited to 32 kB by the JSON body parser.
* Every request receives an `X-Request-Id` response header; clients may supply their own inbound
  `X-Request-Id` and it is honoured if it matches `[\w-]{1,64}`.
* All money values are **integer cents**.
* All timestamps are ISO-8601 UTC strings.

---

## 1. Error envelope

Every non-2xx response uses exactly one shape:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid refund request.",
    "requestId": "req_3f2c1d2e-7a41-4a1f-9d1b-6f4a0f2f1c77",
    "details": [{ "path": "message", "message": "A message is required." }]
  }
}
```

| Field | Type | Notes |
|---|---|---|
| `error.code` | enum | `VALIDATION_ERROR`, `RESOURCE_NOT_FOUND`, `UNAUTHORIZED`, `RATE_LIMITED`, `NOT_FOUND`, `INTERNAL_ERROR` |
| `error.message` | string | Customer-safe. Never contains a stack trace, SQL, or an internal exception |
| `error.requestId` | string | Correlates with the log line and the audit trail |
| `error.details` | array | Field-level validation feedback; omitted otherwise |

Codes and statuses:

| Status | Code | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Schema failure, malformed id, bad query parameter |
| 401 | `UNAUTHORIZED` | `ADMIN_API_KEY` is configured and the bearer token is missing or wrong |
| 404 | `RESOURCE_NOT_FOUND` | Unknown customer, order, refund request, or an order owned by someone else |
| 404 | `NOT_FOUND` | The route itself does not exist |
| 429 | `RATE_LIMITED` | More than 20 refund submissions per minute from one IP |
| 500 | `INTERNAL_ERROR` | Unexpected server or database failure |

---

## 2. Authentication

| Scope | Requirement |
|---|---|
| `POST /api/refunds` | none (customer-facing) |
| `GET /api/customers*` | none (synthetic demo data) |
| `GET /api/health` | none |
| `GET /api/refunds`, `GET /api/refunds/:id`, `GET /api/dashboard/summary` | `Authorization: Bearer <ADMIN_API_KEY>` when `ADMIN_API_KEY` is set |

When `ADMIN_API_KEY` is empty the admin endpoints are open; this is a deliberate demo trade-off and
is called out in [`SECURITY.md`](SECURITY.md). The token is compared in constant time.

---

## 3. `GET /api/health`

Service, database and AI status. Used by the container healthcheck and by the web header.

**200 OK**

```json
{
  "status": "ok",
  "database": "ok",
  "ai": "enabled",
  "aiProvider": "anthropic",
  "timestamp": "2026-09-28T12:00:00.000Z"
}
```

| Field | Values | Meaning |
|---|---|---|
| `status` | `ok`, `degraded` | `degraded` when the database is unreachable |
| `database` | `ok`, `down` | Result of a live `SELECT 1` |
| `ai` | `enabled`, `disabled`, `degraded` | `disabled` for the mock provider or a missing key; `degraded` when the last call failed after the last success |
| `aiProvider` | `anthropic`, `mock` | Which provider is configured |
| `timestamp` | ISO-8601 | Server time |

**503 Service Unavailable** — same body with `"status": "degraded"` and `"database": "down"`.

---

## 4. `POST /api/refunds`

The customer workflow. Runs the full pipeline: validation → sanitisation → injection screen →
ownership → persistence → AI interpretation → policy evaluation → response composition →
persistence → response.

### Request

```json
{
  "customerId": "CUST-001",
  "orderId": "ORD-1001",
  "itemIds": ["ITM-1001-1"],
  "message": "My headphones arrived damaged and I would like a refund."
}
```

| Field | Type | Rules |
|---|---|---|
| `customerId` | string | Required, 1–64 chars, `[A-Za-z0-9_-]+` |
| `orderId` | string | Same rules |
| `itemIds` | string[] | Required, 1–20 entries, each matching the identifier rules, each belonging to `orderId` |
| `message` | string | Required, 1–1000 characters after trimming |

The schema is **strict**: any additional property (for example `finalSale`, `refundAmountCents` or
`status`) is rejected with `400`. Order facts are never accepted from the client.

### Response `201 Created`

```json
{
  "id": "rf_01J8Z9K2QW3E4R5T6Y7U8I9O0P",
  "decision": "APPROVED",
  "refundAmountCents": 12900,
  "customerMessage": "Hi Amara, thanks for letting us know about Studio Wireless Headphones. Your refund of $129.00 has been approved and will be returned to your original payment method.",
  "reasonCodes": ["VERIFIED_DEFECT"],
  "createdAt": "2026-09-28T12:00:00.000Z"
}
```

| Field | Type | Notes |
|---|---|---|
| `id` | string | Refund request id; the admin list displays it as `RF-0001` |
| `decision` | enum | `APPROVED`, `DENIED`, `ESCALATED` |
| `refundAmountCents` | integer | Computed from the database, never from the request |
| `customerMessage` | string | Customer-safe text: model draft, or the deterministic template after verification |
| `reasonCodes` | string[] | Fired rules of the category that determined the verdict |
| `createdAt` | ISO-8601 | Intake timestamp |

This response is the **only** customer-facing view of a decision. It deliberately excludes AI
confidence, the injection flag, the full rule list, audit payloads and exception text.

### Status codes

| Status | Code | Condition |
|---|---|---|
| 201 | — | Request processed; a verdict was always reached, even when the AI failed |
| 400 | `VALIDATION_ERROR` | Schema failure, with `details` |
| 404 | `RESOURCE_NOT_FOUND` | Unknown customer, unknown order, an order owned by another customer, or an item that does not belong to the order |
| 429 | `RATE_LIMITED` | More than 20 submissions per minute from one IP |
| 500 | `INTERNAL_ERROR` | Database or unexpected failure; the request may remain `PENDING` for manual review |

### cURL

```bash
curl -sS -X POST http://localhost:8080/api/refunds \
  -H 'Content-Type: application/json' \
  -d '{"customerId":"CUST-001","orderId":"ORD-1001","itemIds":["ITM-1001-1"],
       "message":"My headphones arrived damaged and I would like a refund."}'
```

---

## 5. `GET /api/refunds`

Admin list of refund requests, newest first.

### Query parameters

| Parameter | Type | Default | Notes |
|---|---|---|---|
| `decision` | enum | — | `APPROVED`, `DENIED`, `ESCALATED`, `PENDING` |
| `page` | integer ≥ 1 | `1` | |
| `limit` | integer 1–100 | `25` | |

```http
GET /api/refunds?decision=ESCALATED&page=1&limit=25
```

### Response `200 OK`

```json
{
  "items": [
    {
      "id": "rf_01J8Z9K2QW3E4R5T6Y7U8I9O0P",
      "displayId": 15,
      "customerId": "CUST-003",
      "orderId": "ORD-1003",
      "status": "ESCALATED",
      "refundAmountCents": 90000,
      "detectedReason": "DAMAGED",
      "aiUsed": true,
      "suspicious": false,
      "createdAt": "2026-09-28T12:00:00.000Z",
      "updatedAt": "2026-09-28T12:00:03.412Z"
    }
  ],
  "pagination": { "page": 1, "limit": 25, "total": 1, "pages": 1 }
}
```

| Field | Notes |
|---|---|
| `displayId` | Monotonic human-facing number, rendered as `RF-0015` |
| `detectedReason` | `DAMAGED`, `INCORRECT_ITEM`, `CHANGED_MIND`, `OTHER`, `UNCLEAR`, or `null` when the AI was unavailable |
| `suspicious` | `true` when rule E1 fired; drives the "Flagged" badge |
| `aiUsed` | `false` when the interpretation was unavailable |
| `pagination.pages` | `0` when there are no rows |

### Status codes

`200`, `400` (invalid query), `401` (admin key configured and missing), `500`.

---

## 6. `GET /api/refunds/:id`

Full admin view: order context, every policy check, the validated AI interpretation and the audit
timeline.

### Response `200 OK`

```json
{
  "id": "rf_01J8Z9K2QW3E4R5T6Y7U8I9O0P",
  "displayId": 15,
  "customer": { "id": "CUST-003", "name": "Chen Wei", "email": "customer003@example.test" },
  "order": {
    "id": "ORD-1003",
    "status": "DELIVERED",
    "orderDate": "2026-09-24T00:00:00.000Z",
    "totalCents": 90000
  },
  "items": [
    {
      "id": "ITM-1003-1",
      "productName": "Pro 14 Ultrabook",
      "quantity": 1,
      "priceCents": 90000,
      "finalSale": false,
      "damaged": true,
      "incorrectItem": false
    }
  ],
  "status": "ESCALATED",
  "detectedReason": "DAMAGED",
  "customerMessage": "Laptop arrived damaged, refund please.",
  "refundAmountCents": 90000,
  "decisionReasonCodes": ["OVER_REVIEW_THRESHOLD"],
  "aiUsed": true,
  "aiInterpretation": {
    "intent": "refund_request",
    "reason": "DAMAGED",
    "matchedItemIds": ["ITM-1003-1"],
    "claimedAmountCents": null,
    "injectionSuspected": false,
    "confidence": 0.95,
    "summary": "Customer reports a damaged or defective item for Pro 14 Ultrabook."
  },
  "policyResult": {
    "decision": "ESCALATED",
    "refundAmountCents": 90000,
    "reasonCodes": ["OVER_REVIEW_THRESHOLD"],
    "rules": [
      { "id": "D1", "code": "ORDER_NOT_DELIVERED", "category": "DENIAL", "fired": false, "detail": "Order status is DELIVERED; only DELIVERED orders are eligible." },
      { "id": "A1", "code": "VERIFIED_DEFECT", "category": "APPROVAL", "fired": true, "detail": "Damage is confirmed on Pro 14 Ultrabook." }
    ]
  },
  "customerResponse": "Hi Chen, a member of our support team is reviewing your request personally…",
  "createdAt": "2026-09-28T12:00:00.000Z",
  "updatedAt": "2026-09-28T12:00:03.412Z",
  "audit": [
    {
      "id": "aud_01J8Z9K2QW3E4R5T6Y7U8I9O0Q",
      "eventType": "REQUEST_RECEIVED",
      "actor": "CUSTOMER",
      "summary": "Refund requested for 1 item(s) on ORD-1003.",
      "payload": { "customerId": "CUST-003", "orderId": "ORD-1003", "itemIds": ["ITM-1003-1"], "messageLength": 36 },
      "createdAt": "2026-09-28T12:00:00.010Z"
    }
  ]
}
```

`policyResult.rules` always contains all twelve rules, including the ones that did not fire.
`audit` is ordered oldest first and contains every event type the pipeline produced for this
request, including `AI_FALLBACK_USED` when the deterministic template was used and `ERROR` when a
stage failed.

### Status codes

`200`, `400` (malformed id), `401`, `404 RESOURCE_NOT_FOUND`, `500`.

---

## 7. `GET /api/dashboard/summary`

Outcome counters derived from the persisted refund requests.

### Response `200 OK`

```json
{
  "total": 15,
  "pending": 0,
  "approved": 5,
  "denied": 5,
  "escalated": 5,
  "suspicious": 1,
  "aiFailures": 0
}
```

| Field | Derivation |
|---|---|
| `total` | Count of all refund requests |
| `pending` … `escalated` | Counts grouped by status; the four always sum to `total` |
| `suspicious` | Requests whose stored `policyResult` contains a fired rule `E1` |
| `aiFailures` | Requests with `aiUsed = false`, i.e. decided without a valid AI interpretation |

### Status codes

`200`, `401`, `500`.

---

## 8. `GET /api/customers`

Synthetic CRM selector data for the customer view. Only challenge data is exposed: id, name and
email. Phone numbers exist in the database but are never returned by any endpoint.

### Response `200 OK`

```json
{
  "items": [
    { "id": "CUST-001", "name": "Amara Osei", "email": "customer001@example.test" }
  ]
}
```

Fifteen customers are seeded, ordered by id.

---

## 9. `GET /api/customers/:id`

### Response `200 OK`

```json
{ "id": "CUST-001", "name": "Amara Osei", "email": "customer001@example.test" }
```

### Status codes

`200`, `400`, `404 RESOURCE_NOT_FOUND`.

---

## 10. `GET /api/customers/:id/orders`

Orders of one customer, newest first, with their items and the verified record flags.

### Response `200 OK`

```json
{
  "items": [
    {
      "id": "ORD-1001",
      "orderDate": "2026-09-21T00:00:00.000Z",
      "status": "DELIVERED",
      "totalCents": 12900,
      "items": [
        {
          "id": "ITM-1001-1",
          "productName": "Studio Wireless Headphones",
          "quantity": 1,
          "priceCents": 12900,
          "finalSale": false,
          "damaged": true,
          "incorrectItem": false
        }
      ]
    }
  ]
}
```

`damaged` and `incorrectItem` are **CRM facts**, not customer claims. They are what rule E2 compares
the customer's story against.

### Status codes

`200`, `400`, `404 RESOURCE_NOT_FOUND`, `500`.

---

## 11. Rate limits

| Endpoint | Limit | Scope |
|---|---|---|
| `POST /api/refunds` | 20 requests / 60 s | Client IP (respects one trusted proxy hop, which is how nginx forwards) |

Responses include the standard `RateLimit` headers. Exceeding the limit returns `429` with
`{"error":{"code":"RATE_LIMITED", …}}`. Read endpoints are not rate limited; they are protected by
the optional admin key instead.

---

## 12. Types shared with the web client

`packages/shared-types` exports the enums and DTOs used by both applications, so the contract has a
single source of truth:

```text
enums   OrderStatus · RefundStatus · AuditActor · AuditEventType · policy rules · error codes
api     ApiErrorBody · Pagination · PagedResponse<T> · HealthResponse
refund  CustomerSummary · OrderSummary · OrderItemDto · CreateRefundResponse
        RefundRequestListItem · RefundRequestDetail · AuditEventDto · DashboardSummary
```

The web client imports the same types through a Vite alias, so a contract change breaks the
frontend type-check rather than surfacing at runtime.

---

## 13. Versioning

There is no version prefix. The API is internal to this application and the contract is versioned
with the repository. The shared-types package is the place to introduce `/api/v1` if a second
consumer ever needs stability guarantees.
