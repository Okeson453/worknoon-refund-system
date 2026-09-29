# WORKNOON — AI-Powered Customer Support Refund System

A containerised full-stack application that processes e-commerce refund requests. A customer
describes the problem in a chat interface; the backend loads trusted order data, applies a
**deterministic refund policy**, uses an LLM to interpret the message and to write the reply, and
returns **APPROVED**, **DENIED** or **ESCALATED**. Support staff inspect every request, every
policy check, the AI analysis and the audit trail in an admin dashboard.

> The language model is never the authority. It classifies text and drafts wording. The policy
> engine decides, and it is pure, deterministic and fully unit-tested.

- Challenge: WORKNOON Full Stack AI Integration
- Stack: React 18 + TypeScript + Vite · Node.js 20 + Express + TypeScript · PostgreSQL 16 · Prisma · Zod · Gemini / Anthropic SDKs
- Deployment: Docker Compose (`db`, `api`, `web`)

---

## 1. Quick start

```bash
git clone <repository>
cd worknoon-refund-system
cp .env.example .env          # optional: add ANTHROPIC_API_KEY
docker compose up --build
```

Then open:

| URL | What it is |
|---|---|
| http://localhost:3000 | Customer refund flow |
| http://localhost:3000/admin | Support dashboard |
| http://localhost:8080/api/health | API health (also the container healthcheck) |

The API container waits for PostgreSQL, applies the Prisma migration, seeds 15 synthetic
customers and starts serving. No manual Node, PostgreSQL or Prisma installation is required.

**No API key?** Nothing to do — `.env.example` already ships `AI_PROVIDER=mock`, so a fresh clone runs
offline. The deterministic provider classifies with fixed keyword rules, so the whole demo runs
without a signup and every scenario behaves identically on every machine.

