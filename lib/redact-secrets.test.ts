import { describe, expect, it } from 'vitest'
import { redactSecrets } from './redact-secrets'

describe('redactSecrets', () => {
	it('masks a secret field inside a plain object', () => {
		expect(redactSecrets({ theme: 'dark', geminiKey: 'abc123' })).toEqual({ theme: 'dark', geminiKey: '***' })
	})

	// The real leak: settings are persisted as a JSON string, so neither the
	// object branch nor the key-name filter of the debug dump caught them.
	it('masks a secret hidden inside a JSON string', () => {
		const stored = JSON.stringify({ state: { theme: 'dark', footballDataApiKey: 'super-secret-value' } })

		const redacted = redactSecrets(stored)

		expect(redacted).not.toContain('super-secret-value')
		expect(JSON.parse(redacted as string).state.footballDataApiKey).toBe('***')
		expect(JSON.parse(redacted as string).state.theme).toBe('dark')
	})

	it('masks every naming variant', () => {
		const redacted = redactSecrets({
			apiKey: 'a',
			access_token: 'b',
			clientSecret: 'c',
			password: 'd',
			authHeader: 'e',
		}) as Record<string, unknown>

		expect(Object.values(redacted)).toEqual(['***', '***', '***', '***', '***'])
	})

	it('reaches secrets nested in arrays and sub-objects', () => {
		const redacted = redactSecrets({
			providers: [{ name: 'imgbb', apiKey: 'leaky' }],
			nested: { deep: { token: 'leaky' } },
		}) as { providers: Array<{ apiKey: string }>; nested: { deep: { token: string } } }

		expect(redacted.providers[0].apiKey).toBe('***')
		expect(redacted.nested.deep.token).toBe('***')
	})

	it('leaves ordinary values untouched', () => {
		expect(redactSecrets({ count: 3, enabled: true, name: 'MVP', missing: null })).toEqual({
			count: 3,
			enabled: true,
			name: 'MVP',
			missing: null,
		})
	})

	it('keeps an empty secret as-is so the report still shows it is unset', () => {
		expect(redactSecrets({ apiKey: '' })).toEqual({ apiKey: '' })
	})

	it('returns non-JSON strings unchanged', () => {
		expect(redactSecrets('dark')).toBe('dark')
		expect(redactSecrets('{not json')).toBe('{not json')
	})
})
