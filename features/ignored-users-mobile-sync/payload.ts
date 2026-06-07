import LZString from 'lz-string'
import type { UserCustomizationsData } from '@/features/user-customizations/storage'

export const MOBILE_LITE_IMPORT_PARAM = 'mvp_import_mobile_lite'
export const MOBILE_LITE_TRANSFER_PAYLOAD_TYPE = 'mvp-mobile-lite-transfer'
export const MOBILE_LITE_TRANSFER_PAYLOAD_VERSION = 1
export const MAX_MOBILE_LITE_IMPORT_URL_LENGTH = 2000
export const MAX_MOBILE_LITE_PAYLOAD_JSON_LENGTH = 24000
export const MEDIAVIDA_IMPORT_BASE_URL = 'https://www.mediavida.com/'

export type IgnoredUsersSyncIgnoreType = 'hide' | 'mute'

export interface IgnoredUsersSyncUser {
	nick: string
	ignoreType: IgnoredUsersSyncIgnoreType
}

export interface MobileLiteTransferPayload {
	type: typeof MOBILE_LITE_TRANSFER_PAYLOAD_TYPE
	version: typeof MOBILE_LITE_TRANSFER_PAYLOAD_VERSION
	ignoredUsers: IgnoredUsersSyncUser[]
	imgbbApiKey?: string
}

export interface IgnoredUsersSyncSummary {
	total: number
	hide: number
	mute: number
}

export interface MobileLiteTransferSummary extends IgnoredUsersSyncSummary {
	hasImgbbApiKey: boolean
}

export interface MobileLiteTransferMergeResult {
	data: UserCustomizationsData
	imported: IgnoredUsersSyncSummary
}

const USERNAME_PATTERN = /^[A-Za-z0-9_-]+$/
const USERNAME_MIN_LENGTH = 3
const USERNAME_MAX_LENGTH = 13
const IMGBB_API_KEY_MAX_LENGTH = 256
const IMGBB_API_KEY_PATTERN = /^[A-Za-z0-9_-]+$/

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeImgbbApiKey(apiKey: string | undefined): string | undefined {
	const normalized = apiKey?.trim()
	return normalized || undefined
}

function validateImgbbApiKey(apiKey: string | undefined): string | undefined {
	const normalized = normalizeImgbbApiKey(apiKey)
	if (!normalized) return undefined
	if (normalized.length > IMGBB_API_KEY_MAX_LENGTH || !IMGBB_API_KEY_PATTERN.test(normalized)) {
		throw new Error('Invalid Mobile Lite payload')
	}
	return normalized
}

export function normalizeIgnoredUsersNick(nick: string): string {
	return nick.trim()
}

export function getIgnoredUsersNickKey(nick: string): string {
	return normalizeIgnoredUsersNick(nick).toLowerCase()
}

export function isValidIgnoredUsersNick(nick: string): boolean {
	const normalized = normalizeIgnoredUsersNick(nick)
	return (
		normalized.length >= USERNAME_MIN_LENGTH &&
		normalized.length <= USERNAME_MAX_LENGTH &&
		USERNAME_PATTERN.test(normalized)
	)
}

export function getMostRestrictiveIgnoreType(
	current: IgnoredUsersSyncIgnoreType | undefined,
	next: IgnoredUsersSyncIgnoreType
): IgnoredUsersSyncIgnoreType {
	return current === 'hide' || next === 'hide' ? 'hide' : 'mute'
}

export function summarizeIgnoredUsers(users: IgnoredUsersSyncUser[]): IgnoredUsersSyncSummary {
	return users.reduce<IgnoredUsersSyncSummary>(
		(summary, user) => {
			summary.total += 1
			summary[user.ignoreType] += 1
			return summary
		},
		{ total: 0, hide: 0, mute: 0 }
	)
}

export function summarizeMobileLiteTransfer(payload: MobileLiteTransferPayload): MobileLiteTransferSummary {
	return {
		...summarizeIgnoredUsers(payload.ignoredUsers),
		hasImgbbApiKey: Boolean(payload.imgbbApiKey),
	}
}

export function normalizeIgnoredUsersSyncUsers(users: IgnoredUsersSyncUser[]): IgnoredUsersSyncUser[] {
	const byNick = new Map<string, IgnoredUsersSyncUser>()

	for (const user of users) {
		const nick = normalizeIgnoredUsersNick(user.nick)
		if (!isValidIgnoredUsersNick(nick)) {
			throw new Error('Invalid Mobile Lite payload')
		}

		const key = getIgnoredUsersNickKey(nick)
		const existing = byNick.get(key)
		byNick.set(key, {
			nick: existing?.nick ?? nick,
			ignoreType: getMostRestrictiveIgnoreType(existing?.ignoreType, user.ignoreType),
		})
	}

	return Array.from(byNick.values()).sort((a, b) => a.nick.localeCompare(b.nick, 'es', { sensitivity: 'base' }))
}

export function createMobileLiteTransferPayload(
	data: UserCustomizationsData,
	imgbbApiKey?: string
): MobileLiteTransferPayload {
	const ignoredUsers: IgnoredUsersSyncUser[] = Object.entries(data.users)
		.filter(([, customization]) => customization.isIgnored)
		.map(([nick, customization]) => ({
			nick,
			ignoreType: customization.ignoreType === 'mute' ? 'mute' : 'hide',
		}))

	return {
		type: MOBILE_LITE_TRANSFER_PAYLOAD_TYPE,
		version: MOBILE_LITE_TRANSFER_PAYLOAD_VERSION,
		ignoredUsers: normalizeIgnoredUsersSyncUsers(ignoredUsers),
		imgbbApiKey: validateImgbbApiKey(imgbbApiKey),
	}
}

