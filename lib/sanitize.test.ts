/**
 * Tests for sanitize.ts
 */
import { describe, it, expect } from 'vitest'
import { sanitizeHTML, createSanitizedMarkup } from './sanitize'

describe('sanitize', () => {
	describe('sanitizeHTML()', () => {
		it('allows safe HTML tags', () => {
			expect(sanitizeHTML('<b>bold</b>')).toBe('<b>bold</b>')
			expect(sanitizeHTML('<i>italic</i>')).toBe('<i>italic</i>')
			expect(sanitizeHTML('<u>underline</u>')).toBe('<u>underline</u>')
			expect(sanitizeHTML('<em>emphasis</em>')).toBe('<em>emphasis</em>')
			expect(sanitizeHTML('<strong>strong</strong>')).toBe('<strong>strong</strong>')
			expect(sanitizeHTML('<br>')).toBe('<br>')
		})

		it('allows links with safe attributes', () => {
			const link = '<a href="https://example.com" target="_blank" rel="noopener">link</a>'
			expect(sanitizeHTML(link)).toBe(link)
		})

		it('removes dangerous tags', () => {
			expect(sanitizeHTML('<script>alert("xss")</script>')).toBe('')
			expect(sanitizeHTML('<img src="x" onerror="alert(1)">')).toBe('')
			expect(sanitizeHTML('<iframe src="evil.com"></iframe>')).toBe('')
		})

		it('removes dangerous attributes', () => {
			expect(sanitizeHTML('<b onclick="alert(1)">text</b>')).toBe('<b>text</b>')
			expect(sanitizeHTML('<a href="javascript:alert(1)">link</a>')).toBe('<a>link</a>')
		})

		it('handles nested tags', () => {
			expect(sanitizeHTML('<b><i>bold italic</i></b>')).toBe('<b><i>bold italic</i></b>')
		})

		it('handles plain text', () => {
			expect(sanitizeHTML('just text')).toBe('just text')
		})

		it('handles empty string', () => {
			expect(sanitizeHTML('')).toBe('')
		})

		it('escapes dangerous characters in text', () => {
			// Text content should be preserved
			expect(sanitizeHTML('1 < 2 && 3 > 2')).toBe('1 &lt; 2 &amp;&amp; 3 &gt; 2')
		})

		it('respects custom allowed tags', () => {
			const result = sanitizeHTML('<div><span>text</span></div>', { allowedTags: ['span'] })
			expect(result).toBe('<span>text</span>')
		})

		it('respects custom allowed attributes', () => {
			// DOMPurify ALLOWED_ATTR adds to default data-* allowlist
			// Test that specifying only 'href' still works for href
			const result = sanitizeHTML('<a href="url" onclick="alert()">link</a>', {
				allowedTags: ['a'],
				allowedAttrs: ['href'],
			})
			expect(result).toBe('<a href="url">link</a>')
		})
	})

	describe('createSanitizedMarkup()', () => {
		it('returns object with __html property', () => {
			const result = createSanitizedMarkup('<b>test</b>')
			expect(result).toEqual({ __html: '<b>test</b>' })
		})

		it('sanitizes content before wrapping', () => {
			const result = createSanitizedMarkup('<script>evil</script><b>safe</b>')
			expect(result).toEqual({ __html: '<b>safe</b>' })
		})

		it('passes options to sanitizeHTML', () => {
			const result = createSanitizedMarkup('<div><span>text</span></div>', {
				allowedTags: ['span'],
			})
			expect(result).toEqual({ __html: '<span>text</span>' })
		})
	})
})
