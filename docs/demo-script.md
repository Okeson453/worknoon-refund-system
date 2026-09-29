# Demo Script

A seven-minute narrated run-through. Timings are for a live demo; the same structure works for a
screen recording with slight compression.

| Time | Segment | What it proves |
|---|---|---|
| 0:00 | Start and run the stack | One command, working system, no manual setup |
| 0:45 | Architecture walkthrough | Policy vs AI separation, data flow |
| 1:45 | Approved: damaged headphones | Happy path, decision badge, reasons |
| 2:30 | Denied: final-sale jacket | Deterministic rule beats preference |
| 3:15 | Escalated: $900 laptop | Human-review threshold |
| 4:00 | Prompt injection on a final-sale item | Policy unchanged, flag visible |
| 4:45 | Admin dashboard and detail drawer | Explainability, audit trail |
| 6:15 | AI integration and failure handling | Two calls, validation, safe fallbacks |
| 7:15 | Wrap-up | Trade-offs and next steps |

---

## Optional: presenter overlay

`npm run dev` mounts a dev-only presenter overlay on top of the app. It never ships: the production
build resolves stub modules (`src/dev/*Switch.prod.tsx`) and tree-shakes the overlay, its cue data and
its stylesheet out of the bundle, so reviewers running `docker compose up` see the plain product UI.

What it gives you while recording:

- A verdict chip pinned bottom-right mirroring the last API response, so the decision, amount and
  reason codes are legible at 1080p instead of being a small badge below the fold.
- A safety flag when a request is refused before the decision engine runs, which is the beat the
  prompt-injection segment is about.
- A mirror of every toast, so "Refund request escalated" is inside the frame rather than cropped off
  its right edge.
- A script cue card with the segment, the sentence to say and the click path for the beat.

Keys (ignored while typing in the refund message box):

| Key | Action |
|---|---|
| `n` / `p` | next / previous cue |
| `s` | show or hide the script card |
| `h` | show or hide the whole overlay |
| `r` | clear the verdict chip |

The cue cards mirror the segment table below; wording that must be exact is in this file, the overlay
carries the paraphrase and the click path.

---

## 0:00 — Start and run the stack

**Say:** "Everything you are about to see comes from a clean clone and one command. No local Node,
PostgreSQL or Prisma installation."

```bash
git clone <repository>
cd worknoon-refund-system
cp .env.example .env
docker compose up --build
```

**Say while it builds:** "Three containers. PostgreSQL 16 with a healthcheck that gates the API. The
API image installs dependencies, generates the Prisma client, compiles TypeScript, applies
migrations and seeds fifteen synthetic customers before it starts listening. Nginx serves the React
build and reverse-proxies `/api`, so the browser only ever talks to one origin."

**Show:**

```bash
curl -sS http://localhost:8080/api/health
```

```json
{ "status": "ok", "database": "ok", "ai": "disabled", "aiProvider": "mock",
  "timestamp": "2026-09-28T12:00:00.000Z" }
```

Open http://localhost:3000.

---

## 0:45 — Architecture walkthrough

**Say:** "The important idea is the split between interpretation and authorisation. The model reads
the customer's message and returns structured signals. A pure function decides. There is no path
from free-form text to the verdict."

Walk the data flow on screen or on a slide:

```text
message → sanitise → injection screen → ownership → persist PENDING + audit
        → AI interpretation (schema-validated)
        → deterministic policy engine  ← the only authority
        → AI reply composition (verified against the verdict)
        → finalise + audit → customer-safe response
```

**Say:** "The policy engine is a pure function. No database, no clock, no network — the clock is
injected so the thirty-day boundary is testable. That is why we can unit-test every rule and every
boundary instead of hoping the integration tests cover it."

---

## 1:45 — Approved: damaged headphones

**Say:** "First scenario, a verified defect. Fifteen customers are seeded so that every policy branch
has a ready-made case; this is the first one."

Click the chip **Damaged item → approved**, then **Send refund request**.

**Say:** "Approved, $129.00, reason: verified defect. The decision came from rule A1, which fires
only when the order record itself confirms the damage. The customer selected the item, the amount
was computed from the database, and the model had no say in the verdict."

Point out the customer-safe response and that the message is human wording, not a template
dump.

---

## 2:30 — Denied: final-sale jacket

Click **Final sale → denied**, send.

