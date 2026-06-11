import { storage } from '#imports'
import { RUNTIME_CACHE_KEYS, STORAGE_KEYS } from '@/constants'
import { FeatureFlag, isFeatureEnabled } from '@/lib/feature-flags'
import { getPlatformKind } from '@/lib/platform'

const CSS_VAR = '--mvp-bold-color'
const CACHE_KEY_ENABLED = RUNTIME_CACHE_KEYS.BOLD_COLOR_ENABLED
const CACHE_KEY_COLOR = RUNTIME_CACHE_KEYS.BOLD_COLOR
const DEFAULT_BOLD_COLOR = '#ffffff'
const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i

const boldColorStorage = storage.defineItem<string | null>(`local:${STORAGE_KEYS.BOLD_COLOR}`, {
	defaultValue: null,
})

const boldColorEnabledStorage = storage.defineItem<boolean>(`local:${STORAGE_KEYS.BOLD_COLOR_ENABLED}`, {
	defaultValue: false,
})

export interface MobileLiteBoldColorSettings {
	color: string
	enabled: boolean
}

let initialized = false
let unwatchBoldColor: (() => void) | null = null
let unwatchBoldColorEnabled: (() => void) | null = null

function isMobileLiteBoldColorAllowed(): boolean {
	return getPlatformKind() === 'firefox-android' && isFeatureEnabled(FeatureFlag.MobileLite)
}

export function normalizeMobileLiteBoldColor(color: string | null | undefined): string {
	const normalized = color?.trim()
	return normalized && HEX_COLOR_PATTERN.test(normalized) ? normalized.toLowerCase() : DEFAULT_BOLD_COLOR
}

function updateBoldColorCache(enabled: boolean, color: string | null): void {
	try {
		localStorage.setItem(CACHE_KEY_ENABLED, String(enabled))
		if (color) {
			localStorage.setItem(CACHE_KEY_COLOR, color)
		} else {
			localStorage.removeItem(CACHE_KEY_COLOR)
		}
	} catch {
		// localStorage may be unavailable in some privacy modes.
	}
}

export function applyMobileLiteBoldColorValue(settings: MobileLiteBoldColorSettings): void {
	const color = normalizeMobileLiteBoldColor(settings.color)
	updateBoldColorCache(settings.enabled, color)
	document.documentElement.style.setProperty(CSS_VAR, settings.enabled ? color : 'inherit')
}

export async function getMobileLiteBoldColorSettings(): Promise<MobileLiteBoldColorSettings> {
	const [enabled, color] = await Promise.all([boldColorEnabledStorage.getValue(), boldColorStorage.getValue()])
	return {
		enabled: Boolean(enabled),
		color: normalizeMobileLiteBoldColor(color),
	}
}

export async function applyMobileLiteBoldColor(): Promise<void> {
	if (!isMobileLiteBoldColorAllowed()) return
	applyMobileLiteBoldColorValue(await getMobileLiteBoldColorSettings())
}

export async function saveMobileLiteBoldColorSettings(settings: Partial<MobileLiteBoldColorSettings>): Promise<MobileLiteBoldColorSettings> {
	const current = await getMobileLiteBoldColorSettings()
	const next = {
		color: normalizeMobileLiteBoldColor(settings.color ?? current.color),
		enabled: settings.enabled ?? current.enabled,
	}

	await Promise.all([boldColorStorage.setValue(next.color), boldColorEnabledStorage.setValue(next.enabled)])
	applyMobileLiteBoldColorValue(next)
	return next
}

export function initMobileLiteBoldColor(): void {
	if (!isMobileLiteBoldColorAllowed()) return
	if (initialized) return

	initialized = true
	void applyMobileLiteBoldColor()
	unwatchBoldColor = boldColorStorage.watch(() => {
		void applyMobileLiteBoldColor()
	})
	unwatchBoldColorEnabled = boldColorEnabledStorage.watch(() => {
		void applyMobileLiteBoldColor()
	})
}

export function teardownMobileLiteBoldColor(): void {
	unwatchBoldColor?.()
	unwatchBoldColor = null
	unwatchBoldColorEnabled?.()
	unwatchBoldColorEnabled = null
	initialized = false
	document.documentElement.style.setProperty(CSS_VAR, 'inherit')
}
