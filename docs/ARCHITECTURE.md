# Architecture

WORKNOON AI-powered customer support refund system. This document describes how the system is
built, why each boundary exists, and how data flows through it. The refund policy itself is
specified separately in [`../policy/refund-policy.md`](../policy/refund-policy.md); the HTTP
contract is in [`API.md`](API.md).

---

## 1. System goals and constraints

| Goal | Consequence in the design |
|---|---|
| A refund decision must be explainable | Every rule that fired is stored with the request and rendered in the admin drawer |
| An LLM must not be able to authorise money movement | The model returns schema-validated signals; a pure function decides |
| A reviewer must run it with one command | Docker Compose, automatic migrations, idempotent seed |
| The demo must work without a paid API key | `MockProvider` behind the same interface, selected by `AI_PROVIDER` |
| Nothing sensitive may leak into the browser or the log | Shared contracts, strict error envelope, pino redaction, CSP |

Non-goals, stated explicitly so the absence of a feature is not a bug: real identity management,
payment execution, email notifications, multi-tenancy and partial-quantity refunds.

---

## 2. Container view

```text
┌──────────────────────────────────────────────────────────────────────┐
│ docker compose                                                       │
│                                                                      │
│  ┌────────────┐   /api (reverse proxy)   ┌────────────────────────┐  │
│  │    web     │ ──────────────────────► │           api          │  │
│  │  nginx     │                         │  Express + TypeScript  │  │
│  │  + React   │ ◄── static assets ────  │  policy · AI · audit   │  │
│  └────────────┘                         └───────────┬────────────┘  │
│      port 3000                                     │               │
│                                                    ▼               │
│                                          ┌────────────────────┐     │
│                                          │        db          │     │
│                                          │  PostgreSQL 16     │     │
│                                          └────────────────────┘     │
│                                                   port 5432         │
└──────────────────────────────────────────────────────────────────────┘
                                                     │
                                                     ▼
                                          ┌────────────────────┐
                                          │ Gemini (OpenAI-    │
                                          │ compat) or Anthro- │
                                          │ pic, or Mock       │
                                          └────────────────────┘
```

| Container | Image | Responsibility | Startup |
|---|---|---|---|
| `db` | `postgres:16` | Relational store, named volume `pgdata` | `pg_isready` healthcheck gates `api` |
| `api` | `node:20-slim` | HTTP, orchestration, policy engine, AI layer, audit | wait-for-db → `prisma migrate deploy` → seed → serve |
| `web` | `nginx:1.27-alpine` | Serves the built SPA, proxies `/api` to `api`, adds CSP | depends on `api` being started |

Why the browser never talks to `api` directly: same-origin removes the CORS surface entirely, and
the nginx layer is the natural place for the content security policy. The API is still published on
`${PORT}` for debugging.

Base images are Debian-based (`node:20-slim`) rather than Alpine so the Prisma query engine finds
a compatible OpenSSL.

---

## 3. Backend layering

```text
HTTP request
    │
    ▼
Route                     api/routes/*.routes.ts
    │
    ▼
Middleware                 requestId · rateLimit · adminAuth · (validation in controllers)
    │
    ▼
Controller                 controllers/*.controller.ts — HTTP translation only
    │
    ▼
Application service        services/**/*.ts — orchestration
    │
    ├── repository          database/repositories/*.repository.ts
    ├── policy engine       policy/**
    ├── AI service          ai/**
    └── audit service       audit/**
    │
    ▼
Persistence / external provider
```

**Dependency rule.** Dependencies point inwards. The policy engine imports nothing from Express,
Prisma, React or the Anthropic SDK; it only receives plain data and a `Date`. This is what allows
the decision logic to be unit-tested exhaustively without a database, a network or a clock.

Controllers never issue Prisma calls; repositories never build HTTP responses; the policy engine
never learns that an HTTP request exists. Each of these rules is enforced by review and by the
import graph, and the test suite fails if the policy engine starts importing infrastructure.

---

## 4. Data flow of a refund request