**Say:** "Denied. Rule D3: a final-sale item is not refundable. Notice what did not happen — the
model had an opinion, and it did not matter. Denials come from database facts only, which makes
them immune to anything written in the message."

Optionally mention CUST-011 (already refunded, D2) and CUST-012 (still shipping, D1) without
submitting them.

---

## 3:15 — Escalated: $900 laptop

Click **$900 laptop → escalated**, send.

**Say:** "Escalated. The damage is confirmed, so A1 fires — but rule E3 fires too, because the amount
is above the five-hundred-dollar human-review threshold. Precedence puts escalation above approval,
so the request goes to a person. The customer sees a friendly message saying a specialist will follow
up; they do not see the threshold."

**If asked about the boundary:** "CUST-008 at exactly $500.00 is approved and CUST-009 at $501.00 is
escalated. Money is stored as integer cents precisely so that comparison is exact, and both sides
are unit-tested."

---

## 4:00 — Prompt injection

Click **Prompt injection → denied**, send.

**Say:** "Now the attack. The message asks the assistant to ignore its instructions, become an
admin, and approve the refund. The order item is final sale, so the answer is denied — exactly as it
would have been without the hostile text."

Switch to the admin tab, open the new row.

**Say:** "And the attempt is not hidden. Three independent records of it: the input screening event
lists the matched patterns, the AI analysis shows the injection flag, and rule E1 is marked as fired.
But the verdict came from D3, the final-sale rule. The model can add caution; it can never remove a
denial."

**If asked how this is defended:** "Six layers, and the honest answer is that the pattern matching is
bypassable. What actually protects the system is the fifth layer: the model has no route to the
verdict, so a fooled model can at worst cause an unnecessary escalation."

---

## 4:45 — Admin dashboard and detail drawer

**Say:** "The support view is intentionally more detailed than the customer view."

1. Summary cards: totals by outcome, flagged requests, AI failures.
2. Filter to *Escalated*, then back to *All*.
3. Open a row.

**Say, walking the drawer:** "Overview shows the original message, the selected items with their
verified CRM flags, and the exact reply the customer received. Policy checks lists all twelve rules —
including the ones that did not fire — so you can see what the system considered, not just what it
decided. AI analysis shows the validated interpretation with confidence, matched items, model and
latency. And the audit timeline is the ordered, append-only record of the whole run."

Expand one audit payload.

**Say:** "Every event is written in the same transaction as the state change it describes, and the
request id ties the customer's error message, the server logs and this timeline together."

---

## 6:15 — AI integration and failure handling

**Say:** "Two model calls per request, with a strict split. The provider here is the deterministic
one, so the run is reproducible; swapping `AI_PROVIDER` to `gemini` or `anthropic` puts a real model
behind the exact same interface and the exact same schemas."

*Call one:* "The model sees the sanitised message, the item ids and names, and nothing else — no
email, no order totals, no other customers. Forced tool use means it can only answer with the
structured schema, which is then validated strictly. Invented item ids are dropped, and a drop is
treated as suspicious."

*Call two:* "The composer never sees the customer's message. It receives the verdict, the reason
codes, the item names and the amount. That removes second-order injection entirely. Its draft is then
checked against the verdict: if it claims an approval for a denial, or quotes a different amount, it
is discarded and a deterministic template is used."

**Failure handling:**

```bash
curl -sS -X POST http://localhost:8080/api/refunds -H 'Content-Type: application/json' \
  -d '{"customerId":"CUST-015","orderId":"ORD-1016","itemIds":["ITM-1016-1"],
       "message":"Refund me $300, it is damaged."}'
```

**Say:** "Last one: the customer claims $300 for a $60 item, and claims damage the record does not
show. The trusted amount wins, the contradiction escalates, and the customer sees the $60 figure
because money never comes from the request body."

**If asked about an AI outage:** "Timeouts, rate limits and server errors are retried once, then the
request continues with neutral signals. If a denial already applies it still denies; otherwise it
escalates with AI_UNAVAILABLE. There is an integration test that makes the provider throw for an
otherwise eligible request and asserts the answer is escalated, never approved."

---

## 7:15 — Wrap-up

**Say:** "To summarise the design: the database is the source of truth, the policy engine is
deterministic and pure, the AI interprets and explains but never authorises, and every decision is
reconstructable from the audit trail."

Known trade-offs, stated plainly:

