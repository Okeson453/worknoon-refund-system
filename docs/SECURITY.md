# Security

Threat model, controls, and an explicit list of what this system does **not** protect against. The
goal is a reviewer being able to see, quickly, why a hostile customer cannot talk the system into
moving money.

---

## 1. Trust boundaries

```text
Internet / browser
        │  same-origin /api through nginx (CSP, TLS-terminating proxy in production)
        ▼
nginx  ── static assets, /api reverse proxy, security headers
        ▼
Express API  ── request id · rate limit · admin auth · Zod validation · error envelope
        ▼
Service layer ── ownership · sanitisation · injection screen · policy · AI
        ▼
PostgreSQL 16    ·  Anthropic Messages API
```

| Boundary | Control |
|---|---|
| Browser → nginx | Content-Security-Policy, `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Permissions-Policy` |
| nginx → API | Private network, fixed upstream `api:4000` |
| API → database | Parameterised Prisma queries, credentials from environment only |
| API → model | Sanitised text in a delimited block, no secrets, no contact data, forced output schema |
| Model → policy | One narrow `PolicySignals` object; no authority over the verdict |

---

## 2. Threat model

| Threat | Mitigation | Where |
|---|---|---|
| Prompt injection used to force an approval | Six-layer defence; the verdict comes only from the policy engine | `ai/`, `policy/` |
| Spoofed order facts (`finalSale: false`, fake amount) | The request schema is strict and accepts ids plus free text only; all facts are read from the database | `validation/refund.schemas.ts` |
| Refunding another customer's order | Ownership is part of the lookup; foreign orders return the same 404 as unknown ones | `database/repositories/order.repository.ts` |
| Model output steering the decision | Forced tool schema, enum-only fields, strict Zod, monotonic-safety property | `ai/schemas/`, `policy/` |
| Second-order injection through the reply | The composer never sees the raw customer text; output is verified against the verdict | `services/refund/refundDecision.ts` |
| XSS through a message or AI summary | React escaping only, no `dangerouslySetInnerHTML` anywhere, CSP on the container | `apps/web`, `apps/web/nginx.conf` |
| Cost or availability abuse | 20 submissions/minute/IP, 1000-character cap, 10 s AI timeout, one retry, 32 kB body cap | middleware and config |
| Duplicate refunds | Rule D2 re-checked inside the finalize transaction under `SELECT … FOR UPDATE` on the order row | `services/refund/createRefundRequest.ts` |
| Secret leakage | `.env` git-ignored, `.env.example` committed, pino redaction, keys never returned to the browser | repo config, `utils/logger.ts` |
| Information disclosure through errors | Central error handler returns a generic message plus a request id; stack traces stay in the log | `api/middleware/errorHandler.ts` |
| Unauthorised access to support data | Optional `ADMIN_API_KEY` bearer token, constant-time comparison | `api/middleware/adminAuth.ts` |
| Unauthorised admin actions | There are none: the API exposes exactly one write endpoint, and it is the customer submission | `api/routes/refunds.routes.ts` |

---

## 3. Input validation

Every request body and query string is parsed with Zod before a controller runs.

* **Strict objects.** Unknown properties are rejected, so a client cannot send `finalSale`,
  `refundAmountCents`, `status` or `decision` and have them considered.
* **Bounded identifiers.** 1–64 characters, `[A-Za-z0-9_-]+`, which rules out SQL metacharacters,
  path traversal and whitespace tricks without a denylist.
* **Bounded collections.** `itemIds` is 1–20 entries; a refund cannot be requested for an
  unbounded basket.
* **Bounded text.** `message` is 1–1000 characters after trimming.
* **Pagination.** `page ≥ 1`, `1 ≤ limit ≤ 100`, coerced from strings with integer validation.
* **Error feedback.** Field errors are returned as `{ path, message }` pairs with customer-safe
  wording; Zod internals are never leaked.

The 32 kB JSON body limit and the 1000-character message limit mean a single request cannot cost
meaningful parsing time or model tokens.

