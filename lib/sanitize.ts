/**
 * HTML Sanitization Module
 *
 * Uses DOMPurify directly in the content script for reliable HTML sanitization.
 * While this adds ~50KB to the bundle, it ensures proper DOM access and stability.
 */
import DOMPurify from 'dompurify'

const DEFAULT_ALLOWED_TAGS = ['b', 'i', 'u', 's', 'em', 'strong', 'a', 'br', 'span', 'mark', 'code', 'pre']
const DEFAULT_ALLOWED_ATTRS = ['href', 'target', 'rel', 'class', 'style']

/**
 * Sanitize HTML to prevent XSS attacks (sync)
 * Uses DOMPurify directly in the content script
 * @param dirty - Untrusted HTML string
 * @param options - Optional config override
 * @returns Sanitized HTML string safe for rendering
 */
export function sanitizeHTML(dirty: string, options?: { allowedTags?: string[]; allowedAttrs?: string[] }): string {
	return DOMPurify.sanitize(dirty, {
		ALLOWED_TAGS: options?.allowedTags || DEFAULT_ALLOWED_TAGS,
		ALLOWED_ATTR: options?.allowedAttrs || DEFAULT_ALLOWED_ATTRS,
	})
}

/**
 * Sanitize HTML for rendering in React (dangerouslySetInnerHTML)
 * Returns object ready for React's dangerouslySetInnerHTML prop
 */
export function createSanitizedMarkup(
	dirty: string,
	options?: { allowedTags?: string[]; allowedAttrs?: string[] }
): { __html: string } {
	return { __html: sanitizeHTML(dirty, options) }
}