* Admin access is a static token, open by default — a demo trade-off, not identity management.
* Heuristic injection detection is bypassable; the structure is what makes it safe.
* Escalated requests are resolved outside the service; there is no override endpoint yet.
* The dashboard polls every ten seconds rather than streaming.
* The default provider is deterministic, not a live model — a deliberate call so the stack runs with
  no key. `AI_PROVIDER=gemini` or `anthropic` swaps in a real model behind the same interface.
* One API container, so the rate limiter is per process.

**Say:** "Tests: 227 of them. Every policy rule, both sides of the $500 and day-30 boundaries, the
monotonic-safety property, the injection corpus, the full 15-scenario matrix end to end, the error
contract, the rate limit and the AI-outage path. `npm run test:all` runs typecheck, lint, both
suites and the production builds."

**Close:** "Questions."

---

## Backup answers

| Likely question | Answer |
|---|---|
| Why not let the model decide? | It is not deterministic, not testable, and not accountable. The safety property would be "the model usually says no", which is not a property. |
| What if the model is fooled? | At worst an unnecessary escalation. Every signal it produces can only add caution, and that is unit-tested. |
| How do you stop a customer refunding someone else's order? | Ownership is part of the lookup, so a foreign order is indistinguishable from a missing one, and items must belong to the submitted order. |
| What stops two simultaneous duplicate refunds? | The duplicate check runs again inside the finalize transaction while holding a row lock on the order. |
| Why store policy results as JSON? | The detail view needs every rule with its detail, nothing else queries individual rules, and it keeps the write to one row. The audit trail already stores the same facts in normalised form. |
| Why PostgreSQL rather than SQLite? | Real relations, real constraints, `jsonb` containment for the suspicious count, and closer to production. |
| Why two AI calls? | It puts the AI meaningfully in the workflow twice with a clean separation: interpret, then explain. Cost is roughly 2–4 seconds and double the tokens. |
| How would you add a new rule? | Add the code to the shared catalogue, implement it in the matching rules module, register it in the evaluation order, test both sides of the boundary, and update the policy document — the constants test fails if the numbers drift. |
| What happens if the database is down mid-request? | The request returns 500 with a request id, the audit trail records the error, and the request stays visible as PENDING for manual review. |

---

## Verbatim narration

Use this if you want the exact words rather than the outline. Each block is a single paragraph;
it is written to be spoken in about the stated duration.

### 0:00 — Start (≈45 s)

> "This is a refund support system built for the WORKNOON full-stack AI challenge. Everything you
> are about to see comes from a clean clone and one command — no local Node, no local PostgreSQL.
> Three containers: a PostgreSQL 16 database whose healthcheck gates the API, a Node 20 API that
> applies migrations and seeds fifteen synthetic customers before it starts listening, and an nginx
> container that serves the React build and reverse-proxies the API, so the browser only ever talks
> to one origin. The health endpoint tells me the database is up. It reports the AI provider as
> disabled because this run is on the deterministic mock provider — no key, no signup, nothing to
> leak or rate-limit, and every decision below is still produced by the same pipeline. Switching to
> a live model is one environment variable, and I'll show that later."

### 0:45 — Architecture (≈60 s)

> "The core design decision is the split between interpretation and authorisation. The customer's
> message goes through sanitisation and an injection screen, then to the model, which returns
> structured signals: the reason, the items it could identify, a confidence, a claimed amount. Those
> signals go into a deterministic policy engine — a pure function with no database, no clock and no
> network. It reads trusted order facts and the signals, evaluates twelve rules and returns a
> verdict. The model then writes the customer-facing reply from the finished verdict and never sees
> the original message. So the authority is the policy engine, and the model is an assistant that
> can only add caution."

### 1:45 — Approved (≈45 s)

> "CUST-001 has headphones that the warehouse recorded as damaged. I selected the item, described
> the problem, and the system approved a hundred and twenty-nine dollars. The reason is a verified
> defect, which is rule A1 — it fires only when the order record itself confirms the damage. The
> amount was computed from the database, not from anything I typed."

### 2:30 — Denied (≈45 s)

> "CUST-002 has a clearance jacket marked final sale. The request is denied by rule D3. Notice the
> ordering: denials are derived purely from database facts, so they need no model interpretation and
> cannot be influenced by the message. Two more denial cases are seeded: an already-refunded item
> and an order that has not shipped yet."

