/**
 * Safe HTML sanitizer wrapper.
 * Always use this before rendering any LLM or user-generated content as HTML.
 * DOMPurify is configured to a minimal safe subset.
 */
import DOMPurify from 'dompurify';

const purifyConfig: DOMPurify.Config = {
  ALLOWED_TAGS: [
    'p', 'br', 'strong', 'em', 'b', 'i', 'u', 's',
    'ul', 'ol', 'li',
    'h1', 'h2', 'h3', 'h4',
    'blockquote', 'code', 'pre',
    'hr', 'span',
  ],
  ALLOWED_ATTR: ['class'],
  FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
  FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'href', 'src', 'action'],
  FORCE_BODY: true,
};

/**
 * Sanitize an HTML string for safe rendering.
 * Use for all LLM output and imported text displayed as HTML.
 */
export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, purifyConfig);
}

/**
 * Strip all HTML from a string, returning plain text.
 * Use when you need the text content of an HTML string.
 */
export function stripHtml(html: string): string {
  return DOMPurify.sanitize(html, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
}
