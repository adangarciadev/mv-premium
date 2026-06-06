import { describe, expect, it } from 'vitest'
import type { UserCustomizationsData } from '@/features/user-customizations/storage'
import {
	buildIgnoredUsersImportUrl,
	createIgnoredUsersSyncPayload,
	decodeIgnoredUsersSyncPayload,
	encodeIgnoredUsersSyncPayload,
	IGNORED_USERS_IMPORT_PARAM,
	mergeIgnoredUsersIntoData,
	validateIgnoredUsersSyncPayload,
	type IgnoredUsersSyncPayload,
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

describe('ignored users mobile sync payload', () => {
	it('encodes and decodes a valid payload', () => {
		const payload: IgnoredUsersSyncPayload = {
			type: 'mvp-ignored-users',
			version: 1,
			users: [
				{ nick: 'MutedUser', ignoreType: 'mute' },
				{ nick: 'HiddenUser', ignoreType: 'hide' },
			],
		}

		const encoded = encodeIgnoredUsersSyncPayload(payload)

		expect(decodeIgnoredUsersSyncPayload(encoded)).toEqual({
			type: 'mvp-ignored-users',
			version: 1,
			users: [
				{ nick: 'HiddenUser', ignoreType: 'hide' },
				{ nick: 'MutedUser', ignoreType: 'mute' },
			],
		})
	})

	it('rejects invalid type and version', () => {
		expect(() =>
			validateIgnoredUsersSyncPayload({
				type: 'other',
				version: 1,
				users: [],
			})
		).toThrow('Invalid ignored users payload')

		expect(() =>
			validateIgnoredUsersSyncPayload({
				type: 'mvp-ignored-users',
				version: 2,
				users: [],
			})
		).toThrow('Invalid ignored users payload')
	})

	it('rejects invalid nicks', () => {
		expect(() =>
			validateIgnoredUsersSyncPayload({
				type: 'mvp-ignored-users',
				version: 1,
				users: [{ nick: 'ab', ignoreType: 'hide' }],
			})
		).toThrow('Invalid ignored users payload')

		expect(() =>
			validateIgnoredUsersSyncPayload({
				type: 'mvp-ignored-users',
				version: 1,
				users: [{ nick: '<script>', ignoreType: 'mute' }],
			})
		).toThrow('Invalid ignored users payload')
	})

	it('builds an import URL with the expected query param', () => {
		const url = buildIgnoredUsersImportUrl({
			type: 'mvp-ignored-users',
			version: 1,
			users: [{ nick: 'HiddenUser', ignoreType: 'hide' }],
		})

		expect(url).toContain('https://www.mediavida.com/')
		expect(new URL(url).searchParams.get(IGNORED_USERS_IMPORT_PARAM)).toBeTruthy()
	})

	it('rejects oversized encoded payloads', () => {
		expect(() => decodeIgnoredUsersSyncPayload('a'.repeat(2001))).toThrow('Invalid ignored users payload')
	})

	it('deduplicates by normalized nick and keeps hide as most restrictive', () => {
		const payload = validateIgnoredUsersSyncPayload({
			type: 'mvp-ignored-users',
			version: 1,
			users: [
				{ nick: 'SameUser', ignoreType: 'mute' },
				{ nick: 'sameuser', ignoreType: 'hide' },
			],
		})

		expect(payload.users).toEqual([{ nick: 'SameUser', ignoreType: 'hide' }])
	})

	it('exports only ignored users from storage data', () => {
		const payload = createIgnoredUsersSyncPayload(
			data({
				HiddenUser: { isIgnored: true, ignoreType: 'hide', note: 'keep me' },
				MutedUser: { isIgnored: true, ignoreType: 'mute' },
				StyledUser: { usernameColour: '#fff' },
			})
		)

		expect(payload.users).toEqual([
			{ nick: 'HiddenUser', ignoreType: 'hide' },
			{ nick: 'MutedUser', ignoreType: 'mute' },
		])
	})

	it('merges without duplicates and preserves existing customizations', () => {
		const result = mergeIgnoredUsersIntoData(
			data({
				ExistingUser: { isIgnored: true, ignoreType: 'mute', note: 'preserve' },
				OtherUser: { usernameColour: '#fff' },
			}),
			{
				type: 'mvp-ignored-users',
				version: 1,
				users: [
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
