/**
 * Cue cards for the recorded walkthrough. Dev-only.
 *
 * `time` and `title` mirror the segment table in docs/demo-script.md so the overlay and the written
 * script cannot drift apart. `say` is the paraphrase of that script's opening line — enough to keep
 * the presenter on track without reading an essay on camera. Wording that must be exact (for example
 * one sentence per narration block) should still be delivered from docs/demo-script.md.
 *
 * `do` is the click path for the segment. Prefilling from the "Demo scenarios" chips is deliberate:
 * it removes typing from the recording and makes the beats reproducible.
 */

export interface Cue {
  id: string;
  time: string;
  title: string;
  proves: string;
  say: string;
  do: string[];
}

export const CUES: readonly Cue[] = [
  {
    id: 'start',
    time: '0:00',
    title: 'Start and run the stack',
    proves: 'One command, working system, no manual setup',
    say:
      'Everything you are about to see comes from a clean clone and one command. No local Node, ' +
      'PostgreSQL or Prisma installation. Three containers: PostgreSQL gated by a healthcheck, the API ' +
      'which migrates and seeds before it listens, and nginx serving the React build and proxying /api, ' +
      'so the browser only ever talks to one origin.',
    do: [
      'Show the terminal that ran `docker compose up --build`.',
      'Point at the header health pill: it polls /api/health through nginx, so green means web, proxy, API and database are all up.',
      'Say the AI pill reads "disabled" because the default provider is mock, which is what makes a clean clone work with no key.',
    ],
  },
  {
    id: 'architecture',
    time: '0:45',
    title: 'Architecture walkthrough',
    proves: 'Policy vs AI separation, data flow',
    say:
      'The AI reads the message and explains the outcome. It never decides. Two calls: one interprets, ' +
      'one composes. Between them sits a deterministic policy engine fed only by trusted database facts, ' +
      'and the decision, the reason codes and the audit row all come from that engine.',
    do: [
      'Walk the flow: browser to nginx to API to policy engine, with the AI next to it, not in it.',
      'Say the trade-off out loud: one service, three deployables, typed boundary through shared-types.',
    ],
  },
  {
    id: 'approved',
    time: '1:45',
    title: 'Approved: damaged headphones',
    proves: 'Happy path, decision badge, reasons',
    say: 'Straightforward case. The order record verifies the damage, so the policy approves it.',
    do: [
      'Click the "Damaged item → approved" scenario chip.',
      'Press Submit and let the decision land in the verdict chip.',
    ],
  },
  {
    id: 'denied',
    time: '2:30',
    title: 'Denied: final-sale jacket',
    proves: 'Deterministic rule beats preference',
    say: 'The customer asks politely. The item is final sale. Politeness is not a policy exception.',
    do: [
      'Click "Final sale → denied", Submit.',
      'Note the reason code: the rule matched, not the model.',
    ],
  },
  {
    id: 'escalated',
    time: '3:15',
    title: 'Escalated: $900 laptop',
    proves: 'Human-review threshold',
    say: 'Same defect as the first case, but above five hundred dollars, so a human decides.',
    do: [
      'Click "$900 laptop → escalated", Submit.',
      'The verdict chip shows ESCALATED and the threshold reason. The escalation banner is lower on this page.',
    ],
  },
  {
    id: 'injection',
    time: '4:00',
    title: 'Prompt injection on a final-sale item',
    proves: 'Policy unchanged, flag visible',
    say:
      'This is the interesting one. The customer message contains an instruction override. It never ' +
      'reaches the decision engine as an instruction: it is screened before the model sees it, flagged, ' +
      'and the final-sale rule still denies the refund.',
    do: [
      'Click "Prompt injection → denied", then read the message out loud before submitting.',
      'Submit. The cyan-tinted ASIDE card under the chat shows the adversarial input alongside the screened copy.',
      'The verdict chip shows DENIED with the injection reason code, and the safety flag appears above it.',
    ],
  },
  {
    id: 'admin',
    time: '4:45',
    title: 'Admin dashboard and detail drawer',
    proves: 'Explainability, audit trail',
    say:
      'Every decision has an audit trail: what the model returned, what the policy saw, and which layer ' +
      'produced the outcome. The queued items are the escalated ones, where the human is the decision maker.',
    do: [
      'Switch to Support. Note the counters.',
      'Open the escalated request from the last beat and walk the drawer.',
    ],
  },
  {
    id: 'ai',
    time: '6:15',
    title: 'AI integration and failure handling',
    proves: 'Two calls, validation, safe fallbacks',
    say:
      'The provider is an interface. Mock is the default so the repo runs with no key, Gemini is one env ' +
      'var away on its free tier, and Anthropic is supported. If the model is unavailable or returns ' +
      'something that fails schema validation, the request still gets a decision, with AI_FAILURE recorded.',
    do: [
      'Show the health output with the ai field.',
      'Name what happens on a retry-exhausted or malformed response: fallback, never a broken request.',
    ],
  },
  {
    id: 'wrap',
    time: '7:15',
    title: 'Wrap-up',
    proves: 'Trade-offs and next steps',
    say:
      'What I would do next: real authentication on the support endpoints, idempotency keys on refunds, ' +
      'and moving the policy table out of code so it can be changed without a deploy.',
    do: ['Land the three trade-offs, then stop talking.'],
  },
];
