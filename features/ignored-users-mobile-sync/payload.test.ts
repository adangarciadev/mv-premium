import { describe, expect, it } from 'vitest'
import type { UserCustomizationsData } from '@/features/user-customizations/storage'
import {
	buildMobileLiteImportUrl,
	createMobileLiteTransferPayload,
	decodeMobileLiteTransferPayload,
	encodeMobileLiteTransferPayload,
	MOBILE_LITE_IMPORT_PARAM,
	mergeMobileLiteIgnoredUsersIntoData,
	validateMobileLiteTransferPayload,
	type MobileLiteTransferPayload,
} from './payload'

const GLOBAL_SETTINGS = {
	adminColor: '',
	subadminColor: '',
	modColor: '',
	userColor: '',
}

function data(users: UserCustomizationsData['users']): UserCustomizationsData {
	return {
		users,
		globalSettings: GLOBAL_SETTINGS,
	}
}

describe('Mobile Lite transfer payload', () => {
	it('encodes and decodes a valid payload', () => {
		const payload: MobileLiteTransferPayload = {
			type: 'mvp-mobile-lite-transfer',
			version: 1,
			ignoredUsers: [
				{ nick: 'MutedUser', ignoreType: 'mute' },
				{ nick: 'HiddenUser', ignoreType: 'hide' },
			],
			imgbbApiKey: 'abc_123',
		}

		const encoded = encodeMobileLiteTransferPayload(payload)

		expect(decodeMobileLiteTransferPayload(encoded)).toEqual({
			type: 'mvp-mobile-lite-transfer',
			version: 1,
			ignoredUsers: [
				{ nick: 'HiddenUser', ignoreType: 'hide' },
				{ nick: 'MutedUser', ignoreType: 'mute' },
			],
			imgbbApiKey: 'abc_123',
		})
	})

	it('rejects invalid type and version', () => {
		expect(() =>
			validateMobileLiteTransferPayload({
				type: 'other',
				version: 1,
				ignoredUsers: [],
			})
		).toThrow('Invalid Mobile Lite payload')

		expect(() =>
			validateMobileLiteTransferPayload({
				type: 'mvp-mobile-lite-transfer',
				version: 2,
				ignoredUsers: [],
			})
		).toThrow('Invalid Mobile Lite payload')
	})

	it('rejects invalid nicks and API keys', () => {
		expect(() =>
			validateMobileLiteTransferPayload({
				type: 'mvp-mobile-lite-transfer',
				version: 1,
				ignoredUsers: [{ nick: 'ab', ignoreType: 'hide' }],
			})
		).toThrow('Invalid Mobile Lite payload')

		expect(() =>
			validateMobileLiteTransferPayload({
				type: 'mvp-mobile-lite-transfer',
				version: 1,
				ignoredUsers: [{ nick: '<script>', ignoreType: 'mute' }],
			})
		).toThrow('Invalid Mobile Lite payload')

		expect(() =>
			validateMobileLiteTransferPayload({
				type: 'mvp-mobile-lite-transfer',
				version: 1,
				ignoredUsers: [],
				imgbbApiKey: 'bad key',
			})
		).toThrow('Invalid Mobile Lite payload')
	})

	it('builds an import URL with the expected query param', () => {
		const url = buildMobileLiteImportUrl({
			type: 'mvp-mobile-lite-transfer',
			version: 1,
			ignoredUsers: [{ nick: 'HiddenUser', ignoreType: 'hide' }],
		})

		expect(url).toContain('https://www.mediavida.com/')
		expect(new URL(url).searchParams.get(MOBILE_LITE_IMPORT_PARAM)).toBeTruthy()
	})

	it('rejects oversized encoded payloads', () => {
		expect(() => decodeMobileLiteTransferPayload('a'.repeat(2001))).toThrow('Invalid Mobile Lite payload')
	})

	it('deduplicates by normalized nick and keeps hide as most restrictive', () => {
		const payload = validateMobileLiteTransferPayload({
			type: 'mvp-mobile-lite-transfer',
			version: 1,
			ignoredUsers: [
				{ nick: 'SameUser', ignoreType: 'mute' },
				{ nick: 'sameuser', ignoreType: 'hide' },
			],
		})

		expect(payload.ignoredUsers).toEqual([{ nick: 'SameUser', ignoreType: 'hide' }])
	})

	it('exports only ignored users and optionally includes the ImgBB API key', () => {
		const payload = createMobileLiteTransferPayload(
			data({
				HiddenUser: { isIgnored: true, ignoreType: 'hide', note: 'keep me' },
				MutedUser: { isIgnored: true, ignoreType: 'mute' },
				StyledUser: { usernameColour: '#fff' },
			}),
			' key_123 '
		)

		expect(payload.ignoredUsers).toEqual([
			{ nick: 'HiddenUser', ignoreType: 'hide' },
			{ nick: 'MutedUser', ignoreType: 'mute' },
		])
		expect(payload.imgbbApiKey).toBe('key_123')
	})

	it('merges without duplicates and preserves existing customizations', () => {
		const result = mergeMobileLiteIgnoredUsersIntoData(
			data({
				ExistingUser: { isIgnored: true, ignoreType: 'mute', note: 'preserve' },
				OtherUser: { usernameColour: '#fff' },
			}),
			{
				type: 'mvp-mobile-lite-transfer',
				version: 1,
				ignoredUsers: [
					{ nick: 'existinguser', ignoreType: 'hide' },
					{ nick: 'NewUser', ignoreType: 'mute' },
				],
			}
		)

		expect(result.data.users).toEqual({
			ExistingUser: { isIgnored: true, ignoreType: 'hide', note: 'preserve' },
			OtherUser: { usernameColour: '#fff' },
			NewUser: { isIgnored: true, ignoreType: 'mute' },
		})
		expect(result.imported).toEqual({ total: 2, hide: 1, mute: 1 })
	})
})
