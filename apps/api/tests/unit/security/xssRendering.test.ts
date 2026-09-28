import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isPlainTextSafe, sanitizeMessage } from '../../../src/utils/sanitize';

function collectSourceFiles(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory)) {
    const full = join(directory, entry);
    if (statSync(full).isDirectory()) files.push(...collectSourceFiles(full));
    else if (/\.(ts|tsx)$/.test(entry)) files.push(full);
  }
  return files;
}

describe('input sanitization', () => {
  it('strips zero-width and control characters', () => {
    const result = sanitizeMessage('he\u200bllo\u0007 world');
    expect(result.value).toBe('hello world');
    expect(result.removedCharacters).toBe(2);
    expect(result.changed).toBe(true);
  });

  it('normalizes unicode and collapses whitespace', () => {
    const result = sanitizeMessage('  My   headphones \uFF21 arrived  ');
    expect(result.value).toBe('My headphones A arrived');
    expect(result.normalized).toBe(true);
  });

  it('truncates to the maximum length', () => {
    expect(sanitizeMessage('a'.repeat(1500), { maxLength: 1000 }).value).toHaveLength(1000);
  });

  it('leaves an ordinary message untouched', () => {
    const result = sanitizeMessage('My headphones arrived damaged.');
    expect(result.changed).toBe(false);
    expect(isPlainTextSafe(result.value)).toBe(true);
  });

  it('keeps the text as data rather than markup', () => {
    const result = sanitizeMessage('<script>alert(1)</script>');
    // The API returns customer and model text verbatim; escaping happens in React.
    expect(result.value).toBe('<script>alert(1)</script>');
    expect(isPlainTextSafe(result.value)).toBe(true);
  });
});

describe('web client escaping', () => {
  const webSourceRoot = resolve(__dirname, '../../../../web/src');

  it('never renders untrusted text as HTML', () => {
    const offenders = collectSourceFiles(webSourceRoot).filter((file) => {
      const source = readFileSync(file, 'utf8');
      return source.includes('dangerouslySetInnerHTML') || /innerHTML\s*=/.test(source);
    });
    expect(offenders).toEqual([]);
  });

  it('renders customer and model text through JSX interpolation only', () => {
    const source = collectSourceFiles(webSourceRoot).map((file) => readFileSync(file, 'utf8')).join('\n');
    // Message bubbles, the decision banner and the audit payload are interpolated as text nodes.
    expect(source).toContain('{entry.text}');
    expect(source).toContain('{result.customerMessage}');
    expect(source).toContain('{json}');
  });
});
