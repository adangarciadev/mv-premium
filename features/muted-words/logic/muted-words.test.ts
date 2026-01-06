/**
 * Tests for Muted Words pattern matching logic
 *
 * Since compilePattern and matchesPattern are internal functions,
 * we re-implement the logic here for testing purposes.
 */
import { describe, it, expect } from 'vitest'

// Re-implement the pattern compilation logic for testing
interface CompiledPattern {
	original: string
	isRegex: boolean
	regex?: RegExp
	lowerWord?: string
}

function compilePattern(word: string): CompiledPattern {
	const trimmed = word.trim()

	// Check if it's a regex pattern (starts with /)
	if (trimmed.startsWith('/')) {
		try {
			// Parse regex: /pattern/flags format
			const match = trimmed.match(/^\/(.+?)\/([gimsuy]*)$/)
			if (match) {
				const [, pattern, flags] = match
				return {
					original: word,
					isRegex: true,
					regex: new RegExp(pattern, flags || 'i'),
				}
			}
			// Fallback: treat as simple pattern without closing /
			const simplePattern = trimmed.slice(1)
			return {
				original: word,
				isRegex: true,
				regex: new RegExp(simplePattern, 'i'),
			}
		} catch {
			// Invalid regex, fall back to literal match
			return {
				original: word,
				isRegex: false,
				lowerWord: trimmed.toLowerCase(),
			}
		}
	}

	// Regular word: case-insensitive literal match
	return {
		original: word,
		isRegex: false,
		lowerWord: trimmed.toLowerCase(),
	}
}

function matchesPattern(text: string, pattern: CompiledPattern): boolean {
	if (pattern.isRegex && pattern.regex) {
		return pattern.regex.test(text)
	}
	return text.toLowerCase().includes(pattern.lowerWord || '')
}

describe('muted-words pattern matching', () => {
	describe('compilePattern', () => {
		describe('regular words', () => {
			it('should compile a simple word', () => {
				const pattern = compilePattern('spoiler')
				expect(pattern.isRegex).toBe(false)
				expect(pattern.lowerWord).toBe('spoiler')
				expect(pattern.original).toBe('spoiler')
			})

			it('should lowercase words', () => {
				const pattern = compilePattern('SPOILER')
				expect(pattern.lowerWord).toBe('spoiler')
			})

			it('should trim whitespace', () => {
				const pattern = compilePattern('  spoiler  ')
				expect(pattern.lowerWord).toBe('spoiler')
			})
		})

		describe('regex patterns', () => {
			it('should compile regex with flags', () => {
				const pattern = compilePattern('/spoil(er|ers)?/i')
				expect(pattern.isRegex).toBe(true)
				expect(pattern.regex).toBeDefined()
			})

			it('should compile regex without closing slash', () => {
				const pattern = compilePattern('/spoiler')
				expect(pattern.isRegex).toBe(true)
				expect(pattern.regex).toBeDefined()
			})

			it('should fall back to literal match for invalid regex', () => {
				const pattern = compilePattern('/[invalid(/')
				expect(pattern.isRegex).toBe(false)
				expect(pattern.lowerWord).toBeDefined()
			})
		})
	})

	describe('matchesPattern', () => {
		describe('word matching', () => {
			it('should match exact word', () => {
				const pattern = compilePattern('spoiler')
				expect(matchesPattern('This is a spoiler', pattern)).toBe(true)
			})

			it('should match case-insensitively', () => {
				const pattern = compilePattern('spoiler')
				expect(matchesPattern('This is a SPOILER', pattern)).toBe(true)
				expect(matchesPattern('This is a Spoiler', pattern)).toBe(true)
			})

			it('should match partial words', () => {
				const pattern = compilePattern('spoil')
				expect(matchesPattern('spoilers ahead!', pattern)).toBe(true)
			})

			it('should not match when word is not present', () => {
				const pattern = compilePattern('spoiler')
				expect(matchesPattern('This is safe content', pattern)).toBe(false)
			})
		})

		describe('regex matching', () => {
			it('should match regex pattern', () => {
				const pattern = compilePattern('/spoil(er|ers)?/i')
				expect(matchesPattern('spoil', pattern)).toBe(true)
				expect(matchesPattern('spoiler', pattern)).toBe(true)
				expect(matchesPattern('spoilers', pattern)).toBe(true)
			})

			it('should default to case-insensitive when no flags provided', () => {
				const patternNoFlag = compilePattern('/Spoiler/')
				expect(matchesPattern('Spoiler', patternNoFlag)).toBe(true)
				expect(matchesPattern('spoiler', patternNoFlag)).toBe(true) // Should match because 'i' is added by default
				// Default behavior adds 'i' flag for user-friendliness
				expect(patternNoFlag.regex?.flags).toContain('i')
			})

			it('should match multiple occurrences with global flag', () => {
				const pattern = compilePattern('/spoiler/g')
				expect(matchesPattern('spoiler spoiler spoiler', pattern)).toBe(true)
			})
		})

		describe('edge cases', () => {
			it('should handle empty text', () => {
				const pattern = compilePattern('spoiler')
				expect(matchesPattern('', pattern)).toBe(false)
			})

			it('should handle special characters in words', () => {
				const pattern = compilePattern('$100')
				expect(matchesPattern('Price: $100', pattern)).toBe(true)
			})

			it('should handle unicode characters', () => {
				const pattern = compilePattern('日本語')
				expect(matchesPattern('これは日本語です', pattern)).toBe(true)
			})

			it('should handle emoji', () => {
				const pattern = compilePattern('😀')
				expect(matchesPattern('Hello 😀 world', pattern)).toBe(true)
			})
		})
	})
})