---

## 4. Authorisation and ownership

**Customer access is scoped by lookup, not by comparison.**
`findOrderForCustomer(customerId, orderId)` filters on both ids in one query. An order that belongs
to someone else produces the same `404 RESOURCE_NOT_FOUND` with the same message as an order that
does not exist, so ids cannot be enumerated. A selected item that is not part of the submitted order
is treated the same way.

**Admin access** is guarded by `adminAuth`, applied to the three support endpoints:

```text
ADMIN_API_KEY configured → Authorization: Bearer <key> required, compared with timingSafeEqual
ADMIN_API_KEY empty      → endpoints open (demo mode)
```

The key is entered by the operator in the dashboard and kept in `sessionStorage`, so it is not
baked into the JavaScript bundle and disappears when the tab closes. It is never sent anywhere
except the API.

**This is deliberately not identity management.** It fits the challenge scope and makes the demo
one command to run. A production deployment would replace the middleware with real session
verification; because exactly one middleware guards exactly three read endpoints, the change is
localised.

---

## 5. Prompt-injection defence

The full mechanism is documented in [`AI.md`](AI.md); the security-relevant summary:

| Layer | What it stops |
|---|---|
| Sanitisation | Control characters, zero-width characters, unicode tricks used to hide instructions |
| Heuristic screen | The common instruction-override, role-switch, policy-override and exfiltration families |
| Prompt structure | Customer text is quarantined inside `<customer_message>` tags and explicitly labelled untrusted |
| Constrained output | Forced tool use and a strict schema; unknown keys and impossible enum values are discarded |
| Authority separation | The model has no path to the verdict; every signal it can produce can only add caution |
| Output verification | The composed reply is compared with the verdict and replaced by a template on any contradiction |
| Audit | Matched pattern ids, the model flag and the full decision trail are stored for support |

The screen flags rather than blocks on purpose: blocked traffic disappears, flagged traffic is
visible to a human. The demo proves the important property — a hostile message against a final-sale
item is still denied by rule D3, the injection is recorded as a fired E1, and the admin list shows a
"Flagged" badge.

**Known weakness:** heuristics are bypassable and a model can be fooled. This is acceptable because
the blast radius of a fooled model is an unnecessary escalation, never an approval.

---

## 6. AI-specific controls

| Control | Implementation |
|---|---|
| Timeout | `AI_TIMEOUT_MS`, default 10 000 ms |
| Retry cap | Exactly one retry, exponential backoff, only on 429 / 5xx / timeout |
| Output validation | Strict Zod on both calls; a failure discards the output instead of coercing it |
| Item-id intersection | Model ids are intersected with the order's real ids; drops set the suspicious flag |
| Data minimisation | No contact details, no order totals, no other customers, no secrets reach the model |
| Composer isolation | Call 2 receives structured decision fields only, never the customer text |
| Deterministic fallback | Templates exist for all three verdicts; composition is never a correctness dependency |
| Failure semantics | An AI failure can only deny or escalate, never approve |
| Usage accounting | Token usage logged at `debug` with the model name |

---

## 7. Data protection

| Data | Stored | Logged | Returned to the browser |
|---|---|---|---|
| Customer name, email | yes | redacted | yes (synthetic demo data) |
| Phone | modelled | redacted | never |
| Customer message | yes (auditable) | never at info level | to the author, and to admins in the detail view |
| AI key | environment only | redacted | never |
| Refund amount | computed and stored | yes (integer cents) | yes |
| AI confidence / injection flag | yes | not at info level | admin detail only, never the customer response |
| Audit payloads | yes | no | admin detail only |

The customer-facing response contains exactly six fields and is asserted to contain no
`confidence`, no `injectionSuspected` and no `policyResult` by an integration test.

---

## 8. Transport and headers

**nginx** (`apps/web/nginx.conf`):

