# Demo Guide

Everything needed to run, present and defend the system. The timed narration lives in
[`demo-script.md`](demo-script.md); this document is the reference you keep open while doing it.

---

## 1. Prerequisites

| Requirement | Notes |
|---|---|
| Docker with Compose v2 | `docker compose version` should succeed |
| ~2 GB free RAM | PostgreSQL plus two Node containers |
| Ports 3000, 8080, 5432 free | Override with `WEB_PORT` / `PORT` in `.env` |
| An LLM API key *(optional)* | Not needed — the default `mock` provider runs offline. Gemini's free tier or Anthropic both work |

No local Node, PostgreSQL or Prisma installation is needed. The API image installs dependencies,
generates the Prisma client, builds the TypeScript, applies the migration and seeds the data during
container start.

---

## 2. Start the stack

```bash
git clone <repository>
cd worknoon-refund-system
cp .env.example .env

# Runs as-is: AI_PROVIDER=mock is the default, no key and no signup needed.

# Optionally, for a live model (Gemini free tier):
#   AI_PROVIDER=gemini
#   GEMINI_API_KEY=...

docker compose up --build
```

Watch for:

```text
[entrypoint] waiting for the database…
[entrypoint] applying database migrations…
[entrypoint] seeding synthetic CRM and order data…
[entrypoint] starting the API on port 8080…
{"event":"startup","port":8080,"msg":"api listening"}
```

Open:

* http://localhost:3000 — customer flow
* http://localhost:3000/admin — support dashboard
* http://localhost:8080/api/health — health JSON

Verify the seed landed:

```bash
curl -sS http://localhost:8080/api/customers | head -c 200
# {"items":[{"id":"CUST-001","name":"Amara Osei","email":"customer001@example.test"}, …
```

---

## 3. The six demo moments

### 3.1 Approved — CUST-001

Customer page → chip **Damaged item → approved** → **Send refund request**.

* Decision badge: **Approved**, amount **$129.00**.
* Reason line: *Verified defect*.
* The database says the headphones are damaged; the customer's message says the same; the amount is
  below $500; the order is 7 days old.

Why it is approved: rules D1–D4 pass, E1–E6 do not fire, A1 fires on the confirmed `damaged` flag.

### 3.2 Denied — CUST-002

Chip **Final sale → denied** → send.

* Decision badge: **Denied**.
* Reason: *Final sale item*.
* The reply is friendly and gives the reason; the internal code never leaks.

### 3.3 Escalated — CUST-003

Chip **$900 laptop → escalated** → send.

* Decision badge: **Escalated**, amount **$900.00**.
* Reason: *Above the manual review threshold*.
* The reply says a specialist will follow up.

### 3.4 Prompt injection — CUST-013

Chip **Prompt injection → denied** → send.

* Decision badge: **Denied** — the deterministic final-sale rule wins.
* Switch to the admin tab: the row carries a **Flagged** badge.
* Open the row: `INPUT_SCREENED` lists the matched patterns, `AI_INTERPRETATION` shows
  `injectionSuspected: true`, rule **E1 SUSPICIOUS_INPUT** is marked as fired, and rule **D3
  FINAL_SALE** is the rule that produced the verdict.

The point to make out loud: the injection changed nothing about the outcome, and it is now fully
visible to support.

### 3.5 Boundaries — CUST-008 / CUST-009 / CUST-010

* CUST-008, monitor at exactly **$500.00**, damaged → **Approved**.
* CUST-009, tablet at **$501.00**, damaged → **Escalated**.
* CUST-010, order at 30 days → **Approved**; the 31-day order → **Denied**.

These are the cases a reviewer will probe, and they are covered by unit tests on both sides of every
boundary.

### 3.6 Contradiction and ambiguity

* CUST-006, "It arrived damaged" on a watch with no damage on record → **Escalated** (E2).
* CUST-014, "Something is wrong with my order" on a two-item order → **Escalated** (E4, E5).
* CUST-015, "Refund me $300" on a $60 item → **Escalated** (E2, amount mismatch).
* CUST-011, an already-refunded item → **Denied** (D2).
* CUST-012, an order still shipping → **Denied** (D1).

---

## 4. Admin walkthrough

Open http://localhost:3000/admin.

