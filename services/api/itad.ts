/**
 * IsThereAnyDeal API facade.
 *
 * Content scripts call the background script through typed messaging; the
 * background owns external requests and the API key.
 */

import { sendMessage } from '@/lib/messaging'

export interface ItadPrice {
	amount: number
	amountInt: number
	currency: string
}

export interface ItadGameSearchResult {
	id: string
	slug: string
	title: string
	type: string
	mature: boolean
	assets?: {
		boxart?: string
		banner145?: string
		banner300?: string
		banner400?: string
		banner600?: string
	}
}

export interface ItadShop {
	id: number
	name: string
}

export interface ItadDealSummary {
	shop: ItadShop
	price: ItadPrice
	regular?: ItadPrice | null
	storeLow?: ItadPrice | null
	cut?: number | null
	url?: string
	timestamp?: string
	expiry?: string | null
	drm?: ItadShop[]
	platforms?: ItadShop[]
}

export interface ItadGamePriceOverview {
	id: string
	current?: ItadDealSummary | null
	lowest?: ItadDealSummary | null
	bundled?: number
	urls?: {
		game?: string
	}
}

export interface ItadHistoryLow {
	all?: ItadPrice | null
	y1?: ItadPrice | null
	m3?: ItadPrice | null
}

export interface ItadGamePrices {
	id: string
	historyLow?: ItadHistoryLow
	deals: ItadDealSummary[]
}

export interface ItadSearchWithPricesResult {
	games: ItadGameSearchResult[]
	prices: Record<string, ItadGamePriceOverview>
}

export async function hasItadApiKey(): Promise<boolean> {
	return sendMessage('hasItadApiKey', undefined)
}

export async function searchItadGames(query: string, results = 8): Promise<ItadGameSearchResult[]> {
	return sendMessage('itadSearchGames', { query, results })
}

export async function getItadPriceOverview(
	gameIds: string[],
	options: { country?: string } = {}
): Promise<Record<string, ItadGamePriceOverview>> {
	return sendMessage('itadPriceOverview', { gameIds, country: options.country })
}

export async function getItadGamePrices(
	gameIds: string[],
	options: { country?: string; capacity?: number } = {}
): Promise<Record<string, ItadGamePrices>> {
	return sendMessage('itadGamePrices', {
		gameIds,
		country: options.country,
		capacity: options.capacity,
	})
}

export async function searchItadGamesWithPrices(
	query: string,
	options: { results?: number; country?: string } = {}
): Promise<ItadSearchWithPricesResult> {
	const games = await searchItadGames(query, options.results ?? 8)
	const prices = games.length > 0
		? await getItadPriceOverview(games.map(game => game.id), { country: options.country })
		: {}

	return { games, prices }
}
