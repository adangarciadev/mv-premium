/**
 * Tests for BBCode Utilities
 *
 * Tests BBCode detection and manipulation functions.
 */
import { describe, it, expect } from 'vitest'
import { FORMAT_TAGS, getActiveFormats } from '@/features/editor/lib/bbcode-utils'

describe('bbcode-utils', () => {
	describe('FORMAT_TAGS', () => {
		it('should define standard BBCode tags', () => {
			const ids = FORMAT_TAGS.map(t => t.id)
			expect(ids).toContain('bold')
			expect(ids).toContain('italic')
			expect(ids).toContain('underline')
			expect(ids).toContain('strikethrough')
			expect(ids).toContain('quote')
			expect(ids).toContain('spoiler')
		})

		it('should have matching open/close tags', () => {
			for (const tag of FORMAT_TAGS) {
				expect(tag.openTag).toMatch(/^\[/)
				expect(tag.closeTag).toMatch(/^\[\//)
			}
		})

		it('should have bold tag defined correctly', () => {
			const bold = FORMAT_TAGS.find(t => t.id === 'bold')
			expect(bold).toBeDefined()
			expect(bold?.openTag).toBe('[b]')
			expect(bold?.closeTag).toBe('[/b]')
		})

		it('should have NSFW spoiler with attribute', () => {
			const nsfw = FORMAT_TAGS.find(t => t.id === 'nsfw')
			expect(nsfw).toBeDefined()
			expect(nsfw?.openTag).toBe('[spoiler=NSFW]')
		})
	})

	describe('getActiveFormats', () => {
		it('should detect bold format when inside [b] tags', () => {
			const text = 'Hello [b]bold text[/b] world'
			// Position 11 is inside "bold text"
			const active = getActiveFormats(text, 11)
			expect(active).toContain('bold')
		})

		it('should detect multiple active formats', () => {
			const text = '[b][i]bold italic[/i][/b]'
			// Position 8 is inside both
			const active = getActiveFormats(text, 8)
			expect(active).toContain('bold')
			expect(active).toContain('italic')
		})

		it('should return empty array when outside all tags', () => {
			const text = 'plain text'
			const active = getActiveFormats(text, 5)
			expect(active).toHaveLength(0)
		})

		it('should return empty array after closing tag', () => {
			const text = '[b]bold[/b] plain'
			// Position 12 is in "plain"
			const active = getActiveFormats(text, 12)
			expect(active).not.toContain('bold')
		})

		it('should be case insensitive', () => {
			const text = '[B]BOLD TEXT[/B]'
			const active = getActiveFormats(text, 5)
			expect(active).toContain('bold')
		})

		it('should handle quote tags', () => {
			const text = '[quote]quoted text[/quote]'
			const active = getActiveFormats(text, 10)
			expect(active).toContain('quote')
		})

		it('should handle spoiler tags', () => {
			const text = '[spoiler]hidden text[/spoiler]'
			const active = getActiveFormats(text, 12)
			expect(active).toContain('spoiler')
		})
	})
})
