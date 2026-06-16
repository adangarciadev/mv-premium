import { afterEach, describe, expect, it, vi } from 'vitest'
import {
	extractSteamAppId,
	extractSteamBundleId,
	fetchSteamGameDetails,
	isSteamBundleUrl,
	isSteamUrl,
	searchSteamApps,
} from './steam'

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

describe('steam game details language fallback', () => {
	function makeAppDetailsResponse(appId: number, name: string, aboutTheGame: string): Response {
		return new Response(
			JSON.stringify({
				[String(appId)]: {
					success: true,
					data: {
						type: 'game',
						name,
						steam_appid: appId,
						required_age: 0,
						is_free: false,
						short_description: '',
						about_the_game: aboutTheGame,
						header_image: 'https://example.com/header.jpg',
						website: null,
					},
				},
			})
		)
	}

	it('refetches in English when Steam returns a non-Latin default language', async () => {
		// Steam serves the app's default language (e.g. Japanese) instead of
		// falling back to English when the requested Spanish locale is missing.
		vi.spyOn(globalThis, 'fetch')
			.mockResolvedValueOnce(
				makeAppDetailsResponse(
					910001,
					'何度目かの式',
					'<p>結婚式を舞台にした新たな推理ゲームをお届けします。殺された主人公が神の力で生き返って自分の死の原因を突き止めます。</p>'
				)
			)
			.mockResolvedValueOnce(
				makeAppDetailsResponse(
					910001,
					'Nandome ka no Shiki',
					'<p>A brand new mystery game set at a wedding ceremony. The murdered protagonist comes back to life to solve their own death.</p>'
				)
			)

		const result = await fetchSteamGameDetails(910001)

		expect(fetch).toHaveBeenCalledTimes(2)
		expect(String(vi.mocked(fetch).mock.calls[0][0])).toContain('l=spanish')
		expect(String(vi.mocked(fetch).mock.calls[1][0])).toContain('l=english')
		expect(result?.description).toContain('mystery game')
		expect(result?.name).toBe('Nandome ka no Shiki')
	})

	it('keeps the Spanish response without a second request when text is Latin script', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
			makeAppDetailsResponse(
				910002,
				'Juego de Misterio',
				'<p>Un nuevo juego de misterio ambientado en una boda. El protagonista asesinado vuelve a la vida para resolver su propia muerte.</p>'
			)
		)

		const result = await fetchSteamGameDetails(910002)

		expect(fetch).toHaveBeenCalledTimes(1)
		expect(String(vi.mocked(fetch).mock.calls[0][0])).toContain('l=spanish')
		expect(result?.description).toContain('juego de misterio')
	})

	it('keeps the default-language data when the English refetch fails', async () => {
		vi.spyOn(globalThis, 'fetch')
			.mockResolvedValueOnce(
				makeAppDetailsResponse(
					910003,
					'日本語のゲーム',
					'<p>これは日本語だけで書かれた説明文です。英語のフォールバックが失敗した場合でも元のデータを保持します。長い説明文がここに続きます。</p>'
				)
			)
			// 404 is not retried by fetchWithRetry, so the fallback fails fast
			.mockResolvedValueOnce(new Response('not found', { status: 404 }))

		const result = await fetchSteamGameDetails(910003)

		expect(result).not.toBeNull()
		expect(result?.name).toBe('日本語のゲーム')
	})
})