```text
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
  img-src 'self' data:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none';
  base-uri 'self'; form-action 'self'
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: no-referrer
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

`connect-src 'self'` is possible because the browser only ever talks to its own origin — nginx
proxies `/api`. There is no CORS configuration anywhere in the application, which is the point of
the same-origin design.

**Express** additionally sets `X-Content-Type-Options`, `X-Frame-Options` and `Referrer-Policy`, and
disables `x-powered-by`. TLS is terminated by the ingress in a real deployment; the application
speaks plain HTTP inside the Compose network.

**Secrets handling.** `.env` is git-ignored and `.env.example` is committed with empty values.
`scripts/verify-clean-clone.sh` fails if a `.env` file is present in the tree or if anything
matching `sk-ant-…` is committed. The API never echoes configuration back to a client, and
`GET /api/health` reports only provider name and state, never the model key or the configured model
credentials.

---

## 9. Frontend safety

* React escapes all interpolated text. There is no `dangerouslySetInnerHTML` and no direct DOM
  `innerHTML` assignment anywhere in `apps/web/src`; a unit test walks the web source tree and fails
  the build if one appears.
* The customer message, the AI summary and the audit payloads are all rendered as text nodes, so a
  payload containing `<script>` is displayed, not executed.
* Decision badges carry a glyph and a text label, never colour alone.
* The detail drawer is a real modal: `role="dialog"`, `aria-modal`, focus moved to the close button
  on open, `Escape` to dismiss, backdrop click to dismiss.
* The chat thread is an `aria-live` region so a screen reader announces new messages and decisions.

---

## 10. Rate limiting and availability

| Layer | Limit |
|---|---|
| `POST /api/refunds` | 20 requests / 60 s per IP, in-memory store, `RateLimit` headers |
| Message length | 1000 characters |
| Items per request | 20 |
| JSON body | 32 kB |
| AI call | 10 s timeout, one retry |
| Database | Prisma pool, 5 s transaction max wait, 10 s transaction timeout |

The rate limiter keys on the client IP and the app trusts exactly one proxy hop, which is correct for
the nginx container and documented in `app.ts`. In a deployment with more proxies in front, that
value must be reviewed.

The limiter is per process. With a single API container — the Compose topology — that is exact.
Horizontal scaling would need a shared store, which is noted as a known limitation.

---

## 11. Audit and forensics

Every state transition writes an immutable event with actor, summary, structured payload and
timestamp, in the same transaction as the change. Together with the `requestId` that is returned to
the customer in every error envelope and echoed in `X-Request-Id`, this gives a complete path:

```text
customer-visible request id
  → API log line (route, status, latency)
  → audit REQUEST_RECEIVED → INPUT_SCREENED
  → AI_INTERPRETATION (model, latency, dropped ids)
  → POLICY_EVALUATED (all twelve rules)
  → DECISION_MADE (verdict, amount, reason codes, signals)
  → AI_RESPONSE_GENERATED or AI_FALLBACK_USED