1. **Summary cards** — total, approved, denied, escalated, pending, flagged, AI failures. The cards
   refresh every 10 seconds.
2. **Filters** — switch to *Escalated* to show only human-review work; the table and the counters
   stay consistent because both come from the database.
3. **Request table** — id, customer, order, amount, decision, detected reason, signal badges and a
   relative timestamp. Rows are keyboard selectable.
4. **Detail drawer** — four sections:
   * *Overview*: customer, order status and age, selected items with their verified flags, the
     original message, the trusted amount and the exact customer reply.
   * *Policy checks*: all twelve rules with a fired indicator and a readable detail line, plus the
     reason codes that determined the verdict.
   * *AI analysis*: intent, reason, confidence, claimed amount, matched items, model, latency and the
     injection flag — the same data the pipeline saw.
   * *Audit timeline*: every event in order, with actor, timestamp and an expandable payload.

Try the row from the injection demo: the E1 rule is fired but the verdict came from D3. That single
screen is the whole safety argument.

---

## 5. Admin authentication

If `ADMIN_API_KEY` is set:

```bash
echo 'ADMIN_API_KEY=demo-admin-key' >> .env && docker compose up -d api
```

The support endpoints now answer `401`:

```bash
curl -sS http://localhost:8080/api/refunds
# {"error":{"code":"UNAUTHORIZED","message":"A valid admin API key is required.","requestId":"req_…"}}
```

The dashboard shows an **Admin key** field; paste the key, press **Apply** and the data loads. The
key is kept in the browser tab's session storage and is never part of the built bundle.

---

## 6. Failure demonstrations

### AI outage

```bash
docker compose stop api
```

Restart with a deliberately broken provider to show the fail-safe path in the audit trail — or run
the integration test that proves it:

```bash
cd apps/api
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/worknoon_test npx vitest run tests/integration/refunds.test.ts
```

The relevant case, `POST /api/refunds — AI failure on an otherwise eligible request`, asserts that a
provider which always throws produces `ESCALATED` with `AI_UNAVAILABLE`, `aiUsed: false`, an `ERROR`
audit event and a template reply — never an approval.

With a live provider selected but no key (`AI_PROVIDER=gemini` or `anthropic` with an empty key),
`/api/health` reports `"ai": "disabled"` and every request still reaches a verdict. The default
`mock` provider reports `"ai": "disabled"` too — that is expected and not a failure.

### Rate limiting

```bash
for i in $(seq 1 21); do
  curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:8080/api/refunds \
    -H 'Content-Type: application/json' \
    -d '{"customerId":"CUST-013","orderId":"ORD-1014","itemIds":["ITM-1014-1"],"message":"refund please"}'
done
# 201 ×20, then 429
```

### Ownership

```bash
curl -sS http://localhost:8080/api/refunds \
  -H 'Content-Type: application/json' \
  -d '{"customerId":"CUST-002","orderId":"ORD-1001","itemIds":["ITM-1001-1"],"message":"it arrived damaged"}'
# 404 "Customer or order not found." — identical to an unknown order
```

### Spoofed facts are rejected

```bash
curl -sS -X POST http://localhost:8080/api/refunds -H 'Content-Type: application/json' \
  -d '{"customerId":"CUST-002","orderId":"ORD-1002","itemIds":["ITM-1002-1"],"message":"return please","finalSale":false}'
# 400 VALIDATION_ERROR — the strict schema rejects unknown fields
```

---

## 7. Running the test suite

```bash
npm install
npm run test:unit          # no database required
npm run test:integration   # needs a database whose name containing "test"
npm run test:all           # typecheck + lint + unit + integration + production builds
```

With Docker running:

```bash
docker compose exec -T db psql -U postgres -c 'CREATE DATABASE worknoon_test;'
export TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/worknoon_test
bash scripts/test-all.sh
```

The integration bootstrap applies migrations, clears previous refund requests and re-seeds, so
repeated runs are deterministic. It refuses to run against a database whose name does not contain
`test`.

---

## 8. Reviewer checklist