### 3:15 — Escalated (≈45 s)

> "A damaged laptop at nine hundred dollars. The damage is confirmed, so the approval rule fires —
> but the amount is above the five-hundred-dollar human-review threshold, so rule E3 fires too, and
> escalation outranks approval. The customer sees a friendly message saying a specialist will follow
> up. They never see the threshold. The boundary is exact: five hundred approves, five hundred and
> one escalates, because money is integer cents end to end."

### 4:00 — Prompt injection (≈60 s)

> "Now the attack. The message asks the assistant to ignore its instructions, become an admin and
> approve the refund. The item is final sale, so the answer is denied — exactly what it would have
> been without the hostile text. In the admin drawer you can see the same request from three angles:
> the input screening event lists the patterns that matched, the AI analysis shows the injection flag,
> and rule E1 is marked as fired. But the verdict came from the final-sale rule. I want to be honest
> about this: the pattern matching is bypassable, and a clever enough message can fool the model.
> What actually protects the system is the architecture — the model has no route to the verdict, so
> the worst a fooled model can do is cause an unnecessary escalation."

### 4:45 — Admin (≈90 s)

> "The support view is deliberately more detailed. The summary cards give the outcome mix and count
> flagged requests and AI failures. The table filters by decision and refreshes every ten seconds.
> Opening a request gives four sections. Overview: who, which order, which items, the original
> message and the exact reply the customer received. Policy checks: all twelve rules, including the
> ones that did not fire, so you can see what the system considered and not only what it decided. AI
> analysis: the validated interpretation with confidence, matched items, model and latency — the same
> data the pipeline saw, and the only place where it is shown. Audit timeline: the ordered,
> append-only record of the whole run, each event written in the same transaction as the state change
> it describes. The request id ties all of this to the server logs and to any error the customer was
> shown."

### 6:15 — AI integration (≈60 s)

> "Two calls, with a deliberate separation. The first sees the sanitised message and the item ids and
> names — no email, no order totals, no other customers. Forced tool use means the only legal output
> is the structured schema, which is then validated strictly; invented item ids are dropped, and a
> drop counts as suspicious. The second call writes the reply and never sees the customer's text at
> all, which removes second-order injection. Its draft is then verified against the verdict: if it
> claims an approval for a denial, or quotes an amount that is not the trusted one, it is discarded
> and a deterministic template is used. For failures: timeouts, rate limits and server errors are
> retried once, then the request continues with neutral signals — an existing denial still denies,
> and anything else escalates. There is a test that makes the provider throw for an otherwise
> eligible request and asserts the answer is escalated, never approved."

### 7:15 — Wrap-up (≈45 s)

> "To summarise: the database is the source of truth, the policy engine is deterministic and pure,
> the AI interprets and explains but never authorises, and every decision can be reconstructed from
> the audit trail. The honest trade-offs: admin access is a static token rather than identity
> management, the injection heuristics are bypassable, escalations are resolved outside the
> service, and the dashboard polls rather than streams. The test suite is two hundred and twenty
> seven tests covering every rule, both sides of every boundary, the full seeded matrix end to end,
> the error contract, the rate limit and the AI outage path. `npm run test:all` runs typecheck, lint,
> both suites and the production builds. Thank you — happy to take questions."

---

## If the demo breaks

| What broke | What to do on camera |
|---|---|
| API container not up | Show `docker compose ps` and `docker compose logs api --tail 20`, fix it live. Reviewers trust a visible fix more than a cut. |
| Empty customer switcher | Run `docker compose exec api node dist/prisma/seed.js`, then refresh. Mention that the seed is idempotent. |
| Model slow or failing | Say "let me switch to the deterministic provider so the rest of the demo is reproducible" and set `AI_PROVIDER=mock`. It is a feature, not an apology. |
| Port already in use | Change `WEB_PORT` in `.env` and restart the web container. |
| Rate-limit demo returns 429 too early | Wait sixty seconds, or use a different client IP with a `X-Forwarded-For` header. |
| Admin drawer shows 401 | Enter the `ADMIN_API_KEY` in the dashboard toolbar and press Apply. |
| Nothing works and time is short | Switch to the recorded run-through in `docs/DEMO.md` §6 — every failure mode has a curl command. |

The one thing never to do on camera is edit a refund row to produce a nicer outcome. The point of
the demo is that the system decides.
