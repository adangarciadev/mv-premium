import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockSendMessage = vi.hoisted(() => vi.fn())

vi.mock('@/lib/messaging', () => ({
	sendMessage: mockSendMessage,
}))

import { initFragranticaEmbeds, cleanupFragranticaEmbeds } from './fragrantica-embeds'

describe('fragrantica embeds', () => {
	beforeEach(() => {
		document.body.innerHTML = ''
		mockSendMessage.mockReset()
		cleanupFragranticaEmbeds()
	})

	it('mounts a card container after a Fragrantica perfume link and fetches its data', async () => {
		mockSendMessage.mockResolvedValue({
			success: true,
			data: {
				url: 'https://www.fragrantica.es/perfume/Dior/Sauvage-31861.html',
				title: 'Sauvage Dior',
				brand: 'Dior',
				audience: 'Hombres',
				image: 'https://fimgs.net/mdimg/perfume-thumbs/dark-375x500.31861.avif',
				rating: { value: 4.02, count: 18421 },
				accords: [{ label: 'fresco especiado', color: '#9ed7d5', score: 94 }],
				pyramid: { top: ['Bergamota'], middle: ['Lavanda'], base: ['Cedro'] },
				notes: [],
				wear: [],
			},
		})
		document.body.innerHTML = `
			<div class="post-contents">
				<p><a href="https://fragrantica.com/perfume/Dior/Sauvage-31861.html">Sauvage</a></p>
			</div>
		`

		initFragranticaEmbeds()
		await vi.waitFor(() => {
			expect(mockSendMessage).toHaveBeenCalledWith('fetchFragranticaFragrance', {
				url: 'https://www.fragrantica.es/perfume/Dior/Sauvage-31861.html',
			})
		})

		expect(document.querySelector('[data-feature-id^="mvp-fragrantica-inline-card-"]')).toBeTruthy()

		const link = document.querySelector<HTMLAnchorElement>('a[href*="fragrantica"]')
		expect(link?.href).toBe('https://www.fragrantica.es/perfume/Dior/Sauvage-31861.html')
	})

	it('converts fragrance tags around plain text into a Fragrantica source link', async () => {
		mockSendMessage.mockResolvedValue({
			success: false,
			error: 'Fragrantica no disponible',
		})
		document.body.innerHTML = `
			<div class="post-contents">
				<p>[frangance]https://www.fragrantica.es/perfume/Dior/Sauvage-31861.html[/frangance]</p>
			</div>
		`

		initFragranticaEmbeds()
		await vi.waitFor(() => {
			expect(document.querySelector('a.mvp-fragrantica-source-link')).toBeTruthy()
		})

		expect(document.querySelector('a.mvp-fragrantica-source-link')?.textContent).toBe('Fragrantica')
		expect(document.body.textContent).not.toContain('[frangance]')

		await vi.waitFor(() => {
			expect(mockSendMessage).toHaveBeenCalledWith('fetchFragranticaFragrance', {
				url: 'https://www.fragrantica.es/perfume/Dior/Sauvage-31861.html',
			})
		})
		expect(document.querySelector('[data-feature-id^="mvp-fragrantica-inline-card-"]')).toBeTruthy()
	})
})