```text
POST /api/refunds
  │
  1  requestId middleware      → req_<uuid>, echoed in X-Request-Id and in every error envelope
  2  rate limiter              → 20 submissions / minute / IP
  3  Zod validation            → customerId, orderId, itemIds[1..20], message[1..1000], strict
  4  sanitisation              → NFKC, strip control + zero-width characters, collapse spaces
  5  injection screen          → heuristic patterns set a flag, never block
  6  ownership                 → customer exists? order belongs to that customer? else 404
  7  load trusted facts        → order, items, previously refunded items
  8  persist intake            → RefundRequest PENDING + REQUEST_RECEIVED + INPUT_SCREENED (one transaction)
  9  AI interpretation         → structured signals, Zod-validated, item ids intersected
 10  policy engine             → evaluateRefund(): 12 rules, precedence, verdict
 11  response composition      → model draft verified against the verdict, template fallback
 12  finalize                  → lock order row, re-check D2, update request, write remaining audit events
 13  respond                   → id, decision, refundAmountCents, customerMessage, reasonCodes, createdAt
```

Steps 1–8 are synchronous and fast. Step 9 is the only call that can be slow or unavailable, and it
is wrapped in a failure handler that degrades to neutral signals instead of failing the request. A
crash between steps 8 and 12 leaves a visible `PENDING` row rather than silence, which is what the
support dashboard shows under `PENDING`.

### 13. Response isolation

The customer response contains exactly six fields. It never contains AI confidence, the injection
flag, rule internals, the audit payload or exception text. The admin detail endpoint returns all of
it, and only that endpoint. This asymmetry is intentional: an attacker learns nothing about whether
a heuristic fired.

---

## 5. Refund state machine

```text
        ┌──────────┐
        │ RECEIVED │  validated, ownership confirmed
        └────┬─────┘
             ▼
        ┌──────────┐
        │ PENDING  │  persisted before any AI call
        └────┬─────┘
             ▼
   ┌────────────────────┐
   │ AI INTERPRETATION  │  failure → neutral signals, request continues
   └─────────┬──────────┘
             ▼
   ┌────────────────────┐
   │ POLICY EVALUATED   │  12 rules, all evaluated, precedence applied
   └─────────┬──────────┘
             ▼
    APPROVED   DENIED   ESCALATED
             │
             ▼
   ┌────────────────────┐
   │ RESPONSE GENERATED │  AI draft verified, template fallback on failure
   └─────────┬──────────┘
             ▼
      ┌─────────────┐
      │ AUDIT COMPLETE│
      └─────────────┘
```

Terminal states are `APPROVED`, `DENIED` and `ESCALATED`. `PENDING` is a real state in the database
and on the dashboard: it means the pipeline did not finish, and a person should look at it.

AI failure path:

```text
AI failure
   ├── a deterministic denial already applies → DENIED   (no AI needed)
   └── otherwise                                  → ESCALATED + AI_UNAVAILABLE
```

---

## 6. The policy engine

```text
apps/api/src/policy/
├── policy.types.ts        PolicyInput, PolicySignals, PolicyCheck, PolicyResult
├── policy.constants.ts    rule catalogue, evaluation order, precedence, default config
├── policyResult.ts        ruleCheck(), computeRefundAmountCents(), resolveVerdict()
├── rules/denialRules.ts   D1–D4 from database facts only
├── rules/escalationRules.ts E1–E6 from trusted facts plus validated signals
├── rules/approvalRules.ts A1–A2 from confirmed record flags
└── evaluateRefund.ts      the single public entry point
```

`evaluateRefund(input)` takes a clock, order facts, item facts, previously refunded flags, one
`PolicySignals` object, and the configuration; it returns a verdict, a refund amount, all twelve
rule results and the reason codes that determined the verdict. It performs no I/O, so the same
input always produces the same output.

**Why the signals object is the only AI channel.** The engine cannot see the model, the prompt or
the raw message. It sees five derived values. This is what makes the monotonic-safety property
provable: raising `suspicious`, setting `aiFailed` or lowering `confidence` can only add escalation
rules.

**Why all rules are evaluated.** Short-circuiting would be marginally faster but would leave the
audit trail incomplete. A support specialist asking "did the system check the refund window?"
should be able to read the answer, not infer it.

---

## 7. The AI layer

