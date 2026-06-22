/**
 * Sanitization utilities.
 * All LLM output and user-supplied HTML MUST pass through sanitize()
 * before being injected into the DOM.
 *
 * Uses DOMPurify with a strict allowlist.
 * dangerouslySetInnerHTML is the ONLY acceptable injection point,
 * and only after sanitize() has been called.
 */

import DOMPurify from 'dompurify';

const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'em', 'b', 'i', 'u', 's',
  'ul', 'ol', 'li',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'blockquote', 'hr', 'code', 'pre', 'table',
  'thead', 'tbody', 'tr', 'th', 'td',
  'span', 'div', 'section', 'article',
];

const ALLOWED_ATTR = ['class', 'id', 'aria-label', 'role'];

/**
 * Sanitize HTML string. Use for LLM-rendered Markdown output.
 * Returns safe HTML string — safe to pass to dangerouslySetInnerHTML.
 */
export function sanitize(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    FORBID_ATTR: ['style', 'onerror', 'onload', 'onclick', 'onmouseover'],
    FORBID_TAGS: ['script', 'object', 'embed', 'form', 'input', 'iframe', 'link', 'meta'],
    ALLOW_DATA_ATTR: false,
    FORCE_BODY: false,
  });
}

/**
 * Strip ALL HTML — returns plaintext only.
 * Use for user-supplied names, labels, and form fields.
 */
export function stripHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
}

/**
 * Sanitize a string for safe display as text content (not HTML).
 * Escapes special characters so the string renders literally.
 */
export function escapeText(str: string): string {
  return str
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#x27;');
}
