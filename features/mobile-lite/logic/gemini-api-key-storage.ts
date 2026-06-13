import { storage } from '#imports'
import { STORAGE_KEYS } from '@/constants'
import { logger } from '@/lib/logger'

const settingsStorageItem = storage.defineItem<string | null>(`local:${STORAGE_KEYS.SETTINGS}`, {
	fallback: null,
})

interface PersistedSettings {
	state?: Record<string, unknown>
	version?: number
}

function parsePersistedSettings(rawSettings: string | null): PersistedSettings {
	if (!rawSettings) return { state: {}, version: 0 }

	try {
		const parsed = JSON.parse(rawSettings) as PersistedSettings | null
		if (!parsed || typeof parsed !== 'object') return { state: {}, version: 0 }

		return {
			...parsed,
			state: parsed && typeof parsed.state === 'object' && parsed.state ? parsed.state : {},
		}
	} catch (error) {
		logger.warn('Mobile Lite could not parse settings storage while reading Gemini key', error)
		return { state: {}, version: 0 }
	}
}

export async function getMobileLiteGeminiApiKey(): Promise<string> {
	const parsed = parsePersistedSettings(await settingsStorageItem.getValue())
	const value = parsed.state?.geminiApiKey
	return typeof value === 'string' ? value : ''
}

export async function saveMobileLiteGeminiApiKey(apiKey: string): Promise<void> {
	const rawSettings = await settingsStorageItem.getValue()
	const parsed = parsePersistedSettings(rawSettings)
	await settingsStorageItem.setValue(
		JSON.stringify({
			...parsed,
			state: {
				...parsed.state,
				geminiApiKey: apiKey.trim(),
			},
		})
	)
}