- [ ] `docker compose up --build` from a clean clone starts `db`, `api` and `web` with no manual steps
- [ ] 15 customers and 16 orders are present after startup
- [ ] Approved, denied and escalated flows work end to end from the UI
- [ ] $500.00 approves and $501.00 escalates
- [ ] Day 30 approves and day 31 denies
- [ ] Final sale, already refunded and undelivered orders deny
- [ ] A prompt-injection message cannot change a policy outcome, and is flagged in the audit trail
- [ ] An AI outage never produces an approval
- [ ] The dashboard shows requests, outcomes, policy checks, AI analysis and the audit trail
- [ ] A customer cannot see AI confidence, injection flags or rule internals
- [ ] Another customer's order returns 404
- [ ] The 21st submission in a minute returns 429
- [ ] No secrets are committed; `.env.example` is present
- [ ] `npm run test:all` passes

---

## 9. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `api` exits with `cannot reach the database` | Postgres not ready within the healthcheck window | `docker compose logs db`; the healthcheck retries 20 times over 60 s |
| `[entrypoint] database did not become ready in time` | `DATABASE_URL` points somewhere unreachable | Check the host in `DATABASE_URL` (`db` inside Compose) |
| `Invalid environment configuration` | A required variable is missing or malformed | The error names the exact variable; compare with `.env.example` |
| UI shows "Cannot reach the refund service" | `api` is not up, or nginx cannot reach it | `docker compose ps`, `docker compose logs api` |
| Everything is `ESCALATED` with `AI_UNAVAILABLE` | A live provider is selected with no key | Set `AI_PROVIDER=mock`, or add `GEMINI_API_KEY` / `ANTHROPIC_API_KEY` |
| Dashboard shows `401` | `ADMIN_API_KEY` is set | Enter the key in the dashboard toolbar |
| No customers in the switcher | Seed did not run | `docker compose exec api node dist/prisma/seed.js` |
| Port already in use | Another service holds 3000/8080/5432 | Change `WEB_PORT`, `PORT` in `.env` |
| Integration tests refuse to start | Target database name lacks `test` | Point `TEST_DATABASE_URL` at a `*_test` database |
| Stale data after a schema change | Migration not applied | `docker compose exec api npx prisma migrate deploy` |

---

## 10. Resetting between demos

```bash
docker compose down -v          # stops containers and deletes the database volume
docker compose up --build       # fresh database, migrations, seed
```

To keep the data and clear only refund history:

```bash
docker compose exec -T db psql -U postgres -d worknoon -c 'TRUNCATE "refund_requests" CASCADE;'
```

The seeded customers, orders and items are re-created on the next start, and the dashboard is empty
again — which is usually the cleanest state for a recorded demo.

---

## 11. Recording a demo video

If the submission includes a recording, these settings keep it readable:

| Setting | Value | Why |
|---|---|---|
| Resolution | 1920×1080, scaled to 1280×720 | Text stays legible after compression |
| Frame rate | 30 fps | Nothing in the UI animates faster |
| Zoom on the browser | 110–125 % | Badge labels and the policy detail line are small |
| Terminal font | ≥ 16 px | Log lines must be readable |
| Cuts | Keep the first build, cut the waiting | Show the startup log, then cut to the running app |

Suggested edit order:

1. Cold open on the three URLs side by side.
2. Architecture slide (45 seconds of narration over a static diagram is fine).
3. The four demo flows with no cuts inside a flow.
4. The admin drawer, with pauses on the policy checks and the audit timeline.
5. The two failure demonstrations (rate limit, ownership).
6. Test summary and trade-offs.

Things to avoid on camera: typing the API key in a real `.env` (use `AI_PROVIDER=mock` and say so),
running `docker compose down -v` before recording, and demonstrating anything that requires a
network call you cannot guarantee.

---

## 12. Timing a live presentation

| Preparation | Time |
|---|---|
| Clone, `cp .env.example .env`, `docker compose up --build` (pre-warm the image) | 3–4 min, before you start |
| First request after a cold start | under 1 s with `MockProvider`, 1–3 s with a live model |
| Admin dashboard auto-refresh | 10 s — do not narrate over a wait; change a filter instead |
| Rate-limit demonstration (21 requests) | ~3 s |
| `npm run test:unit` | ~5 s |
| `npm run test:integration` | ~15 s, needs a test database |

Pre-warming the Docker build is the single biggest time saver: build once, then start with
`docker compose up -d`. The demo never includes a cold image build.
