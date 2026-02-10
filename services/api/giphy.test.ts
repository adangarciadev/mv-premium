import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/messaging', () => ({
	sendMessage: vi.fn(),
}))

import { sendMessage } from '@/lib/messaging'
import { getTrendingGifs, searchGifs } from './giphy'

const mockSendMessage = sendMessage as ReturnType<typeof vi.fn>

describe('GIPHY API service', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mockSendMessage.mockReset()
	})

	it('proxies trending requests through background messaging', async () => {
		const mockResponse = {
			gifs: [{ id: '1', title: 'GIF 1', url: 'https://giphy.com/1.gif', previewUrl: 'https://giphy.com/1_small.gif' }],
			pagination: { totalCount: 100, count: 18, offset: 18 },
		}
		mockSendMessage.mockResolvedValueOnce(mockResponse)

		const result = await getTrendingGifs(18)

		expect(mockSendMessage).toHaveBeenCalledWith('giphyTrending', { offset: 18 })
		expect(result).toEqual(mockResponse)
	})

	it('normalizes negative trending offset to zero', async () => {
		mockSendMessage.mockResolvedValueOnce({
			gifs: [],
			pagination: { totalCount: 0, count: 0, offset: 0 },
		})

		await getTrendingGifs(-50)

		expect(mockSendMessage).toHaveBeenCalledWith('giphyTrending', { offset: 0 })
	})

	it('returns empty result without messaging when search query is empty', async () => {
		const result = await searchGifs('   ')

		expect(mockSendMessage).not.toHaveBeenCalled()
		expect(result).toEqual({ gifs: [], pagination: { totalCount: 0, count: 0, offset: 0 } })
	})

	it('proxies search requests through background messaging', async () => {
		const mockResponse = {
			gifs: [{ id: '2', title: 'GIF 2', url: 'https://giphy.com/2.gif', previewUrl: 'https://giphy.com/2_small.gif' }],
			pagination: { totalCount: 12, count: 12, offset: 0 },
		}
		mockSendMessage.mockResolvedValueOnce(mockResponse)

		const result = await searchGifs(' cats ', -5)

		expect(mockSendMessage).toHaveBeenCalledWith('giphySearch', {
			query: 'cats',
			offset: 0,
		})
		expect(result).toEqual(mockResponse)
	})
})
