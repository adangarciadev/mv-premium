/**
 * Redaction for anything printed by the `mvpDebug()` support helper.
 *
 * Users are asked to screenshot that output, so nothing secret may survive it.
 * Censoring by storage key name is not enough: settings are persisted as a JSON
 * *string*, so an API key sitting inside `mvp-settings` slipped through both the
 * object branch and the key-name filter.
 */

const SECRET_FIELD = /key|token|secret|password|auth/i

function redactObject(value: Record<string, unknown>): Record<string, unknown> {
	return Object.fromEntries(
		Object.entries(value).map(([field, fieldValue]) => {
			if (SECRET_FIELD.test(field)) {
				return [field, typeof fieldValue === 'string' && fieldValue !== '' ? '***' : fieldValue]
			}

			return [field, redactSecrets(fieldValue)]
		})
	)
}

/**
 * Recursively mask secret-looking fields. Strings holding JSON are parsed,
 * redacted and re-serialized so nested credentials cannot hide inside them.
 */
export function redactSecrets(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(redactSecrets)

	if (typeof value === 'string') {
		const trimmed = value.trim()
		if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return value

		try {
			return JSON.stringify(redactSecrets(JSON.parse(trimmed)))
		} catch {
			return value
		}
	}

	if (value !== null && typeof value === 'object') {
		return redactObject(value as Record<string, unknown>)
	}

	return value
}