```text
apps/api/src/ai/
├── ai.types.ts            AiProvider, InterpretInput, ComposeInput, Interpretation, Composition
├── ai.provider.ts         provider factory + health state tracking
├── gemini.provider.ts     Gemini OpenAI-compatible endpoint, forced tool use, one retry
├── anthropic.provider.ts  Messages API, forced tool use, one retry, typed failures
├── mock.provider.ts       deterministic classifier used by tests and no-key demos
├── injectionScreen.ts     heuristic pattern list
├── prompts/               fixed system prompts and user-prompt builders
├── schemas/               Zod schemas and the JSON schemas used for forced tool use
└── aiErrors.ts            normalized AI error taxonomy
```

Two calls per request: **interpret** (message plus item id/name pairs) and **compose** (structured
decision fields only). The composer never receives the customer text, which removes second-order
injection entirely. Both outputs are schema-validated; anything that fails validation is discarded,
not coerced.

`ai.provider.ts` also owns the health state used by `/api/health`: `enabled`, `disabled` or
`degraded`, where `degraded` means a call failed after the last success. Details in [`AI.md`](AI.md).

---

## 8. Persistence layer

```text
apps/api/src/database/
├── prisma.ts                 single PrismaClient, connection probe
├── transactions.ts           withTransaction(), lockOrderRow()
└── repositories/
    ├── customer.repository.ts
    ├── order.repository.ts    ownership-scoped lookups, previously refunded ids
    ├── refund.repository.ts   create, finalize, list, detail, dashboard aggregates
    └── audit.repository.ts    append-only writes, ordered reads
```

Two details deserve attention.

**Ownership lives in the query.** `findOrderForCustomer(customerId, orderId)` issues a single
`findFirst` with both ids in the `where` clause. There is no "fetch then compare" step that could be
forgotten in a new endpoint, and an order belonging to another customer is indistinguishable from a
non-existent one.

**Duplicate refunds are closed under a row lock.** Inside the finalize transaction the service runs
`SELECT … FOR UPDATE` on the order row and re-checks rule D2. Two concurrent submissions for the
same item cannot both pass: the second one sees the first one's `APPROVED` row and is denied. If the
re-check changes the verdict, the decision is recomputed with the fresh facts and the deterministic
template is used, so no model call ever runs while a row lock is held.

**Dashboard aggregates** come from a `groupBy` on status plus two extra counts: AI failures are the
requests where `aiUsed = false`, and suspicious requests are found with a parameterised `jsonb`
containment query on `policyResult`. There is no second source of truth.

---

## 9. Audit trail

Eight event types, written in the same transaction as the state change they describe:

| Event | Actor | Captures |
|---|---|---|
| `REQUEST_RECEIVED` | `CUSTOMER` | Customer, order, selected item ids, message length |
| `INPUT_SCREENED` | `SYSTEM` | Sanitisation changes, matched pattern ids, suspicious flag |
| `AI_INTERPRETATION` | `AI` | Validated interpretation, model, latency, dropped item ids, or the failure kind |
| `POLICY_EVALUATED` | `POLICY_ENGINE` | All twelve rules with fired state and detail, the config used, whether the verdict was recomputed under lock |
| `DECISION_MADE` | `POLICY_ENGINE` | Verdict, amount, reason codes, the signal object, AI latency |
| `AI_RESPONSE_GENERATED` | `AI` | Model that drafted the reply and its word count |
| `AI_FALLBACK_USED` | `SYSTEM` | Why the deterministic template replaced the model output |
| `ERROR` | `SYSTEM` | Failure class and a truncated, non-sensitive excerpt |

Audit rows are append-only: the repository exposes `create` and `createMany` and nothing else. The
payloads are deliberately small and free of contact details, so the trail is useful without
becoming a second copy of the customer data.

---

## 10. Frontend architecture

```text
apps/web/src/
├── app/          App, router, providers (crash boundary + notifications)
├── components/
│   ├── layout/   AppShell, Header (with live health pill), PageContainer
│   ├── common/   Button, Card, Badge, Spinner, EmptyState, ErrorState
│   ├── refund/   customer flow
│   └── admin/    support dashboard
├── pages/        CustomerRefundPage, AdminDashboardPage, NotFoundPage
├── services/     typed HTTP client and domain wrappers
├── hooks/        useCustomers, useOrders, useRefund, useDashboard
├── types/        re-exports and UI-only types
└── utils/        formatting and status metadata
```

No global state library. The customer flow is a four-step wizard whose state is local to
`CustomerRefundPage`; the dashboard state is a `useDashboard` hook with a 10-second poll. All HTTP
goes through `services/api.ts`, which owns the base URL, the admin bearer token, the 20-second
timeout, abort handling and the translation of the error envelope into `ApiRequestError`. No
component constructs a `fetch` call.

