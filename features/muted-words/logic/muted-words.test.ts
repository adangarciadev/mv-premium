import { describe, it, expect } from 'vitest'
import { compilePattern, matchesPattern } from './muted-words'

describe('muted-words pattern matching', () => {
	describe('compilePattern', () => {
		describe('regular words', () => {
			it('compiles a simple word', () => {
				const pattern = compilePattern('spoiler')
				expect(pattern.isRegex).toBe(false)
				expect(pattern.lowerWord).toBe('spoiler')
				expect(pattern.original).toBe('spoiler')
			})

			it('lowercases words', () => {
				const pattern = compilePattern('SPOILER')
				expect(pattern.lowerWord).toBe('spoiler')
			})

			it('trims whitespace', () => {
				const pattern = compilePattern('  spoiler  ')
				expect(pattern.lowerWord).toBe('spoiler')
			})
		})

		describe('regex patterns', () => {
			it('compiles regex with flags', () => {
				const pattern = compilePattern('/spoil(er|ers)?/i')
				expect(pattern.isRegex).toBe(true)
				expect(pattern.regex).toBeDefined()
			})

			it('compiles regex without closing slash', () => {
				const pattern = compilePattern('/spoiler')
				expect(pattern.isRegex).toBe(true)
				expect(pattern.regex).toBeDefined()
			})

			it('falls back to literal match for invalid regex', () => {
				const pattern = compilePattern('/[invalid(/')
				expect(pattern.isRegex).toBe(false)
				expect(pattern.lowerWord).toBeDefined()
			})

			it('removes stateful global flag to keep matching deterministic', () => {
				const pattern = compilePattern('/spoiler/g')
				expect(pattern.regex?.flags.includes('g')).toBe(false)
			})
		})
	})

	describe('matchesPattern', () => {
		describe('word matching', () => {
			it('matches exact word', () => {
				const pattern = compilePattern('spoiler')
				expect(matchesPattern('This is a spoiler', pattern)).toBe(true)
			})

			it('matches case-insensitively', () => {
				const pattern = compilePattern('spoiler')
				expect(matchesPattern('This is a SPOILER', pattern)).toBe(true)
				expect(matchesPattern('This is a Spoiler', pattern)).toBe(true)
			})

			it('matches partial words', () => {
				const pattern = compilePattern('spoil')
				expect(matchesPattern('spoilers ahead!', pattern)).toBe(true)
			})

			it('does not match when word is not present', () => {
				const pattern = compilePattern('spoiler')
				expect(matchesPattern('This is safe content', pattern)).toBe(false)
			})
		})

		describe('regex matching', () => {
			it('matches regex pattern', () => {
				const pattern = compilePattern('/spoil(er|ers)?/i')
				expect(matchesPattern('spoil', pattern)).toBe(true)
				expect(matchesPattern('spoiler', pattern)).toBe(true)
				expect(matchesPattern('spoilers', pattern)).toBe(true)
			})

			it('defaults to case-insensitive when no flags provided', () => {
				const patternNoFlag = compilePattern('/Spoiler/')
				expect(matchesPattern('Spoiler', patternNoFlag)).toBe(true)
				expect(matchesPattern('spoiler', patternNoFlag)).toBe(true)
				expect(patternNoFlag.regex?.flags).toContain('i')
			})

			it('stays deterministic across repeated checks with global-like input', () => {
				const pattern = compilePattern('/spoiler/g')
				expect(matchesPattern('spoiler spoiler spoiler', pattern)).toBe(true)
				expect(matchesPattern('spoiler spoiler spoiler', pattern)).toBe(true)
			})
		})

		describe('edge cases', () => {
			it('handles empty text', () => {
				const pattern = compilePattern('spoiler')
				expect(matchesPattern('', pattern)).toBe(false)
			})

			it('handles special characters in words', () => {
				const pattern = compilePattern('$100')
				expect(matchesPattern('Price: $100', pattern)).toBe(true)
			})

			it('handles unicode characters', () => {
				const pattern = compilePattern('日本語')
				expect(matchesPattern('これは日本語です', pattern)).toBe(true)
			})

			it('handles emoji', () => {
				const pattern = compilePattern('😀')
				expect(matchesPattern('Hello 😀 world', pattern)).toBe(true)
			})
		})
	})
})