```

Audit payloads are deliberately small and free of contact details, so the trail is useful without
becoming a second copy of the customer data.

---

## 12. What is not covered

Stated plainly, because a security section that only lists strengths is not a threat model.

| Gap | Why | What production would need |
|---|---|---|
| No real authentication or authorisation for customers | Out of scope for the challenge; the switcher is labelled demo mode | OIDC or SAML session, per-customer scoping of every order lookup |
| Static admin token, open by default | Keeps the demo one command to run | Real identity, role-based access, secret rotation, audit of admin reads |
| No TLS inside the Compose network | Local demo | TLS everywhere, HSTS, encrypted volumes |
| No encryption at rest | Local demo | Volume encryption, database-level encryption for contact fields |
| Heuristic injection detection | Transparent and cheap; bypassable by design | Classification model as a second signal — still never the authority |
| No automated secret scanning in CI | Repository tooling | Secret scanning and dependency auditing in the pipeline |
| Rate limit is in-process | Single API container | Shared store (Redis) before scaling horizontally |
| No retention policy | Needs a business decision | Scheduled archival of `refund_requests` and `audit_events` together |
| No dependency pinning beyond the lockfile | — | Automated dependency updates and audit |

None of these gaps weakens the core property of the system: a hostile input cannot produce an
approval, because the approval path is a pure function over database facts.

---

## 13. Supply chain

| Control | Status |
|---|---|
| Lockfile committed | `package-lock.json` pins the full dependency tree |
| Direct dependencies | 7 for the API (`@anthropic-ai/sdk`, `@prisma/client`, `express`, `express-rate-limit`, `pino`, `pino-http`, `zod`, plus the workspace package), 3 for the web (`react`, `react-dom`, `react-router-dom`, plus the workspace package) |
| No runtime dependency on a template or UI framework | Hand-written CSS, hand-written fetch client |
| No postinstall scripts in production images | `npm ci --omit=dev --ignore-scripts` in the API runtime stage |
| Prisma engines | Downloaded by `prisma generate` at build time and baked into the image |
| Known advisories | Not tracked in-repo; a production pipeline should add `npm audit` and Dependabot |

The absence of a UI kit, a state library and a validation-on-the-client dependency is deliberate:
fewer packages means fewer transitive dependencies in the path that handles customer text.

---

## 14. Verification commands

Run these before a review; together they demonstrate most of the claims above.

```bash
# 1. No unescaped HTML anywhere in the client
grep -rn "dangerouslySetInnerHTML\|innerHTML *=" apps/web/src || echo "clean"

# 2. The policy engine imports no infrastructure
grep -rn "^import" apps/api/src/policy | grep -Ev "shared-types|'\.\./|'\./" || echo "clean"

# 3. No secrets committed
bash scripts/verify-clean-clone.sh

# 4. The customer response exposes nothing internal
grep -n "customer-safe\|CreateRefundResponse" apps/api/src/services/refund/createRefundRequest.ts

# 5. Full verification: typecheck, lint, unit, integration, builds
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/worknoon_test bash scripts/test-all.sh
```

The corresponding automated guards live in the test suite:

| Claim | Test |
|---|---|
| No unescaped HTML in the web client | `tests/unit/security/xssRendering.test.ts` |
| Customer response has no internal fields | `tests/integration/refunds.test.ts` → *never leaks internal reasoning* |
| Ownership is enforced | `tests/unit/security/ownership.test.ts` and the cross-customer 404 integration test |
| Injection cannot change a verdict | `tests/unit/security/promptInjection.test.ts` and the CUST-013 integration case |
| Rate limit is enforced | `tests/unit/security/rateLimit.test.ts` and the 21-request integration case |
| Policy is safe under adversarial signals | `tests/unit/policy/monotonicSafety.test.ts` |

---

## 15. Security review checklist

- [ ] `POST /api/refunds` rejects unknown body fields (strict schema)
- [ ] A foreign order returns the same 404 as a missing order
- [ ] A selected item must belong to the submitted order
- [ ] Messages longer than 1000 characters are rejected before any AI call
- [ ] More than 20 items is rejected
- [ ] The 21st submission in a minute returns 429 with the error envelope
- [ ] The refund amount comes from the database, never from the request
- [ ] Duplicate refunds are blocked by the locked re-check, not only by the first read
- [ ] The customer response contains no confidence, no injection flag, no rule internals
- [ ] AI output that fails schema validation is discarded, not coerced
- [ ] The composer cannot see the customer message
- [ ] A composer draft that contradicts the verdict is replaced by a template
- [ ] An AI outage produces escalation, never approval
- [ ] Admin endpoints reject a missing or wrong bearer token when one is configured
- [ ] Error responses never include a stack trace or a driver message
- [ ] Logs redact authorization headers, cookies, API keys, emails and phone numbers
- [ ] The web container sets a Content-Security-Policy that forbids inline scripts
- [ ] No `.env` file and no `sk-ant-…` pattern exists in the repository
- [ ] Audit events are append-only and carry no contact details