Accessibility is part of the component contract rather than a pass at the end: every input has a
label, decision badges carry a glyph and text (never colour alone), the chat thread is an
`aria-live` region, the detail drawer is a modal dialog with focus moved to its close button and
`Escape` to dismiss, and the whole page is keyboard navigable including table rows.

---

## 11. Request correlation

Every request receives `req_<uuid>`, or reuses a well-formed inbound `X-Request-Id`. The id is
attached to the Express request, written into every audit event of that pipeline run, included in
every error envelope and returned in the `X-Request-Id` response header. A reviewer can therefore
take a customer-visible request id and reconstruct exactly what happened, including which rules
fired and what the model returned.

---

## 12. Observability

Structured JSON logs via pino with the service name, ISO timestamps and redaction of
`authorization`, cookies, API keys, emails and phone numbers. Logged per request: request id,
method, route, status, latency. Logged per refund: verdict, amount, reason codes, whether the AI was
used, whether the template fallback ran, and the total pipeline latency. AI latency, model and
provider are logged at `debug` together with token usage, which keeps paid-token accounting out of
the default log stream.

`GET /api/health` reports service status, database reachability and AI state, and doubles as the
container healthcheck. The web header shows the same information as a small status pill, refreshed
every 30 seconds.

---

## 13. Configuration and failure modes

Configuration is parsed once at boot with Zod (`config/env.ts`) and the process refuses to start on
invalid input, which turns a subtle runtime bug into a startup error with a readable message.

| Failure | Behaviour |
|---|---|
| Database unreachable at boot | Process exits with code 1 and a log line |
| Database unreachable at request time | `500 INTERNAL_ERROR` with the request id |
| Model timeout, 429 or 5xx | One retry, then neutral signals and escalation |
| Model returns invalid output | Output discarded, truncated excerpt in the audit trail, escalation |
| Composer contradicts the verdict | Deterministic template, `AI_FALLBACK_USED` |
| Rate limit exceeded | `429 RATE_LIMITED` before any pipeline work |
| Unknown or foreign customer/order | `404 RESOURCE_NOT_FOUND`, identical message in both cases |

---

## 14. Design decisions and trade-offs

| Decision | Benefit | Cost |
|---|---|---|
| Deterministic policy, AI as assistant | Provably safe, testable, explainable | The model cannot resolve nuanced exceptions; that is what escalation is for |
| Two model calls | The AI is meaningfully in the workflow, with clean separation | Roughly 2–4 seconds of latency and double the token cost |
| Persist `PENDING` before the AI call | A crash is visible instead of silent | One extra write per request |
| Recompute under row lock on a duplicate | The duplicate check is airtight | Rare path uses a template instead of a model draft |
| Any final-sale item denies the request | Simple and predictable | Customers resubmit for the eligible items |
| Escalate on any suspicion | Never approves under doubt | Some benign messages escalate |
| Static admin token | Fits the scope, trivial to demo | Not identity management |
| Polling dashboard | No websocket infrastructure | Up to 10 seconds of staleness |
| PostgreSQL over SQLite | Production-realistic relations and `jsonb` | Heavier container, mitigated by the healthcheck |

---

## 15. Extending the system

* **A new policy rule:** add the code to the shared `POLICY_RULES` catalogue, implement it in the
  matching `rules/` module, register it in `RULE_EVALUATION_ORDER`, add unit tests on both sides of
  the boundary, and update `policy/refund-policy.md`. The constants test will remind you.
* **A new model provider:** implement `AiProvider`, register it in `ai.provider.ts`, add
  `src/ai/<name>.provider.ts`. Nothing else changes; the pipeline only knows the interface.
* **A new endpoint:** route → controller → service → repository, with a Zod schema in
  `validation/` and integration coverage. Never put business rules in a controller.
* **Real authentication:** replace `api/middleware/adminAuth.ts` with session verification. The
  three admin endpoints are the only ones affected, and they are already isolated behind one
  middleware.
* **Resolving escalations in-app:** add a write endpoint guarded by admin auth, a new
  `ADMIN` audit actor event, and a status transition. The audit trail and the state machine are
  already shaped for it.
