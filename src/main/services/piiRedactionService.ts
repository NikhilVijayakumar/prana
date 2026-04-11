/**
 * PII Redaction Service - Text-Based Pattern Matching
 *
 * Applies regex-based redaction for common PII patterns (SSN, credit cards,
 * phone numbers, email addresses) at ingestion time. Binary/image PII
 * redaction (OCR + blur) is deferred to a future milestone.
 */

interface PiiPattern {
  name: string;
  pattern: RegExp;
  replacement: string;
}

const PII_PATTERNS: PiiPattern[] = [
  {
    name: 'SSN',
    pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
    replacement: '[SSN-REDACTED]',
  },
  {
    name: 'CreditCard',
    pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
    replacement: '[CC-REDACTED]',
  },
  {
    name: 'PhoneUS',
    pattern: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    replacement: '[PHONE-REDACTED]',
  },
  {
    name: 'Email',
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    replacement: '[EMAIL-REDACTED]',
  },
];

/**
 * Redact PII from a text string by replacing all matched patterns.
 */
export const redactPii = (text: string): string => {
  let result = text;
  for (const entry of PII_PATTERNS) {
    result = result.replace(entry.pattern, entry.replacement);
  }
  return result;
};

/**
 * Check whether a text string contains any PII patterns.
 */
export const containsPii = (text: string): boolean => {
  return PII_PATTERNS.some((entry) => {
    // Reset lastIndex since patterns use the global flag
    entry.pattern.lastIndex = 0;
    return entry.pattern.test(text);
  });
};
