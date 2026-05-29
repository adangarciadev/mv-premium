import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockOnMessage = vi.hoisted(() => vi.fn())

vi.mock('@/lib/messaging', () => ({
	onMessage: mockOnMessage,
}))

import { setupTwitterLiteHandler } from './api-handlers'

type MessageHandler = (message: { data: { tweetUrl: string } }) => Promise<unknown>

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
