import { afterEach, describe, expect, it, vi } from 'vitest'
import { extractSteamAppId, extractSteamBundleId, isSteamBundleUrl, isSteamUrl, searchSteamApps } from './steam'

afterEach(() => {
	vi.restoreAllMocks()
})

describe('steam url helpers', () => {
	it('extracts steam app id from store URLs', () => {
		expect(extractSteamAppId('https://store.steampowered.com/app/1091500/Cyberpunk_2077/')).toBe(1091500)
		expect(extractSteamAppId('https://store.steampowered.com/app/570')).toBe(570)
	})

	it('returns null for non-app steam urls', () => {
		expect(extractSteamAppId('https://store.steampowered.com/bundle/33369')).toBeNull()
		expect(extractSteamAppId('https://google.com')).toBeNull()
	})

	it('detects steam app urls', () => {
		expect(isSteamUrl('https://store.steampowered.com/app/440')).toBe(true)
		expect(isSteamUrl('https://store.steampowered.com/bundle/33369')).toBe(false)
	})

	it('extracts steam bundle id from bundle URLs', () => {
		expect(extractSteamBundleId('https://store.steampowered.com/bundle/33369/Borderlands_Collection/')).toBe(33369)
		expect(extractSteamBundleId('https://store.steampowered.com/bundle/33369')).toBe(33369)
	})

	it('returns null for non-bundle steam urls', () => {
		expect(extractSteamBundleId('https://store.steampowered.com/app/1091500')).toBeNull()
		expect(extractSteamBundleId('https://google.com')).toBeNull()
	})

	it('detects steam bundle urls', () => {
		expect(isSteamBundleUrl('https://store.steampowered.com/bundle/33369')).toBe(true)
		expect(isSteamBundleUrl('https://store.steampowered.com/app/1091500')).toBe(false)
	})
})

describe('steam app search', () => {
	it('maps Steam storesearch app results', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
			new Response(
				JSON.stringify({
					items: [
						{
							type: 'app',
							id: 292030,
							name: 'The Witcher 3: Wild Hunt',
							tiny_image: 'https://cdn.example/witcher.jpg',
						},
						{
							type: 'sub',
							id: 1,
							name: 'Ignored package',
						},
					],
				})
			)
		)

		const result = await searchSteamApps('witcher', 5)

		expect(fetch).toHaveBeenCalledWith(
			'https://store.steampowered.com/api/storesearch/?term=witcher&l=spanish&cc=es'
		)
		expect(result).toEqual([
			{
				appId: 292030,
				name: 'The Witcher 3: Wild Hunt',
				appUrl: 'https://store.steampowered.com/app/292030',
				tinyImage: 'https://cdn.example/witcher.jpg',
			},
		])
	})
})

