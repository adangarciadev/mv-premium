import LZString from 'lz-string'
import type { UserCustomizationsData } from '@/features/user-customizations/storage'

export const IGNORED_USERS_IMPORT_PARAM = 'mvp_import_ignored'
export const IGNORED_USERS_PAYLOAD_TYPE = 'mvp-ignored-users'
export const IGNORED_USERS_PAYLOAD_VERSION = 1
export const MAX_IGNORED_USERS_IMPORT_URL_LENGTH = 2000
export const MAX_IGNORED_USERS_PAYLOAD_JSON_LENGTH = 20000
export const MEDIAVIDA_IMPORT_BASE_URL = 'https://www.mediavida.com/'

export type IgnoredUsersSyncIgnoreType = 'hide' | 'mute'

export interface IgnoredUsersSyncUser {
	nick: string
	ignoreType: IgnoredUsersSyncIgnoreType
}

export interface IgnoredUsersSyncPayload {
	type: typeof IGNORED_USERS_PAYLOAD_TYPE
	version: typeof IGNORED_USERS_PAYLOAD_VERSION
	users: IgnoredUsersSyncUser[]
}

export interface IgnoredUsersSyncSummary {
	total: number
	hide: number
	mute: number
}

export interface IgnoredUsersMergeResult {
	data: UserCustomizationsData
	imported: IgnoredUsersSyncSummary
}

const USERNAME_PATTERN = /^[A-Za-z0-9_-]+$/
const USERNAME_MIN_LENGTH = 3
const USERNAME_MAX_LENGTH = 13

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
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

export function normalizeIgnoredUsersSyncUsers(users: IgnoredUsersSyncUser[]): IgnoredUsersSyncUser[] {
	const byNick = new Map<string, IgnoredUsersSyncUser>()

	for (const user of users) {
		const nick = normalizeIgnoredUsersNick(user.nick)
		if (!isValidIgnoredUsersNick(nick)) {
			throw new Error('Invalid ignored users payload')
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

export function createIgnoredUsersSyncPayload(data: UserCustomizationsData): IgnoredUsersSyncPayload {
	const users: IgnoredUsersSyncUser[] = Object.entries(data.users)
		.filter(([, customization]) => customization.isIgnored)
		.map(([nick, customization]) => ({
			nick,
			ignoreType: customization.ignoreType === 'mute' ? 'mute' : 'hide',
		}))

	return {
		type: IGNORED_USERS_PAYLOAD_TYPE,
		version: IGNORED_USERS_PAYLOAD_VERSION,
		users: normalizeIgnoredUsersSyncUsers(users),
	}
}

export function validateIgnoredUsersSyncPayload(value: unknown): IgnoredUsersSyncPayload {
	if (!isRecord(value)) throw new Error('Invalid ignored users payload')
	if (value.type !== IGNORED_USERS_PAYLOAD_TYPE) throw new Error('Invalid ignored users payload')
	if (value.version !== IGNORED_USERS_PAYLOAD_VERSION) throw new Error('Invalid ignored users payload')
	if (!Array.isArray(value.users)) throw new Error('Invalid ignored users payload')

	const users: IgnoredUsersSyncUser[] = value.users.map(user => {
		if (!isRecord(user)) throw new Error('Invalid ignored users payload')
		if (typeof user.nick !== 'string') throw new Error('Invalid ignored users payload')
		if (user.ignoreType !== 'hide' && user.ignoreType !== 'mute') throw new Error('Invalid ignored users payload')
		return {
			nick: user.nick,
			ignoreType: user.ignoreType,
		}
	})

	return {
		type: IGNORED_USERS_PAYLOAD_TYPE,
		version: IGNORED_USERS_PAYLOAD_VERSION,
		users: normalizeIgnoredUsersSyncUsers(users),
	}
}

export function encodeIgnoredUsersSyncPayload(payload: IgnoredUsersSyncPayload): string {
	const validated = validateIgnoredUsersSyncPayload(payload)
	return LZString.compressToEncodedURIComponent(JSON.stringify(validated))
}

export function decodeIgnoredUsersSyncPayload(encoded: string): IgnoredUsersSyncPayload {
	if (encoded.length > MAX_IGNORED_USERS_IMPORT_URL_LENGTH) {
		throw new Error('Invalid ignored users payload')
	}

	const json = LZString.decompressFromEncodedURIComponent(encoded)
	if (!json) throw new Error('Invalid ignored users payload')
	if (json.length > MAX_IGNORED_USERS_PAYLOAD_JSON_LENGTH) throw new Error('Invalid ignored users payload')
	return validateIgnoredUsersSyncPayload(JSON.parse(json))
}

export function buildIgnoredUsersImportUrl(payload: IgnoredUsersSyncPayload): string {
	const url = new URL(MEDIAVIDA_IMPORT_BASE_URL)
	url.searchParams.set(IGNORED_USERS_IMPORT_PARAM, encodeIgnoredUsersSyncPayload(payload))
	return url.toString()
}

export function assertIgnoredUsersImportUrlSize(url: string): void {
	if (url.length > MAX_IGNORED_USERS_IMPORT_URL_LENGTH) {
		throw new Error('Demasiados usuarios para QR directo')
	}
}

export function createIgnoredUsersImportUrl(data: UserCustomizationsData): {
	payload: IgnoredUsersSyncPayload
	url: string
	summary: IgnoredUsersSyncSummary
} {
	const payload = createIgnoredUsersSyncPayload(data)
	const url = buildIgnoredUsersImportUrl(payload)
	assertIgnoredUsersImportUrlSize(url)
	return {
		payload,
		url,
		summary: summarizeIgnoredUsers(payload.users),
	}
}

export function getUrlWithoutIgnoredUsersImportParam(url: string): string {
	const parsed = new URL(url)
	parsed.searchParams.delete(IGNORED_USERS_IMPORT_PARAM)
	const search = parsed.searchParams.toString()
	return `${parsed.pathname}${search ? `?${search}` : ''}${parsed.hash}`
}

export function mergeIgnoredUsersIntoData(
	currentData: UserCustomizationsData,
	payload: IgnoredUsersSyncPayload
): IgnoredUsersMergeResult {
	const users = validateIgnoredUsersSyncPayload(payload).users
	const nextData: UserCustomizationsData = {
		...currentData,
		users: { ...currentData.users },
	}

	for (const user of users) {
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
		imported: summarizeIgnoredUsers(users),
	}
}