**Want a real model?** Set `AI_PROVIDER=gemini` and `GEMINI_API_KEY=<key>` in `.env` (free tier at
https://aistudio.google.com/apikey). `AI_PROVIDER=anthropic` with `ANTHROPIC_API_KEY` works too.
Either way the AI is an optional enrichment — the policy engine owns every decision.

---

## 2. What to try first

| Demo | How | Expected |
|---|---|---|
| Approved | Customer page → chip **Damaged item → approved** → Send | `APPROVED`, $129.00 |
| Denied | Chip **Final sale → denied** | `DENIED` (rule D3) |
| Escalated | Chip **$900 laptop → escalated** | `ESCALATED` (rule E3) |
| Prompt injection | Chip **Prompt injection → denied** | `DENIED`; the injection is flagged in the admin audit trail but changes nothing |
| Boundaries | Chips **Day 30 vs day 31** and customer `CUST-008` / `CUST-009` | day 30 approves, day 31 denies, $500.00 approves, $501.00 escalates |

After submitting, open http://localhost:3000/admin and select the new row: the drawer shows the
original message, every policy rule with a fired indicator, the validated AI interpretation with
confidence and latency, and the ordered audit timeline.

---

## 3. Architecture at a glance

```text
Browser (React 18 + Vite)
        │  same-origin /api  (nginx reverse proxy)
        ▼
Express API ── Zod validation · rate limit · admin auth · request id
        │
        ▼
Refund service (orchestration)
        ├── repositories ── PostgreSQL 16 / Prisma
        ├── AI service ──── Gemini or Anthropic (or MockProvider) → structured signals
        ├── policy engine ─ pure function, no I/O  ← the only authority
        └── audit service ─ append-only event trail
        │
        ▼
Customer-safe response  ·  admin detail view
```

Dependencies point inwards only:

```text
routes → controllers → services → policy | ai | repositories | audit → database | provider
```

The policy engine imports nothing from Express, Prisma, React or the AI layer, which is what makes
it exhaustively testable. Full detail: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

### Request lifecycle

```text
validate → sanitize → injection screen → ownership check → persist PENDING + audit
        → AI interpretation (schema-validated) → item-id intersection
        → deterministic policy engine → AI response composition (verified)
        → finalize decision + audit → customer-safe response
```

---

## 4. Repository layout

```text
worknoon-refund-system/
├── apps/
│   ├── api/            Express API, policy engine, AI layer, Prisma, tests
│   └── web/            React customer flow and admin dashboard, nginx config
├── packages/
│   └── shared-types/   Enums and API contracts shared by both apps
├── policy/             Human-readable refund policy
├── docs/               Architecture, API, data model, AI, security, demo
├── scripts/            wait-for-db, test-all, verify-clean-clone
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## 5. Local development without Docker

Requires Node.js 20+ and a PostgreSQL 16 instance (any reachable database works).

```bash
npm install
cp .env.example .env                      # point DATABASE_URL at your database
npm run prisma:generate                   # generate the Prisma client
npm run db:migrate                        # prisma migrate deploy
npm run db:seed                           # 15 synthetic customers and orders

npm run dev:api                           # http://localhost:8080
npm run dev:web                           # http://localhost:5173 (proxies /api to :8080)
```

Vite proxies `/api` to the Express service, so the browser still talks to a single origin.

---

## 6. Environment variables

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `NODE_ENV` | No | `development` | Runtime mode |
| `DATABASE_URL` | **Yes** | — | PostgreSQL connection string; validated at boot |
| `AI_PROVIDER` | No | `mock` | `mock` (key-free, deterministic), `gemini` (free tier), or `anthropic` |
| `GEMINI_API_KEY` | For Gemini | empty | Never logged, never sent to the browser |
| `ANTHROPIC_API_KEY` | For Anthropic | empty | Never logged, never sent to the browser |
| `AI_MODEL` | No | per provider | `gemini-2.5-flash` or `claude-sonnet-5`; overrides the provider default |
| `AI_TIMEOUT_MS` | No | `10000` | Per-call timeout, with one retry |
| `AI_MIN_CONFIDENCE` | No | `0.6` | Below this the reason counts as unclear (E5) |
| `REFUND_WINDOW_DAYS` | No | `30` | Refund window, inclusive |
| `ESCALATION_THRESHOLD_USD` | No | `500` | Human-review threshold; strictly above escalates |
| `ADMIN_API_KEY` | No | empty | Optional bearer token for the support endpoints |
| `PORT` | No | `8080` | API port |
| `WEB_PORT` | No | `3000` | Published web port |
| `LOG_LEVEL` | No | `info` | pino level |

Configuration is parsed with Zod at boot and the process fails fast with a readable message if
anything is invalid. `.env` is git-ignored; `.env.example` is committed.

---

## 7. API surface

Base path `/api`. All errors use one envelope:
`{ "error": { "code", "message", "requestId" } }`.

| Method | Path | Access | Purpose |
|---|---|---|---|
| `GET` | `/api/health` | public | Service, database and AI status |
| `POST` | `/api/refunds` | customer | Submit a refund request (full pipeline) |
| `GET` | `/api/refunds` | admin | List requests (`?decision=&page=&limit=`) |
| `GET` | `/api/refunds/:id` | admin | Full decision trail |
| `GET` | `/api/dashboard/summary` | admin | Outcome counters |
| `GET` | `/api/customers` | demo | Synthetic customer list |
| `GET` | `/api/customers/:id` | demo | Customer profile |
| `GET` | `/api/customers/:id/orders` | demo | Orders and items |

Full request and response contracts: [docs/API.md](docs/API.md).

---

## 8. The policy engine in one table

```text
D1 ORDER_NOT_DELIVERED      deny     order status is not DELIVERED
D2 ALREADY_REFUNDED         deny     item already has an APPROVED refund
D3 FINAL_SALE               deny     item is final sale
D4 OUTSIDE_REFUND_WINDOW    deny     order older than 30 days
E1 SUSPICIOUS_INPUT         escalate injection screen or model flagged manipulation
E2 CLAIM_CONTRADICTS_RECORDS escalate claim not supported by the record, or amount mismatch
E3 OVER_REVIEW_THRESHOLD    escalate amount > $500.00
E4 ITEM_AMBIGUOUS           escalate multi-item order, nothing identified
E5 REASON_UNCLEAR           escalate reason OTHER/UNCLEAR or confidence < 0.6
E6 AI_UNAVAILABLE           escalate the AI call failed or failed validation
A1 VERIFIED_DEFECT          approve  damage or wrong item confirmed on the record
A2 STANDARD_RETURN          approve  change of mind inside the window

precedence: any denial → DENIED, else any escalation → ESCALATED, else any approval → APPROVED,
            else ESCALATED (never approve by accident)
```

Full specification: [policy/refund-policy.md](policy/refund-policy.md).

---

## 9. AI integration

**The stack runs without an API key.** `AI_PROVIDER=mock` is the default, so a fresh clone decides
correctly with no signup. Select a live model with `AI_PROVIDER=gemini` (free tier,
`GEMINI_API_KEY`) or `AI_PROVIDER=anthropic` (`ANTHROPIC_API_KEY`); both are schema-constrained the
same way, and swapping between them is a one-line env change.

Two model calls per request, both schema-constrained with forced tool use:

1. **Interpret** — sanitised message plus item id/name pairs in, structured signals out
   (`intent`, `reason`, `matchedItemIds`, `claimedAmountCents`, `injectionSuspected`, `confidence`,
   `summary`). Unknown item ids are dropped and set the suspicious flag.
2. **Compose** — structured fields only (verdict, reason codes, item names, amount, first name).
   The raw customer message is **never** part of this call, which removes second-order injection.
   The reply is verified against the verdict and falls back to a deterministic template on any
   contradiction.

Failure behaviour: timeout, 429 and 5xx are retried once, then the request continues with neutral
signals. An existing denial still denies; anything else escalates with `AI_UNAVAILABLE`. An AI
outage can therefore never produce an approval.

Prompt-injection defence in depth: sanitisation, a heuristic screen, prompt structure, constrained
output, authority separation, output verification and a complete audit trail.
Details: [docs/AI.md](docs/AI.md).

---

## 10. Security

* Zod validation on every request; strict schemas reject spoofed fields such as `finalSale`.
* Ownership is part of the order lookup: an order that belongs to someone else is a `404`, with the
  same message as an unknown order, so ids cannot be enumerated.
* Per-IP rate limit of 20 submissions per minute; 1000-character message cap; 10-second AI timeout.
* Optional `ADMIN_API_KEY` bearer token for the support endpoints, compared in constant time.
* The refund amount is computed from the database, never from the request body.
* Duplicate refunds are prevented by re-checking rule D2 inside the finalize transaction while
  holding `SELECT … FOR UPDATE` on the order row.
* Generic error envelopes with a request id; stack traces never reach the client.
* React escaping only — no `dangerouslySetInnerHTML` anywhere — plus a CSP on the nginx container.
* Prompt-injection heuristics flag manipulation but never block, so hostile traffic stays visible
  to support.

Threat model and controls: [docs/SECURITY.md](docs/SECURITY.md).

---

## 11. Testing

```bash
npm run test:unit          # no database required
npm run test:integration   # needs a database whose name contains "test"
npm run test:all           # typecheck, lint, unit, integration, production builds
```

| Suite | Count | Covers |
|---|---|---|
| `tests/unit/policy` | 6 files | Every rule, precedence, $500/$501 and day 30/31 boundaries, monotonic safety, policy/document parity |
| `tests/unit/ai` | 5 files | Schemas, item intersection, injection corpus, retry/timeout behaviour, composer consistency, mock determinism |
| `tests/unit/validation` | 3 files | Message limits, malformed ids, unknown fields, pagination |
| `tests/unit/security` | 4 files | Ownership scoping, prompt injection, XSS-safe rendering, rate limiting |
| `tests/integration` | 4 files | All 15 seeded scenarios end to end, error contract, rate limit, AI outage, admin views |

Integration tests run the real Express app against a real PostgreSQL database with the seeded
scenarios, using `MockProvider` for determinism. The test bootstrap refuses to run against a
database whose name does not contain `test`.

---

## 12. Seeded scenarios

| Customer | Setup | Expected |
|---|---|---|
| CUST-001 | Headphones $129, 7 days, damaged | `APPROVED` |
| CUST-002 | Clearance jacket $89, final sale | `DENIED` |
| CUST-003 | Laptop $900, 4 days, damaged | `ESCALATED` |
| CUST-004 | Sneakers $75, 45 days old | `DENIED` |
| CUST-005 | Blender $60, wrong item on record | `APPROVED` |
| CUST-006 | Smartwatch $210, damage not on record | `ESCALATED` |
| CUST-007 | Backpack $80 + sunglasses $45 final sale | `APPROVED` / `DENIED` |
| CUST-008 | Monitor $500.00, damaged | `APPROVED` (boundary) |
| CUST-009 | Tablet $501.00, damaged | `ESCALATED` (boundary) |
| CUST-010 | Order at 30 days + order at 31 days | `APPROVED` / `DENIED` (boundary) |
| CUST-011 | Item already refunded | `DENIED` |
| CUST-012 | Order still `SHIPPED` | `DENIED` |
| CUST-013 | Espresso machine $250, final sale, hostile message | `DENIED` + injection flagged |
| CUST-014 | Two items, vague message | `ESCALATED` (ambiguous) |
| CUST-015 | $60 item, customer claims $300 | `ESCALATED` (amount mismatch) |

---

## 13. Known limitations

* **Admin access is a static token, not identity management.** With `ADMIN_API_KEY` empty the
  support endpoints are open; that is a deliberate demo trade-off.
* **Heuristic injection detection is bypassable.** Structure, not pattern matching, is what keeps
  the system safe: a fooled model can at worst cause an unnecessary escalation.
* **Escalated requests are not resolved in-app.** There is no override endpoint; resolution happens
  outside the service and is audited as an external action.
* **Polling, not websockets.** The dashboard can be up to 10 seconds stale.
* **Single-region, single-node deployment.** No read replicas, no queue, no horizontal scaling of
  in-process state; the rate limiter is per process.
* **Refund amounts exclude shipping and tax**, and partial-quantity refunds are out of scope.

---

## 14. Documentation

| Document | Contents |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Containers, layers, request lifecycle, state machine, design decisions |
| [docs/API.md](docs/API.md) | Every endpoint, request/response contract, status codes, error envelope |
| [docs/DATA_MODEL.md](docs/DATA_MODEL.md) | Entities, relations, indexes, money handling, seed matrix, migrations |
| [docs/AI.md](docs/AI.md) | Provider abstraction, both calls, prompts, validation, fallbacks, injection defence |
| [docs/SECURITY.md](docs/SECURITY.md) | Threat model, controls, admin auth, secrets, what is deliberately not covered |
| [docs/DEMO.md](docs/DEMO.md) | Recorded-walkthrough notes, reviewer checklist, troubleshooting |
| [docs/demo-script.md](docs/demo-script.md) | Timed 7-minute demo script |
| [policy/refund-policy.md](policy/refund-policy.md) | Human-readable refund policy, parity-tested against the code |

---

## 15. Licence

MIT — see [LICENSE](LICENSE).
