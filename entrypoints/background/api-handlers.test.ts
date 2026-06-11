import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockOnMessage = vi.hoisted(() => vi.fn())

vi.mock('@/lib/messaging', () => ({
	onMessage: mockOnMessage,
}))

import { setupMvUserAvatarHandler, setupTwitterLiteHandler } from './api-handlers'

type MessageHandler = (message: { data: { tweetUrl: string } }) => Promise<unknown>
type MvUserAvatarHandler = (message: { data: { username: string } }) => Promise<unknown>
type MvUserSearchHandler = (message: { data: { query: string } }) => Promise<unknown>

describe('setupTwitterLiteHandler', () => {
	const handlers = new Map<string, MessageHandler>()

	beforeEach(() => {
		handlers.clear()
		mockOnMessage.mockReset()
		mockOnMessage.mockImplementation((name: string, handler: MessageHandler) => {
			handlers.set(name, handler)
		})
		vi.restoreAllMocks()
	})

	it('returns tweet data from syndication when oEmbed is unavailable', async () => {
		const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async url => {
			const requestUrl = String(url)
			if (requestUrl.startsWith('https://publish.twitter.com/oembed')) {
				return new Response(null, { status: 404 })
			}

			if (requestUrl.startsWith('https://cdn.syndication.twimg.com/tweet-result')) {
				return Response.json({
					id_str: '1234567890123456789',
					text: 'Texto cargado desde syndication',
					created_at: '2026-05-29T10:15:00.000Z',
					favorite_count: 12,
					user: {
						name: 'Usuario Real',
						screen_name: 'usuario',
						verified: true,
						profile_image_url_https: 'https://pbs.twimg.com/profile_images/1/avatar_normal.jpg',
					},
				})
			}

			return new Response(null, { status: 500 })
		})

		setupTwitterLiteHandler()
		const handler = handlers.get('fetchTweetLiteData')
		expect(handler).toBeTruthy()

		const result = await handler?.({ data: { tweetUrl: 'https://x.com/usuario/status/1234567890123456789' } })

		expect(result).toEqual({
			success: true,
			data: expect.objectContaining({
				username: 'usuario',
				displayName: 'Usuario Real',
				text: 'Texto cargado desde syndication',
				url: 'https://twitter.com/usuario/status/1234567890123456789',
				isVerified: true,
				likeCount: 12,
				authorAvatarUrl: 'https://pbs.twimg.com/profile_images/1/avatar_normal.jpg',
			}),
		})
		expect(fetchMock).toHaveBeenCalledWith(
			expect.stringContaining('https://cdn.syndication.twimg.com/tweet-result'),
			expect.objectContaining({
				headers: { Accept: 'application/json' },
			})
		)
	})
})

describe('setupMvUserAvatarHandler', () => {
	const handlers = new Map<string, MessageHandler>()

	beforeEach(() => {
		handlers.clear()
		mockOnMessage.mockReset()
		mockOnMessage.mockImplementation((name: string, handler: MessageHandler) => {
			handlers.set(name, handler)
		})
		vi.restoreAllMocks()
	})

	it('resolves avatars from a Mediavida JSON payload served as text', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			new Response(
				JSON.stringify({
					suggestions: [
						{
							value: 'ImportedUser',
							data: {
								nombre: 'ImportedUser',
								avatar: 'imported-user.png',
							},
						},
					],
				}),
				{ status: 200, headers: { 'content-type': 'text/plain' } }
			)
		)

		setupMvUserAvatarHandler()
		const handler = handlers.get('resolveMvUserAvatar') as unknown as MvUserAvatarHandler | undefined

		const result = await handler?.({ data: { username: 'ImportedUser' } })

		expect(result).toEqual({
			success: true,
			username: 'ImportedUser',
			avatarUrl: 'https://www.mediavida.com/img/users/avatar/imported-user.png',
			error: undefined,
		})
	})

	it('resolves avatars from a Mediavida HTML fallback payload', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			new Response(
				`
					<li>
						<img src="/img/users/avatar/html-user.png" alt="HtmlUser">
						<a href="/id/HtmlUser">HtmlUser</a>
					</li>
				`,
				{ status: 200, headers: { 'content-type': 'text/html' } }
			)
		)

		setupMvUserAvatarHandler()
		const handler = handlers.get('resolveMvUserAvatar') as unknown as MvUserAvatarHandler | undefined

		const result = await handler?.({ data: { username: 'HtmlUser' } })

		expect(result).toEqual({
			success: true,
			username: 'HtmlUser',
			avatarUrl: 'https://www.mediavida.com/img/users/avatar/html-user.png',
			error: undefined,
		})
	})

	it('returns deduplicated user suggestions for autocomplete searches', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			new Response(
				JSON.stringify({
					suggestions: [
						{ value: 'RemoteUser', data: { nombre: 'RemoteUser', avatar: 'remote-user.png' } },
						{ value: 'RemoteUser2', data: { nombre: 'RemoteUser2', avatar: '' } },
						{ value: 'remoteuser', data: { nombre: 'remoteuser', avatar: 'dupe.png' } },
					],
				}),
				{ status: 200, headers: { 'content-type': 'text/plain' } }
			)
		)

		setupMvUserAvatarHandler()
		const handler = handlers.get('searchMvUsers') as unknown as MvUserSearchHandler | undefined

		const result = await handler?.({ data: { query: 'Remote' } })

		expect(result).toEqual({
			success: true,
			users: [
				{ username: 'RemoteUser', avatarUrl: 'https://www.mediavida.com/img/users/avatar/remote-user.png' },
				{ username: 'RemoteUser2', avatarUrl: undefined },
			],
		})
	})

	it('rejects invalid autocomplete queries without fetching', async () => {
		const fetchMock = vi.spyOn(globalThis, 'fetch')

		setupMvUserAvatarHandler()
		const handler = handlers.get('searchMvUsers') as unknown as MvUserSearchHandler | undefined

		const result = await handler?.({ data: { query: 'ab' } })

		expect(result).toEqual({ success: false, error: 'Consulta no valida' })
		expect(fetchMock).not.toHaveBeenCalled()
	})
})
