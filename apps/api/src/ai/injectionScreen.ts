/**
 * Layer 2 of the prompt-injection defense (spec §20): a transparent heuristic screen.
 * A hit never blocks the request — it records a flag that the policy engine turns into E1,
 * so hostile traffic still reaches the audit trail instead of disappearing.
 */

export interface InjectionPattern {
  readonly id: string;
  readonly pattern: RegExp;
  readonly label: string;
}

export const INJECTION_PATTERNS: readonly InjectionPattern[] = [
  { id: 'ignore-instructions', pattern: /\bignore\s+(?:all\s+|any\s+)?(?:the\s+)?(?:previous|prior|above|earlier|preceding)\s+(?:instructions?|prompts?|rules?|commands?)/i, label: 'instruction override' },
  { id: 'disregard-instructions', pattern: /\b(?:disregard|forget|erase)\s+(?:all\s+|any\s+)?(?:the\s+|these\s+)?(?:previous|prior|above|earlier|preceding)\s+(?:instructions?|prompts?|rules?|commands?)/i, label: 'instruction override' },
  { id: 'system-prompt', pattern: /\b(?:system\s+prompt|system\s+message|developer\s+message|initial\s+instructions?)\b/i, label: 'system prompt reference' },
  { id: 'role-switch', pattern: /\byou\s+are\s+now\b|\bact\s+as\s+(?:an?\s+)?(?:admin|agent|support|system|ai|assistant)\b|\bpretend\s+to\s+be\b/i, label: 'role switch attempt' },
  { id: 'policy-override', pattern: /\b(?:override|bypass|ignore|disable|turn\s+off)\s+(?:the\s+|your\s+)?(?:policy|policies|rule|rules|guardrail|guardrails|restriction|restrictions)\b/i, label: 'policy override attempt' },
  { id: 'self-approval', pattern: /\b(?:approve|authorize|authorise|process|release|issue)\s+(?:my|our|this|the)\s+(?:refund|return|payment|money|request)\b|\bapprove\s+me\b/i, label: 'self approval attempt' },
  { id: 'role-marker', pattern: /(?:^|\n)\s*(?:system|assistant|developer|human|user)\s*:\s*/i, label: 'chat role marker' },
  { id: 'fake-tag', pattern: /<\/?(?:system|instructions?|assistant|human|important_instructions?|admin)\b[^>]*>/i, label: 'fake instruction tag' },
  { id: 'tag-breakout', pattern: /<\/?(?:customer_message|order|item)\b[^>]*>/i, label: 'prompt delimiter spoofing' },
  { id: 'json-override', pattern: /"?injectionSuspected"?\s*:\s*false|"?decision"?\s*:\s*"APPROVED"/i, label: 'output field spoofing' },
  { id: 'jailbreak', pattern: /\b(?:dan mode|developer mode|jailbreak|do\s+anything\s+now)\b/i, label: 'jailbreak phrase' },
  { id: 'exfiltration', pattern: /\b(?:reveal|print|repeat|show|output|share)\s+(?:me\s+)?(?:your\s+|the\s+|these\s+|all\s+)*(?:system\s+)?(?:prompt|instructions?|rules?|guidelines)\b/i, label: 'prompt exfiltration attempt' },
] as const;

export interface InjectionScreenResult {
  suspicious: boolean;
  matchedPatternIds: string[];
  labels: string[];
}

export function screenForInjection(message: string): InjectionScreenResult {
  const matchedPatternIds: string[] = [];
  const labels: string[] = [];
  for (const { id, pattern, label } of INJECTION_PATTERNS) {
    if (pattern.test(message)) {
      matchedPatternIds.push(id);
      labels.push(label);
    }
  }
  return { suspicious: matchedPatternIds.length > 0, matchedPatternIds, labels };
}