export function validateMobileLiteTransferPayload(value: unknown): MobileLiteTransferPayload {
	if (!isRecord(value)) throw new Error('Invalid Mobile Lite payload')
	if (value.type !== MOBILE_LITE_TRANSFER_PAYLOAD_TYPE) throw new Error('Invalid Mobile Lite payload')
	if (value.version !== MOBILE_LITE_TRANSFER_PAYLOAD_VERSION) throw new Error('Invalid Mobile Lite payload')
	if (!Array.isArray(value.ignoredUsers)) throw new Error('Invalid Mobile Lite payload')

	const ignoredUsers: IgnoredUsersSyncUser[] = value.ignoredUsers.map(user => {
		if (!isRecord(user)) throw new Error('Invalid Mobile Lite payload')
		if (typeof user.nick !== 'string') throw new Error('Invalid Mobile Lite payload')
		if (user.ignoreType !== 'hide' && user.ignoreType !== 'mute') throw new Error('Invalid Mobile Lite payload')
		return {
			nick: user.nick,
			ignoreType: user.ignoreType,
		}
	})

	const imgbbApiKey = value.imgbbApiKey
	if (imgbbApiKey !== undefined && typeof imgbbApiKey !== 'string') {
		throw new Error('Invalid Mobile Lite payload')
	}

	return {
		type: MOBILE_LITE_TRANSFER_PAYLOAD_TYPE,
		version: MOBILE_LITE_TRANSFER_PAYLOAD_VERSION,
		ignoredUsers: normalizeIgnoredUsersSyncUsers(ignoredUsers),
		imgbbApiKey: validateImgbbApiKey(imgbbApiKey),
	}
}

export function encodeMobileLiteTransferPayload(payload: MobileLiteTransferPayload): string {
	const validated = validateMobileLiteTransferPayload(payload)
	return LZString.compressToEncodedURIComponent(JSON.stringify(validated))
}

export function decodeMobileLiteTransferPayload(encoded: string): MobileLiteTransferPayload {
	if (encoded.length > MAX_MOBILE_LITE_IMPORT_URL_LENGTH) {
		throw new Error('Invalid Mobile Lite payload')
	}

	const json = LZString.decompressFromEncodedURIComponent(encoded)
	if (!json) throw new Error('Invalid Mobile Lite payload')
	if (json.length > MAX_MOBILE_LITE_PAYLOAD_JSON_LENGTH) throw new Error('Invalid Mobile Lite payload')

	try {
		return validateMobileLiteTransferPayload(JSON.parse(json))
	} catch {
		throw new Error('Invalid Mobile Lite payload')
	}
}

export function buildMobileLiteImportUrl(payload: MobileLiteTransferPayload): string {
	const url = new URL(MEDIAVIDA_IMPORT_BASE_URL)
	url.searchParams.set(MOBILE_LITE_IMPORT_PARAM, encodeMobileLiteTransferPayload(payload))
	return url.toString()
}

export function assertMobileLiteImportUrlSize(url: string): void {
	if (url.length > MAX_MOBILE_LITE_IMPORT_URL_LENGTH) {
		throw new Error('Demasiados datos para QR directo')
	}
}

export function createMobileLiteImportUrl(
	data: UserCustomizationsData,
	imgbbApiKey?: string
): {
	payload: MobileLiteTransferPayload
	url: string
	summary: MobileLiteTransferSummary
} {
	const payload = createMobileLiteTransferPayload(data, imgbbApiKey)
	const url = buildMobileLiteImportUrl(payload)
	assertMobileLiteImportUrlSize(url)
	return {
		payload,
		url,
		summary: summarizeMobileLiteTransfer(payload),
	}
}

export function getUrlWithoutMobileLiteImportParam(url: string): string {
	const parsed = new URL(url)
	parsed.searchParams.delete(MOBILE_LITE_IMPORT_PARAM)
	const search = parsed.searchParams.toString()
	return `${parsed.pathname}${search ? `?${search}` : ''}${parsed.hash}`
}

export function mergeMobileLiteIgnoredUsersIntoData(
	currentData: UserCustomizationsData,
	payload: MobileLiteTransferPayload
): MobileLiteTransferMergeResult {
	const ignoredUsers = validateMobileLiteTransferPayload(payload).ignoredUsers
	const nextData: UserCustomizationsData = {
		...currentData,
		users: { ...currentData.users },
	}

	for (const user of ignoredUsers) {
		const existingKey = Object.keys(nextData.users).find(key => getIgnoredUsersNickKey(key) === getIgnoredUsersNickKey(user.nick))
		const storageKey = existingKey ?? user.nick
		const existing = nextData.users[storageKey] ?? {}
		const existingIgnoreType = existing.isIgnored ? (existing.ignoreType === 'mute' ? 'mute' : 'hide') : undefined

		nextData.users[storageKey] = {
			...existing,
			isIgnored: true,
			ignoreType: getMostRestrictiveIgnoreType(existingIgnoreType, user.ignoreType),
		}
	}

	return {
		data: nextData,
		imported: summarizeIgnoredUsers(ignoredUsers),
	}
}
