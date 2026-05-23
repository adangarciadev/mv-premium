/**
 * Context Menus Module
 * Handles creation and event handling for browser context menus
 */

import { browser } from 'wxt/browser'
import { storage } from '#imports'
import { logger } from '@/lib/logger'
import { MV_BASE_URL, STORAGE_KEYS } from '@/constants'
import { saveThreadFromUrl } from '@/features/saved-threads/logic/storage'
import { hideThreadFromUrl, isThreadHidden } from '@/features/hidden-threads/logic/storage'
import { saveClippedThreadPrefill } from '@/features/thread-clipper'
import { addThreadClipperHistoryEntry } from '@/features/thread-clipper/logic/history-storage'
import {
	clearThreadClipperBasket,
	createThreadClipperSessionId,
	readThreadClipperBasket,
	saveThreadClipperBasket,
} from '@/features/thread-clipper/logic/basket-storage'
import {
	buildClippedThreadPrefill as buildClippedThreadPrefillFromRenderer,
	THREAD_CLIPPER_LIMITS,
	normalizeClipMediaUrls as normalizeClipMediaUrlsFromRenderer,
	normalizeClipSourceUrl as normalizeClipSourceUrlFromRenderer,
	sanitizeBbcodeMultilineText as sanitizeBbcodeMultilineTextFromRenderer,
	trimThreadTitle,
} from '@/features/thread-clipper/logic/bbcode-renderer'
import type {
	CapturedPageClip,
	ClipSourceMetadata,
	ThreadClipperBasket,
	ThreadClipperBasketItem,
	ThreadClipperCreateSnapshot,
	ThreadClipperTemplate,
	ThreadClipperTextFormat,
} from '@/features/thread-clipper/logic/types'
import { THREAD_CLIPPER_DRAFT_VERSION } from '@/features/thread-clipper/logic/types'
import { ALL_PRESETS } from '@/features/theme-editor/presets'
import { onMessage, sendMessage } from '@/lib/messaging'
import { ALL_SUBFORUMS, VALID_SUBFORUM_SLUGS, getNewThreadUrl, type SubforumInfo } from '@/lib/subforums'
import type { ThemeColors, ThemePreset } from '@/types/theme'

const CONTEXT_MENU_IDS = {
	SAVE_THREAD: 'mvp-save-thread',
	HIDE_THREAD: 'mvp-hide-thread',
	MUTE_WORD: 'mvp-mute-word',
	OPEN_THREAD_CLIPPER: 'mvp-open-thread-clipper',
} as const

const CLIPPER_CONTEXTS = ['page', 'link', 'selection'] as const
const DEFAULT_CLIPPER_SUBFORUMS = ['juegos'] as const
const FALLBACK_THREAD_CLIPPER_THEME: ThreadClipperThemePalette = {
	mode: 'dark',
	background: '#101213',
	panel: '#1c1f22',
	panelStrong: '#232a2e',
	text: '#e7e9ea',
	muted: '#a5aeb5',
	line: '#30353a',
	input: '#30353a',
	accent: '#fc8f22',
	accentForeground: '#0f1419',
	hover: '#2f383e',
	danger: '#e02f2f',
}
const MAX_SELECTION_LENGTH = THREAD_CLIPPER_LIMITS.maxSelectionLength
let contextMenuCreationQueue = Promise.resolve()
let pendingClipperSubforumsOverride: string[] | null = null

interface ThreadClipperThemePalette {
	mode: 'dark' | 'light'
	background: string
	panel: string
	panelStrong: string
	text: string
	muted: string
	line: string
	input: string
	accent: string
	accentForeground: string
	hover: string
	danger: string
}

interface ThreadClipperTraySnapshot {
	sessionId: string
	title: string
	sourceTitle: string
	sourceUrl: string
	sourceHost: string
	contentMode?: 'article' | 'media-only'
	description?: string
	publishedAt?: string
	texts: Array<{ id: string; itemIndex: number; value: string; preview: string }>
	media: Array<{ id: string; itemIndex: number; url: string; label: string }>
	activePicker?: 'media'
	textFormat: ThreadClipperTextFormat
	selectedSubforum?: string
	bbcode: string
	theme: ThreadClipperThemePalette
	subforums: Array<{ slug: string; name: string }>
}

interface ThreadClipperTrayMessage {
	type: 'mvp-thread-clipper-tray'
	sessionId?: string
	action:
		| 'add-selection'
		| 'add-media'
		| 'set-picker'
		| 'set-text-format'
		| 'set-title'
		| 'set-subforum'
		| 'update-text-item'
		| 'remove-item'
		| 'clear-kind'
		| 'clear'
		| 'create'
	subforum?: string
	title?: string
	value?: string
	mediaUrl?: string
	itemIndex?: number
	itemType?: ThreadClipperBasketItem['type']
	pickerMode?: 'media' | 'none'
	textFormat?: ThreadClipperTextFormat
	createSnapshot?: ThreadClipperCreateSnapshot
}

interface PersistedThreadClipperSettings {
	state?: {
		theme?: unknown
		threadClipperSubforums?: unknown
	}
}

// =============================================================================
// Context Menu Creation
// =============================================================================

/**
 * Create all context menu items
 */
export async function createContextMenus(clipperSubforumsOverride?: string[]): Promise<void> {
	if (clipperSubforumsOverride) {
		pendingClipperSubforumsOverride = clipperSubforumsOverride
	}

	contextMenuCreationQueue = contextMenuCreationQueue
		.catch(() => {
			// Keep future menu rebuilds working even if the previous one failed.
		})
		.then(recreateContextMenus)

	await contextMenuCreationQueue
}

async function recreateContextMenus(): Promise<void> {
	// Remove existing menus first (for updates)
	await browser.contextMenus.removeAll()

	// "Guardar hilo" - always available from context menu
	browser.contextMenus.create({
		id: CONTEXT_MENU_IDS.SAVE_THREAD,
		title: '📌  Guardar hilo',
		contexts: ['link'],
		targetUrlPatterns: ['*://www.mediavida.com/foro/*/*'],
	})

	// "Ocultar hilo" - always available from context menu
	browser.contextMenus.create({
		id: CONTEXT_MENU_IDS.HIDE_THREAD,
		title: '🙈  Ocultar hilo',
		contexts: ['link'],
		targetUrlPatterns: ['*://www.mediavida.com/foro/*/*'],
	})

	// "Silenciar palabra" - appears when text is selected on Mediavida
	// This is core functionality (muted words) but could be toggled too if requested.
	// For now keeping it always available as it's the primary way to add muted words.
	browser.contextMenus.create({
		id: CONTEXT_MENU_IDS.MUTE_WORD,
		title: '🔇 Silenciar palabra',
		contexts: ['selection'],
		documentUrlPatterns: ['*://www.mediavida.com/*'],
	})

	await createThreadClipperMenus()
}

async function createThreadClipperMenus(): Promise<void> {
	const configuredSubforums = await getConfiguredClipperSubforums()
	if (configuredSubforums.length === 0) return

	browser.contextMenus.create({
		id: CONTEXT_MENU_IDS.OPEN_THREAD_CLIPPER,
		title: 'MV Premium: preparar hilo',
		contexts: [...CLIPPER_CONTEXTS],
		documentUrlPatterns: ['http://*/*', 'https://*/*'],
	})
}

async function getConfiguredClipperSubforums(): Promise<SubforumInfo[]> {
	if (pendingClipperSubforumsOverride) {
		const configured = normalizeClipperSubforumSlugs(pendingClipperSubforumsOverride)
		pendingClipperSubforumsOverride = null
		return getSubforumInfoList(configured)
	}

	try {
		const settings = await readThreadClipperSettings()
		if (!settings) return getFallbackClipperSubforums()
		const configuredValue = settings.state?.threadClipperSubforums
		if (!Array.isArray(configuredValue)) return getFallbackClipperSubforums()

		return getSubforumInfoList(normalizeClipperSubforumSlugs(configuredValue))
	} catch (error) {
		logger.warn('Could not read configured thread clipper subforums:', error)
		return getFallbackClipperSubforums()
	}
}

async function readThreadClipperSettings(): Promise<PersistedThreadClipperSettings | null> {
	const raw = await storage.getItem<string>(`local:${STORAGE_KEYS.SETTINGS}`)
	if (!raw) return null
	return JSON.parse(raw) as PersistedThreadClipperSettings
}

function isHexColor(value: unknown): value is string {
	return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)
}

function getThemeColor(
	colors: Partial<ThemeColors> | undefined,
	key: keyof ThemeColors,
	fallback: string
): string {
	const value = colors?.[key]
	return isHexColor(value) ? value : fallback
}

function buildThreadClipperThemePalette(
	mode: ThreadClipperThemePalette['mode'],
	colors: Partial<ThemeColors>
): ThreadClipperThemePalette {
	return {
		mode,
		background: getThemeColor(colors, 'background', FALLBACK_THREAD_CLIPPER_THEME.background),
		panel: getThemeColor(colors, 'card', FALLBACK_THREAD_CLIPPER_THEME.panel),
		panelStrong: getThemeColor(colors, 'secondary', FALLBACK_THREAD_CLIPPER_THEME.panelStrong),
		text: getThemeColor(colors, 'foreground', FALLBACK_THREAD_CLIPPER_THEME.text),
		muted: getThemeColor(colors, 'mutedForeground', FALLBACK_THREAD_CLIPPER_THEME.muted),
		line: getThemeColor(colors, 'border', FALLBACK_THREAD_CLIPPER_THEME.line),
		input: getThemeColor(colors, 'input', FALLBACK_THREAD_CLIPPER_THEME.input),
		accent: getThemeColor(colors, 'primary', FALLBACK_THREAD_CLIPPER_THEME.accent),
		accentForeground: getThemeColor(colors, 'primaryForeground', FALLBACK_THREAD_CLIPPER_THEME.accentForeground),
		hover: getThemeColor(colors, 'muted', FALLBACK_THREAD_CLIPPER_THEME.hover),
		danger: getThemeColor(colors, 'destructive', FALLBACK_THREAD_CLIPPER_THEME.danger),
	}
}

async function getThreadClipperThemePalette(): Promise<ThreadClipperThemePalette> {
	try {
		const [settings, themeState, savedPresets] = await Promise.all([
			readThreadClipperSettings(),
			storage.getItem<{
				activePresetId?: string
				customColorsLight?: Partial<ThemeColors>
				customColorsDark?: Partial<ThemeColors>
			}>(`local:${STORAGE_KEYS.THEME_CUSTOM}`),
			storage.getItem<ThemePreset[]>(`local:${STORAGE_KEYS.THEME_SAVED_PRESETS}`),
		])
		const mode = settings?.state?.theme === 'light' ? 'light' : 'dark'
		const activePresetId = themeState?.activePresetId || 'mediavida'
		const savedPreset = Array.isArray(savedPresets) ? savedPresets.find(preset => preset.id === activePresetId) : undefined
		const builtInPreset = ALL_PRESETS.find(preset => preset.id === activePresetId)
		const presetColors = savedPreset?.colors[mode] || builtInPreset?.colors[mode]
		const customColors = mode === 'light' ? themeState?.customColorsLight : themeState?.customColorsDark
		return buildThreadClipperThemePalette(mode, { ...presetColors, ...customColors })
	} catch (error) {
		logger.warn('Could not read thread clipper theme colors:', error)
	}

	return FALLBACK_THREAD_CLIPPER_THEME
}

function normalizeClipperSubforumSlugs(value: unknown[]): string[] {
	return value
		.filter((slug): slug is string => typeof slug === 'string' && VALID_SUBFORUM_SLUGS.has(slug))
		.filter((slug, index, slugs) => slugs.indexOf(slug) === index)
}

function getSubforumInfoList(slugs: string[]): SubforumInfo[] {
	const bySlug = new Map(ALL_SUBFORUMS.map(subforum => [subforum.slug, subforum]))
	return slugs.map(slug => bySlug.get(slug)).filter((subforum): subforum is SubforumInfo => Boolean(subforum))
}

function getFallbackClipperSubforums(): SubforumInfo[] {
	return ALL_SUBFORUMS.filter(subforum => (DEFAULT_CLIPPER_SUBFORUMS as readonly string[]).includes(subforum.slug))
}

// =============================================================================
// Context Menu Click Handler
// =============================================================================

/**
 * Setup context menu click listener
 */
export function setupContextMenuListener(): void {
	browser.contextMenus.onClicked.addListener(async (info, tab) => {
		const { menuItemId, linkUrl, pageUrl, selectionText } = info
		const sourceUrl = pageUrl || tab?.url || linkUrl || ''

		if (menuItemId === CONTEXT_MENU_IDS.OPEN_THREAD_CLIPPER) {
			if (isMediavidaSourceUrl(sourceUrl)) {
				notifyTab(tab?.id, 'ℹ️ El recortador de noticias no se usa dentro de Mediavida')
				return
			}
			await handleOpenThreadClipperTray({
				sourceUrl,
				tabTitle: tab?.title || '',
				tabId: tab?.id,
			})
			return
		}

		switch (menuItemId) {
			case CONTEXT_MENU_IDS.SAVE_THREAD:
				if (linkUrl) await handleSaveThread(linkUrl, tab?.id)
				break
			case CONTEXT_MENU_IDS.HIDE_THREAD:
				if (linkUrl) await handleHideThread(linkUrl, tab?.id)
				break
			case CONTEXT_MENU_IDS.MUTE_WORD:
				if (selectionText) await handleMuteWord(selectionText, tab?.id)
				break
		}
	})
}

export function setupContextMenuRefreshHandler(): void {
	onMessage('refreshContextMenus', async ({ data }) => {
		await createContextMenus(data?.threadClipperSubforums)
		return true
	})
}

export function setupThreadClipperTrayListener(): void {
	browser.runtime.onMessage.addListener((message: unknown, sender) => {
		const request = message as Partial<ThreadClipperTrayMessage>
		if (request.type !== 'mvp-thread-clipper-tray') return false

		void handleThreadClipperTrayAction(request, sender.tab?.id)
		return false
	})
}

// =============================================================================
// Handler Functions
// =============================================================================

/**
 * Save a thread from context menu
 */
async function handleSaveThread(url: string, tabId?: number): Promise<void> {
	try {
		const savedThread = await saveThreadFromUrl(url)
		if (!savedThread) {
			notifyTab(tabId, '❌ URL de hilo no válida')
			return
		}
		notifyTab(tabId, '✅ Hilo guardado')
	} catch (error) {
		logger.error('Error saving thread:', error)
		notifyTab(tabId, '❌ Error al guardar')
	}
}

/**
 * Hide a thread from context menu
 */
async function handleHideThread(url: string, tabId?: number): Promise<void> {
	try {
		const alreadyHidden = await isThreadHidden(url)
		if (alreadyHidden) {
			notifyTab(tabId, 'ℹ️ El hilo ya estaba oculto')
			return
		}

		const hiddenThread = await hideThreadFromUrl(url)
		if (!hiddenThread) {
			notifyTab(tabId, '❌ URL de hilo no válida')
			return
		}

		notifyTab(tabId, '🙈 Hilo ocultado')
	} catch (error) {
		logger.error('Error hiding thread:', error)
		notifyTab(tabId, '❌ Error al ocultar hilo')
	}
}

/**
 * Add a word/phrase to the muted words list
 */
async function handleMuteWord(word: string, tabId?: number): Promise<void> {
	try {
		// Normalize the word (lowercase, trimmed)
		const normalizedWord = word.trim().toLowerCase()

		if (!normalizedWord) {
			notifyTab(tabId, '❌ Selección vacía')
			return
		}

		// Validation: Single words only
		if (/\s/.test(normalizedWord)) {
			notifyTab(tabId, '❌ Solo se pueden silenciar palabras sueltas')
			return
		}

		if (normalizedWord.length > 20) {
			notifyTab(tabId, '❌ Selección demasiado larga (máx. 20)')
			return
		}

		// Read current settings from storage
		const raw = await storage.getItem<string>(`local:${STORAGE_KEYS.SETTINGS}`)
		let settings: { state?: { mutedWords?: string[]; mutedWordsEnabled?: boolean } } = {}

		if (raw) {
			try {
				settings = JSON.parse(raw)
			} catch {
				settings = {}
			}
		}

		const currentWords = settings.state?.mutedWords || []

		// Check if already muted
		if (currentWords.includes(normalizedWord)) {
			notifyTab(tabId, `ℹ️ "${normalizedWord}" ya está silenciada`)
			return
		}

		// Add the word
		const newWords = [...currentWords, normalizedWord]

		// Update settings
		const newSettings = {
			...settings,
			state: {
				...settings.state,
				mutedWords: newWords,
				mutedWordsEnabled: true, // Auto-enable when adding words
			},
		}

		await storage.setItem(`local:${STORAGE_KEYS.SETTINGS}`, JSON.stringify(newSettings))

		notifyTab(tabId, `🔇 "${normalizedWord}" silenciada`)

		// Optionally reload the tab so the word gets filtered immediately
		if (tabId) {
			try {
				await browser.tabs.reload(tabId)
			} catch {
				// Ignore reload errors
			}
		}
	} catch (error) {
		logger.error('Error muting word:', error)
		notifyTab(tabId, '❌ Error al silenciar palabra')
	}
}

function normalizeWhitespace(value: string): string {
	return value.replace(/\s+/g, ' ').trim()
}

function sanitizeBbcodeText(value: string): string {
	return normalizeWhitespace(value).replace(/\[/g, '(').replace(/\]/g, ')')
}

function sanitizeBbcodeMultilineText(value: string): string {
	return sanitizeBbcodeMultilineTextFromRenderer(value)
}

function normalizeClipSourceUrl(url: string): string | null {
	return normalizeClipSourceUrlFromRenderer(url)
}

function getHostname(url: string): string {
	try {
		return new URL(url).hostname.replace(/^www\./, '')
	} catch {
		return 'enlace'
	}
}

function buildSourceLinkTitle(tabTitle: string, sourceUrl: string): string {
	const title = sanitizeBbcodeText(tabTitle)
		.replace(/\s+[-|]\s+X$/i, '')
		.replace(/\s+[-|]\s+Twitter$/i, '')
	return title || `Noticia de ${getHostname(sourceUrl)}`
}

function isMediavidaSourceUrl(url: string): boolean {
	try {
		const host = new URL(url).hostname.replace(/^www\./, '').toLowerCase()
		return host === 'mediavida.com' || host.endsWith('.mediavida.com')
	} catch {
		return false
	}
}

function isDirectClipperBlockedSourceUrl(url: string | undefined): boolean {
	if (!url) return false
	try {
		const host = new URL(url).hostname.replace(/^www\./, '').toLowerCase()
		return (
			host === 'youtu.be' ||
			host === 'youtube.com' ||
			host.endsWith('.youtube.com') ||
			host === 'ytimg.com' ||
			host.endsWith('.ytimg.com') ||
			host === 'youtube-nocookie.com' ||
			host.endsWith('.youtube-nocookie.com') ||
			host === 'twitter.com' ||
			host === 'x.com' ||
			host.endsWith('.twitter.com') ||
			host.endsWith('.x.com') ||
			host === 'instagram.com' ||
			host.endsWith('.instagram.com') ||
			host === 'instagr.am'
		)
	} catch {
		return false
	}
}

function normalizeClipMediaUrls(mediaUrls: readonly string[] = []): string[] {
	return normalizeClipMediaUrlsFromRenderer(mediaUrls)
}

function getMediaLabel(url: string): string {
	try {
		const parsed = new URL(url)
		const host = parsed.hostname.replace(/^www\./, '').toLowerCase()
		if (host.includes('youtu')) return 'YouTube'
		if (host.includes('twitter') || host === 'x.com') return 'X/Twitter'
		if (host.includes('instagram') || host === 'instagr.am') return 'Instagram'
		return host
	} catch {
		return 'Media'
	}
}

export function buildClippedThreadPrefill(input: {
	subforum: string
	sourceUrl: string
	tabTitle: string
	selectionText?: string
	items?: ThreadClipperBasketItem[]
	textFormat?: ThreadClipperTextFormat
	template?: ThreadClipperTemplate
	titleOverride?: string
	contentMode?: 'article' | 'media-only'
	description?: string
	publishedAt?: string
}): ReturnType<typeof buildClippedThreadPrefillFromRenderer> {
	return buildClippedThreadPrefillFromRenderer(input)
}

async function openThreadClipperBasket(input: {
	sourceUrl: string
	sourceTitle: string
	tabId: number
	source?: ClipSourceMetadata
	title?: string
	items?: ThreadClipperBasketItem[]
	contentMode?: ThreadClipperBasket['contentMode']
}): Promise<ThreadClipperBasket | null> {
	const sourceUrl = normalizeClipSourceUrl(input.sourceUrl)
	if (!sourceUrl) return null

	const current = await readThreadClipperBasket()
	if (current?.sourceUrl === sourceUrl && current.tabId === input.tabId) {
		if (input.source && !current.source) {
			const updatedBasket = {
				...current,
				source: input.source,
				sourceTitle: input.source.title || current.sourceTitle,
				title:
					input.title !== undefined
						? trimThreadTitle(input.title)
						: current.title || trimThreadTitle(input.source.title || current.sourceTitle),
				contentMode: input.contentMode ?? current.contentMode ?? 'article',
				items: input.items?.length ? appendBasketItems(current.items, input.items) : current.items,
				updatedAt: Date.now(),
			}
			await saveThreadClipperBasket(updatedBasket)
			return updatedBasket
		}
		if (input.items?.length || input.title !== undefined || input.contentMode) {
			const updatedBasket = {
				...current,
				title: input.title !== undefined ? trimThreadTitle(input.title) : current.title,
				contentMode: input.contentMode ?? current.contentMode ?? 'article',
				items: input.items?.length ? appendBasketItems(current.items, input.items) : current.items,
				updatedAt: Date.now(),
			}
			await saveThreadClipperBasket(updatedBasket)
			return updatedBasket
		}
		return current
	}

	const now = Date.now()
	const basket: ThreadClipperBasket = {
		version: THREAD_CLIPPER_DRAFT_VERSION,
		sessionId: createThreadClipperSessionId(),
		tabId: input.tabId,
		sourceUrl,
		sourceTitle: input.source?.title || input.sourceTitle,
		source: input.source,
		title:
			input.title !== undefined
				? trimThreadTitle(input.title)
				: trimThreadTitle(input.source?.title || input.sourceTitle),
		contentMode: input.contentMode ?? 'article',
		template: 'news',
		items: input.items ?? [],
		textFormat: 'quote',
		createdAt: now,
		updatedAt: now,
	}
	await saveThreadClipperBasket(basket)
	return basket
}

function createBasketItems(input: {
	text?: string
	mediaUrls?: readonly string[]
}): ThreadClipperBasketItem[] {
	const items: ThreadClipperBasketItem[] = []
	const text = sanitizeBbcodeMultilineText(input.text || '')
		.slice(0, MAX_SELECTION_LENGTH)
		.trim()
	if (text) items.push({ type: 'text', value: text })
	for (const mediaUrl of normalizeClipMediaUrls(input.mediaUrls ?? [])) {
		items.push({ type: 'media', value: mediaUrl })
	}
	return items
}

function appendBasketItems(
	existing: ThreadClipperBasketItem[],
	incoming: ThreadClipperBasketItem[]
): ThreadClipperBasketItem[] {
	const items = [...existing]
	for (const item of incoming) {
		if (
			item.type === 'media' &&
			items.some(existingItem => existingItem.type === 'media' && existingItem.value === item.value)
		) {
			continue
		}
		if (item.type === 'media' && items.filter(existingItem => existingItem.type === 'media').length >= THREAD_CLIPPER_LIMITS.maxMediaItems) {
			continue
		}
		if (
			item.type === 'text' &&
			items.some(existingItem => existingItem.type === 'text' && existingItem.value === item.value)
		) {
			continue
		}
		if (item.type === 'text' && items.filter(existingItem => existingItem.type === 'text').length >= THREAD_CLIPPER_LIMITS.maxTextItems) {
			continue
		}
		items.push(item)
	}
	return items
}

async function addToThreadClipperBasket(input: {
	sourceUrl: string
	sourceTitle: string
	sessionId: string
	tabId: number
	items: ThreadClipperBasketItem[]
	source?: ClipSourceMetadata
	title?: string
	contentMode?: ThreadClipperBasket['contentMode']
}): Promise<ThreadClipperBasket | null> {
	const sourceUrl = normalizeClipSourceUrl(input.sourceUrl)
	if (!sourceUrl || input.items.length === 0) return null

	const current = await readThreadClipperBasket()
	const now = Date.now()
	const isSameSource = current?.sourceUrl === sourceUrl && current.sessionId === input.sessionId && current.tabId === input.tabId
	const basket: ThreadClipperBasket = {
		version: THREAD_CLIPPER_DRAFT_VERSION,
		sessionId: isSameSource ? current.sessionId : input.sessionId,
		tabId: input.tabId,
		sourceUrl,
		sourceTitle: isSameSource ? current.sourceTitle : input.source?.title || input.sourceTitle,
		source: isSameSource ? current.source || input.source : input.source,
		title:
			input.title !== undefined
				? trimThreadTitle(input.title)
				: isSameSource
				? current.title
				: trimThreadTitle(input.source?.title || input.sourceTitle),
		contentMode: isSameSource ? current.contentMode : input.contentMode ?? 'article',
		items: isSameSource ? appendBasketItems(current.items, input.items) : input.items,
		activePicker: isSameSource ? current.activePicker : undefined,
		textFormat: isSameSource ? current.textFormat ?? 'quote' : 'quote',
		template: isSameSource ? current.template ?? 'news' : 'news',
		createdAt: isSameSource ? current.createdAt : now,
		updatedAt: now,
	}
	await saveThreadClipperBasket(basket)
	return basket
}

async function updateThreadClipperBasketItems(
	basket: ThreadClipperBasket,
	items: ThreadClipperBasketItem[]
): Promise<ThreadClipperBasket> {
	const updatedBasket: ThreadClipperBasket = {
		...basket,
		items,
		updatedAt: Date.now(),
	}
	await saveThreadClipperBasket(updatedBasket)
	return updatedBasket
}

async function updateThreadClipperBasketPicker(
	basket: ThreadClipperBasket,
	activePicker: ThreadClipperBasket['activePicker']
): Promise<ThreadClipperBasket> {
	const updatedBasket: ThreadClipperBasket = {
		...basket,
		activePicker,
		updatedAt: Date.now(),
	}
	await saveThreadClipperBasket(updatedBasket)
	return updatedBasket
}

async function updateThreadClipperBasketTextFormat(
	basket: ThreadClipperBasket,
	textFormat: ThreadClipperTextFormat
): Promise<ThreadClipperBasket> {
	const updatedBasket: ThreadClipperBasket = {
		...basket,
		textFormat,
		updatedAt: Date.now(),
	}
	await saveThreadClipperBasket(updatedBasket)
	return updatedBasket
}

async function updateThreadClipperBasketTitle(
	basket: ThreadClipperBasket,
	title: string
): Promise<ThreadClipperBasket> {
	const updatedBasket: ThreadClipperBasket = {
		...basket,
		title: trimThreadTitle(title),
		updatedAt: Date.now(),
	}
	await saveThreadClipperBasket(updatedBasket)
	return updatedBasket
}

async function updateThreadClipperBasketSubforum(
	basket: ThreadClipperBasket,
	subforum: string
): Promise<ThreadClipperBasket> {
	const updatedBasket: ThreadClipperBasket = {
		...basket,
		subforum,
		updatedAt: Date.now(),
	}
	await saveThreadClipperBasket(updatedBasket)
	return updatedBasket
}

function basketToPrefillInput(input: {
	subforum: string
	basket: ThreadClipperBasket
	currentItems?: ThreadClipperBasketItem[]
}): Parameters<typeof buildClippedThreadPrefill>[0] {
	const items = appendBasketItems(input.basket.items, input.currentItems ?? [])
	const firstText = items.find(item => item.type === 'text')?.value
	return {
		subforum: input.subforum,
		sourceUrl: input.basket.sourceUrl,
		tabTitle: input.basket.sourceTitle,
		selectionText: firstText,
		items,
		textFormat: input.basket.textFormat ?? 'quote',
		template: input.basket.template ?? 'news',
		titleOverride: input.basket.title,
		contentMode: input.basket.contentMode,
		description: input.basket.source?.description,
		publishedAt: input.basket.source?.publishedAt,
	}
}

function getBasketSnapshot(
	basket: ThreadClipperBasket,
	subforums: SubforumInfo[],
	theme: ThreadClipperThemePalette
): ThreadClipperTraySnapshot {
	const texts: ThreadClipperTraySnapshot['texts'] = []
	const media: ThreadClipperTraySnapshot['media'] = []
	const selectedSubforum =
		basket.subforum && VALID_SUBFORUM_SLUGS.has(basket.subforum) ? basket.subforum : subforums[0]?.slug
	const prefill = selectedSubforum
		? buildClippedThreadPrefill(basketToPrefillInput({ subforum: selectedSubforum, basket }))
		: null

	basket.items.forEach((item, itemIndex) => {
		if (item.type === 'text') {
			texts.push({
				id: `text-${itemIndex}`,
				itemIndex,
				value: item.value,
				preview: item.value.length > 260 ? `${item.value.slice(0, 260).trimEnd()}...` : item.value,
			})
			return
		}
		media.push({
			id: `media-${itemIndex}`,
			itemIndex,
			url: item.value,
			label: getMediaLabel(item.value),
		})
	})

	return {
		sessionId: basket.sessionId,
		title: basket.title !== undefined ? basket.title : trimThreadTitle(basket.source?.title || basket.sourceTitle),
		sourceTitle: basket.sourceTitle,
		sourceUrl: basket.sourceUrl,
		sourceHost: getHostname(basket.sourceUrl),
		contentMode: basket.contentMode,
		description: basket.source?.description,
		publishedAt: basket.source?.publishedAt,
		texts,
		media,
		activePicker: basket.activePicker,
		textFormat: basket.textFormat ?? 'quote',
		selectedSubforum,
		bbcode: prefill?.body ?? '',
		theme,
		subforums: subforums.map(subforum => ({ slug: subforum.slug, name: subforum.name })),
	}
}

function renderThreadClipperTray(snapshot: ThreadClipperTraySnapshot): void {
	const HOST_ID = 'mvp-thread-clipper-tray-host'
	const trayGlobal = globalThis as typeof globalThis & { __mvpThreadClipperTrayCleanup?: () => void }
	trayGlobal.__mvpThreadClipperTrayCleanup?.()
	document.getElementById(HOST_ID)?.remove()

	const host = document.createElement('div')
	host.id = HOST_ID
	host.style.position = 'fixed'
	host.style.right = '18px'
	host.style.bottom = '18px'
	host.style.zIndex = '2147483647'
	host.style.setProperty('--mvp-clip-bg', snapshot.theme.background)
	host.style.setProperty('--mvp-clip-panel', snapshot.theme.panel)
	host.style.setProperty('--mvp-clip-panel-strong', snapshot.theme.panelStrong)
	host.style.setProperty('--mvp-clip-line', snapshot.theme.line)
	host.style.setProperty('--mvp-clip-muted', snapshot.theme.muted)
	host.style.setProperty('--mvp-clip-text', snapshot.theme.text)
	host.style.setProperty('--mvp-clip-input', snapshot.theme.input)
	host.style.setProperty('--mvp-clip-accent', snapshot.theme.accent)
	host.style.setProperty('--mvp-clip-accent-fg', snapshot.theme.accentForeground)
	host.style.setProperty('--mvp-clip-hover', snapshot.theme.hover)
	host.style.setProperty('--mvp-clip-danger', snapshot.theme.danger)

	const shadow = host.attachShadow({ mode: 'open' })
	const style = document.createElement('style')
	style.textContent = `
		:host {
			all: initial;
			color-scheme: ${snapshot.theme.mode};
			--mvp-clip-bg: #12141a;
			--mvp-clip-panel: #1a1d24;
			--mvp-clip-panel-strong: #21252d;
			--mvp-clip-line: rgba(255,255,255,.08);
			--mvp-clip-muted: #8b949e;
			--mvp-clip-text: #f8fafc;
			--mvp-clip-input: #0f1115;
			--mvp-clip-hover: #2f383e;
			--mvp-clip-accent-fg: #0f1419;
			--mvp-clip-danger: #ef4444;
			--mvp-radius: 12px;
		}
		* { box-sizing: border-box; }
		.tray {
			width: min(540px, calc(100vw - 32px));
			max-height: min(740px, calc(100vh - 32px));
			display: flex;
			flex-direction: column;
			overflow: hidden;
			border: 1px solid var(--mvp-clip-line);
			border-radius: var(--mvp-radius);
			background: var(--mvp-clip-bg);
			color: var(--mvp-clip-text);
			box-shadow: 0 20px 42px rgba(0, 0, 0, 0.46), 0 0 0 1px color-mix(in srgb, var(--mvp-clip-line) 70%, transparent) inset;
			font: 13px/1.5 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
		}
		.header {
			padding: 16px 20px;
			display: flex; flex-direction: column; gap: 12px;
			border-bottom: 1px solid var(--mvp-clip-line);
			background: color-mix(in srgb, var(--mvp-clip-panel) 82%, var(--mvp-clip-bg));
		}
		.title-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
		.header-tools { display: flex; align-items: center; gap: 6px; flex-shrink: 0; margin-top: -4px; margin-right: -8px; }
		.kicker {
			color: var(--mvp-clip-accent); font-size: 10px; font-weight: 800;
			letter-spacing: .06em; text-transform: uppercase;
			margin-bottom: 6px; display: flex; align-items: center; gap: 6px;
		}
		.kicker-badge {
			border: 1px solid color-mix(in srgb, var(--mvp-clip-accent) 35%, var(--mvp-clip-line));
			border-radius: 999px; padding: 2px 7px;
			background: color-mix(in srgb, var(--mvp-clip-accent) 10%, transparent);
			color: var(--mvp-clip-accent);
		}
		.title {
			font-size: 16px; font-weight: 700; line-height: 1.35;
			color: var(--mvp-clip-text);
			display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
		}
		.host { margin-top: 6px; color: var(--mvp-clip-muted); font-size: 12px; font-weight: 500;}
		.icon-button {
			width: 28px; height: 28px; border: 0; border-radius: 6px; background: transparent;
			color: var(--mvp-clip-muted); cursor: pointer; display: flex; align-items: center; justify-content: center;
			transition: background-color .15s, color .15s, box-shadow .15s;
		}
		.icon-button:hover { background: var(--mvp-clip-hover); color: var(--mvp-clip-text); box-shadow: 0 2px 8px rgba(0,0,0,.18); }
		.help-panel {
			border: 1px solid var(--mvp-clip-line); border-radius: 8px;
			background: color-mix(in srgb, var(--mvp-clip-panel-strong) 82%, var(--mvp-clip-bg));
			color: var(--mvp-clip-muted); padding: 12px 14px; font-size: 12px; line-height: 1.5;
		}
		.help-panel[hidden] { display: none; }
		.help-panel strong { color: var(--mvp-clip-text); font-weight: 700; }
		.help-panel p { margin: 0 0 8px; }
		.help-panel ul { margin: 0; padding-left: 18px; }
		.help-panel li + li { margin-top: 4px; }
		.body {
			overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 16px;
			flex: 1;
		}
		.body::-webkit-scrollbar { width: 6px; }
		.body::-webkit-scrollbar-track { background: transparent; }
		.body::-webkit-scrollbar-thumb { background: rgba(255,255,255,.15); border-radius: 3px; }
		.body::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,.25); }

		.summary { display: flex; gap: 8px; flex-wrap: wrap; }
		.pill {
			border: 1px solid var(--mvp-clip-line); border-radius: 6px; padding: 4px 10px;
			background: var(--mvp-clip-panel-strong); font-size: 11px; font-weight: 600; color: var(--mvp-clip-muted);
		}

		/* Panels */
		.composer-panel, .format-panel, .preview-panel {
			display: flex; flex-direction: column; gap: 12px;
			border: 1px solid var(--mvp-clip-line); border-radius: 8px;
			background: var(--mvp-clip-panel); padding: 16px;
		}
		.preview-panel { padding: 0; background: var(--mvp-clip-panel-strong); }

		.field-row { display: flex; flex-direction: column; gap: 6px; }
		.field-label { display: flex; align-items: center; justify-content: space-between; color: var(--mvp-clip-text); font-size: 12px; font-weight: 600; }
		.counter { color: var(--mvp-clip-accent); font-weight: 700; font-size: 11px; }
		.input, .select {
			width: 100%; min-width: 0; border: 1px solid var(--mvp-clip-line); border-radius: 6px;
			background: var(--mvp-clip-input); color: var(--mvp-clip-text); font: inherit; font-size: 13px; font-weight: 500;
			padding: 10px 12px; outline: none; transition: all .2s;
			box-shadow: 0 1px 2px rgba(0,0,0,0.2) inset;
		}
		.input:focus, .select:focus {
			border-color: var(--mvp-clip-accent);
			box-shadow: 0 0 0 1px var(--mvp-clip-accent) inset, 0 0 0 3px color-mix(in srgb, var(--mvp-clip-accent) 20%, transparent);
		}
		.two-col { display: grid; grid-template-columns: minmax(0, 1fr) minmax(160px, .4fr); gap: 12px; }
		.meta-line { color: var(--mvp-clip-muted); font-size: 11px; font-weight: 500; margin-top: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

		.format-label { color: var(--mvp-clip-text); font-size: 12px; font-weight: 600; }
		.segmented {
			display: grid; grid-template-columns: 1fr 1fr; gap: 4px; padding: 4px;
			border-radius: 8px; background: color-mix(in srgb, var(--mvp-clip-bg) 64%, var(--mvp-clip-panel)); border: 1px solid var(--mvp-clip-line);
		}
		.segment {
			border: 0; border-radius: 4px; background: transparent; color: var(--mvp-clip-muted);
			cursor: pointer; font: inherit; font-weight: 600; font-size: 12px; padding: 8px;
			transition: all .2s;
		}
		.segment:hover:not(.segment-active) { color: var(--mvp-clip-text); background: var(--mvp-clip-hover); }
		.segment-active { background: var(--mvp-clip-panel-strong); color: var(--mvp-clip-text); box-shadow: 0 1px 3px rgba(0,0,0,.2); border: 1px solid var(--mvp-clip-line); }

		.section-heading { display: flex; align-items: center; justify-content: space-between; padding-bottom: 6px; border-bottom: 1px solid var(--mvp-clip-line); margin-top: 8px;}
		.section-title { color: var(--mvp-clip-text); font-size: 13px; font-weight: 700; display: flex; align-items: center; gap: 8px; }
		.section-title svg { color: var(--mvp-clip-muted); }

		/* Cards */
		.item-card {
			position: relative; border: 1px solid var(--mvp-clip-line); border-radius: 8px;
			padding: 14px; background: var(--mvp-clip-panel); color: var(--mvp-clip-text);
			transition: border-color .2s;
		}
		.item-card:hover { border-color: rgba(255,255,255,.15); }
		.media-card { display: flex; align-items: center; gap: 12px; padding-right: 40px; }
		.text-card { display: flex; flex-direction: column; gap: 8px; padding-right: 48px; }
		.text-editor {
			width: 100%; min-height: 150px; max-height: 320px; resize: vertical;
			border: 1px solid var(--mvp-clip-line); border-radius: 6px;
			background: var(--mvp-clip-input); color: var(--mvp-clip-text);
			font: 13px/1.55 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
			padding: 12px; outline: none; white-space: pre-wrap;
			box-shadow: 0 1px 2px rgba(0,0,0,0.2) inset;
		}
		.text-editor:focus {
			border-color: var(--mvp-clip-accent);
			box-shadow: 0 0 0 1px var(--mvp-clip-accent) inset, 0 0 0 3px color-mix(in srgb, var(--mvp-clip-accent) 20%, transparent);
		}
		.text-meta { color: var(--mvp-clip-muted); font-size: 11px; font-weight: 600; display: flex; justify-content: space-between; gap: 8px; }
		.media-kind {
			border-radius: 4px; background: var(--mvp-clip-hover);
			color: var(--mvp-clip-text); font-size: 11px; font-weight: 700; padding: 4px 8px; text-transform: uppercase; letter-spacing: 0.03em;
		}
		.media-url { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--mvp-clip-muted); }

		.remove {
			width: 28px; height: 28px; border: 1px solid rgba(255,255,255,.15); border-radius: 6px;
			background: var(--mvp-clip-input); color: var(--mvp-clip-text); cursor: pointer;
			display: flex; align-items: center; justify-content: center;
			transition: all .2s;
		}
		.remove:hover { background: var(--mvp-clip-danger); border-color: var(--mvp-clip-danger); color: #fff; }
		.media-card .remove { position: absolute; right: 10px; top: 10px; }
		.media-card .remove { top: 50%; transform: translateY(-50%); }
		.text-card .remove { position: absolute; right: 10px; top: 10px; }

		.clear-kind {
			border: 0; background: transparent; color: var(--mvp-clip-muted); cursor: pointer;
			font: inherit; font-size: 11px; font-weight: 600; padding: 4px 8px; border-radius: 4px;
			transition: all .2s;
		}
		.clear-kind:hover { color: var(--mvp-clip-danger); background: color-mix(in srgb, var(--mvp-clip-danger) 12%, transparent); }

		.footer {
			background: color-mix(in srgb, var(--mvp-clip-panel) 82%, var(--mvp-clip-bg)); border-top: 1px solid var(--mvp-clip-line);
			padding: 16px 20px; display: flex; flex-direction: column; gap: 14px;
		}
		.collect-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
		.actions { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 12px; align-items: center; }

		button.action {
			border: 0; border-radius: 6px; padding: 0 16px; height: 40px;
			cursor: pointer; font: inherit; font-size: 13px; font-weight: 600;
			background: var(--mvp-clip-accent); color: var(--mvp-clip-accent-fg);
			display: flex; align-items: center; justify-content: center; gap: 8px;
			transition: background-color .15s, border-color .15s, color .15s, box-shadow .15s;
		}
		button.action:hover { box-shadow: 0 0 0 1px color-mix(in srgb, var(--mvp-clip-accent) 42%, transparent), 0 6px 16px rgba(0,0,0,.22); }
		button.action:active { box-shadow: 0 0 0 1px color-mix(in srgb, var(--mvp-clip-accent) 55%, transparent); }

		button.secondary {
			background: var(--mvp-clip-panel); color: var(--mvp-clip-text); border: 1px solid var(--mvp-clip-line);
			font-weight: 500; height: 36px; box-shadow: 0 1px 2px rgba(0,0,0,.1);
		}
		button.secondary:hover { background: var(--mvp-clip-hover); border-color: color-mix(in srgb, var(--mvp-clip-accent) 35%, var(--mvp-clip-line)); color: var(--mvp-clip-text); box-shadow: 0 4px 12px rgba(0,0,0,.22); }

		button.subtle { background: transparent; color: var(--mvp-clip-muted); }
		button.subtle:hover { background: var(--mvp-clip-hover); color: var(--mvp-clip-text); }

		button.picker-active {
			background: color-mix(in srgb, var(--mvp-clip-accent) 15%, transparent);
			color: var(--mvp-clip-accent); border-color: color-mix(in srgb, var(--mvp-clip-accent) 50%, transparent);
		}
		button.picker-active:hover { background: color-mix(in srgb, var(--mvp-clip-accent) 25%, transparent); }

		.empty { color: var(--mvp-clip-muted); padding: 24px 0; text-align: center; font-size: 13px; font-weight: 500; border: 1px dashed var(--mvp-clip-line); border-radius: 8px; }

		.status-strip {
			border: 1px solid transparent; border-radius: 6px; padding: 10px 14px;
			background: color-mix(in srgb, var(--mvp-clip-panel-strong) 55%, transparent); color: var(--mvp-clip-muted); font-size: 12px; font-weight: 500;
			transition: all .2s; display: flex; align-items: center; gap: 8px; line-height: 1.3;
		}
		.status-active {
			border-color: color-mix(in srgb, var(--mvp-clip-accent) 40%, transparent);
			color: var(--mvp-clip-accent);
			background: color-mix(in srgb, var(--mvp-clip-accent) 8%, transparent);
		}

		.preview-heading {
			padding: 10px 16px; border-bottom: 1px solid var(--mvp-clip-line); background: color-mix(in srgb, var(--mvp-clip-bg) 62%, var(--mvp-clip-panel));
			color: var(--mvp-clip-muted); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; display: flex; align-items: center; gap: 8px;
		}
		.preview-content {
			padding: 18px; min-height: 220px; max-height: min(46vh, 430px); overflow-y: auto; white-space: pre-wrap;
			color: var(--mvp-clip-text); line-height: 1.65; font-size: 13px; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
		}
		.preview-content::-webkit-scrollbar { width: 6px; }
		.preview-content::-webkit-scrollbar-thumb { background: rgba(255,255,255,.1); border-radius: 3px; }

		@media (max-width: 540px) {
			.tray { width: calc(100vw - 16px); max-height: calc(100vh - 16px); }
			.two-col, .actions, .collect-actions { grid-template-columns: 1fr; }
			.title { white-space: normal; -webkit-line-clamp: 3; }
		}
	`

	const cleanupCallbacks: Array<() => void> = []
	function disposeTray(): void {
		for (const cleanup of cleanupCallbacks.splice(0)) cleanup()
		if (trayGlobal.__mvpThreadClipperTrayCleanup === disposeTray) {
			trayGlobal.__mvpThreadClipperTrayCleanup = undefined
		}
		host.remove()
	}
	trayGlobal.__mvpThreadClipperTrayCleanup = disposeTray

	const tray = document.createElement('section')
	tray.className = 'tray'

	const header = document.createElement('header')
	header.className = 'header'
	const titleRow = document.createElement('div')
	titleRow.className = 'title-row'
	const titleBlock = document.createElement('div')
	const kicker = document.createElement('div')
	kicker.className = 'kicker'
	kicker.innerHTML =
		'<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="3"/><path d="M8.12 8.12 12 12"/><path d="M20 4 8.12 15.88"/><circle cx="6" cy="18" r="3"/><path d="M14.8 14.8 20 20"/></svg> Preparar hilo <span class="kicker-badge">Noticia externa</span>'
	const title = document.createElement('div')
	title.className = 'title'
	title.textContent = snapshot.sourceTitle
	const sourceHost = document.createElement('div')
	sourceHost.className = 'host'
	sourceHost.textContent = snapshot.sourceHost
	titleBlock.append(kicker, title, sourceHost)

	const headerTools = document.createElement('div')
	headerTools.className = 'header-tools'
	const info = document.createElement('button')
	info.className = 'icon-button'
	info.type = 'button'
	info.title = 'Cómo funciona el recortador'
	info.setAttribute('aria-label', 'Cómo funciona el recortador')
	info.setAttribute('aria-expanded', 'false')
	info.innerHTML =
		'<svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>'
	const close = document.createElement('button')
	close.className = 'icon-button'
	close.type = 'button'
	close.title = 'Cerrar'
	close.innerHTML =
		'<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>'
	close.addEventListener('click', disposeTray)
	headerTools.append(info, close)
	titleRow.append(titleBlock, headerTools)
	const helpPanel = document.createElement('div')
	helpPanel.className = 'help-panel'
	helpPanel.hidden = true
	helpPanel.innerHTML =
		'<p><strong>Recortador rápido:</strong> prepara el título, subforo y contenido antes de abrir Mediavida.</p><ul><li><strong>Añadir texto seleccionado</strong> guarda el texto que tengas marcado en la noticia.</li><li><strong>Seleccionar media embebida</strong> resalta vídeos de YouTube, tweets y posts de Instagram dentro de esta página.</li><li><strong>Crear</strong> abre el editor de Mediavida con el contenido actual.</li><li><strong>Limpiar</strong> vacía el recorte sin cerrar el panel.</li></ul>'
	info.addEventListener('click', () => {
		helpPanel.hidden = !helpPanel.hidden
		info.setAttribute('aria-expanded', helpPanel.hidden ? 'false' : 'true')
	})
	header.append(titleRow, helpPanel)

	const body = document.createElement('main')
	body.className = 'body'
	const summary = document.createElement('div')
	summary.className = 'summary'
	const textPill = document.createElement('span')
	textPill.className = 'pill'
	textPill.textContent = `${snapshot.texts.length} texto${snapshot.texts.length === 1 ? '' : 's'}`
	const mediaPill = document.createElement('span')
	mediaPill.className = 'pill'
	mediaPill.textContent = `${snapshot.media.length} media`
	summary.append(textPill, mediaPill)
	header.append(summary)

	function sendTrayAction(
		action: ThreadClipperTrayMessage['action'],
		payload: Partial<ThreadClipperTrayMessage> = {}
	): void {
		const runtime =
			(
				globalThis as {
					browser?: { runtime?: { sendMessage?: (message: unknown) => void } }
					chrome?: { runtime?: { sendMessage?: (message: unknown) => void } }
				}
			).chrome?.runtime ??
			(
				globalThis as {
					browser?: { runtime?: { sendMessage?: (message: unknown) => void } }
				}
			).browser?.runtime
			runtime?.sendMessage?.({
				type: 'mvp-thread-clipper-tray',
				sessionId: snapshot.sessionId,
				action,
				timestamp: Date.now(),
				...payload,
			})
		}
	const mediaOnlyMode = snapshot.contentMode === 'media-only'

	const composerPanel = document.createElement('section')
	composerPanel.className = 'composer-panel'
	const titleRowField = document.createElement('label')
	titleRowField.className = 'field-row'
	const titleLabel = document.createElement('span')
	titleLabel.className = 'field-label'
	const titleLabelText = document.createElement('span')
	titleLabelText.textContent = 'Título'
	const titleCounter = document.createElement('span')
	titleCounter.className = 'counter'
	titleCounter.textContent = `${snapshot.title.length}/72`
	titleLabel.append(titleLabelText, titleCounter)
	const titleInput = document.createElement('input')
	titleInput.className = 'input'
	titleInput.type = 'text'
	titleInput.maxLength = 72
	titleInput.value = snapshot.title
	titleInput.addEventListener('input', () => {
		titleCounter.textContent = `${titleInput.value.length}/72`
	})
	titleInput.addEventListener('change', () => sendTrayAction('set-title', { title: titleInput.value }))
	titleRowField.append(titleLabel, titleInput)

	const controls = document.createElement('div')
	controls.className = 'two-col'
	const subforumField = document.createElement('label')
	subforumField.className = 'field-row'
	const subforumLabel = document.createElement('span')
	subforumLabel.className = 'field-label'
	subforumLabel.textContent = 'Subforo'
	const subforumSelect = document.createElement('select')
	subforumSelect.className = 'select'
	for (const subforum of snapshot.subforums) {
		const option = document.createElement('option')
		option.value = subforum.slug
		option.textContent = subforum.name
		option.selected = snapshot.selectedSubforum === subforum.slug
		subforumSelect.append(option)
	}
	subforumSelect.addEventListener('change', () => sendTrayAction('set-subforum', { subforum: subforumSelect.value }))
	subforumField.append(subforumLabel, subforumSelect)
	controls.append(titleRowField, subforumField)

	const metaLine = document.createElement('div')
	metaLine.className = 'meta-line'
	metaLine.textContent = [
		snapshot.sourceHost,
		snapshot.publishedAt ? `Fecha: ${snapshot.publishedAt}` : '',
	]
		.filter(Boolean)
		.join(' · ')
	composerPanel.append(controls, metaLine)
	body.append(composerPanel)

	const formatPanel = document.createElement('section')
	formatPanel.className = 'format-panel'
	const formatLabel = document.createElement('div')
	formatLabel.className = 'format-label'
	formatLabel.textContent = 'Formato del texto en Mediavida'
	const segmented = document.createElement('div')
	segmented.className = 'segmented'
	const quoteMode = document.createElement('button')
	quoteMode.type = 'button'
	quoteMode.className = `segment${snapshot.textFormat === 'quote' ? ' segment-active' : ''}`
	quoteMode.textContent = 'Cita'
	quoteMode.title = 'Inserta el texto dentro de [quote]'
	quoteMode.addEventListener('click', () => sendTrayAction('set-text-format', { textFormat: 'quote' }))
	const plainMode = document.createElement('button')
	plainMode.type = 'button'
	plainMode.className = `segment${snapshot.textFormat === 'plain' ? ' segment-active' : ''}`
	plainMode.textContent = 'Texto normal'
	plainMode.title = 'Inserta el texto sin [quote]'
	plainMode.addEventListener('click', () => sendTrayAction('set-text-format', { textFormat: 'plain' }))
	segmented.append(quoteMode, plainMode)
	formatPanel.append(formatLabel, segmented)
	if (!mediaOnlyMode) body.append(formatPanel)

	function createRemoveButton(itemIndex: number, title: string): HTMLButtonElement {
		const button = document.createElement('button')
		button.type = 'button'
		button.className = 'remove'
		button.title = title
		button.innerHTML =
			'<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>'
		button.addEventListener('click', () => sendTrayAction('remove-item', { itemIndex }))
		return button
	}

	const textEditTimers = new Map<number, number>()
	cleanupCallbacks.push(() => {
		for (const timer of textEditTimers.values()) window.clearTimeout(timer)
		textEditTimers.clear()
	})

	function queueTextItemUpdate(itemIndex: number, value: string, immediate = false): void {
		const currentTimer = textEditTimers.get(itemIndex)
		if (currentTimer) window.clearTimeout(currentTimer)
		const sendUpdate = () => {
			textEditTimers.delete(itemIndex)
			sendTrayAction('update-text-item', { itemIndex, value })
		}
		if (immediate) {
			sendUpdate()
			return
		}
		textEditTimers.set(itemIndex, window.setTimeout(sendUpdate, 450))
	}

	function appendSectionHeading(label: string, itemType: ThreadClipperBasketItem['type']): void {
		const heading = document.createElement('div')
		heading.className = 'section-heading'
		const title = document.createElement('div')
		title.className = 'section-title'
		let svgIcon = ''
		if (itemType === 'text')
			svgIcon =
				'<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>'
		else
			svgIcon =
				'<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/></svg>'
		title.innerHTML = `${svgIcon} ${label}`
		const clearKind = document.createElement('button')
		clearKind.type = 'button'
		clearKind.className = 'clear-kind'
		clearKind.textContent = 'Quitar todos'
		clearKind.addEventListener('click', () => sendTrayAction('clear-kind', { itemType }))
		heading.append(title, clearKind)
		body.append(heading)
	}

	if (snapshot.media.length > 0) {
		appendSectionHeading('Media añadida', 'media')
		for (const media of snapshot.media) {
			const card = document.createElement('article')
			card.className = 'item-card media-card'
			const kind = document.createElement('span')
			kind.className = 'media-kind'
			kind.textContent = media.label
			const url = document.createElement('span')
			url.className = 'media-url'
			url.textContent = media.url
			card.append(kind, url, createRemoveButton(media.itemIndex, 'Quitar media'))
			body.append(card)
		}
	}

	if (snapshot.texts.length > 0 && !mediaOnlyMode) {
		appendSectionHeading('Texto añadido', 'text')
		for (const text of snapshot.texts) {
			const card = document.createElement('article')
			card.className = 'item-card text-card'
			const textarea = document.createElement('textarea')
				textarea.className = 'text-editor'
				textarea.value = text.value
				textarea.dataset.itemIndex = String(text.itemIndex)
				textarea.spellcheck = true
			textarea.maxLength = 12000
			textarea.setAttribute('aria-label', 'Editar texto recortado')
			const meta = document.createElement('div')
			meta.className = 'text-meta'
			const label = document.createElement('span')
			label.textContent = 'Texto raw editable'
			const counter = document.createElement('span')
			counter.textContent = `${textarea.value.length}/12000`
			meta.append(label, counter)
			textarea.addEventListener('input', () => {
				counter.textContent = `${textarea.value.length}/12000`
				queueTextItemUpdate(text.itemIndex, textarea.value)
			})
			textarea.addEventListener('blur', () => queueTextItemUpdate(text.itemIndex, textarea.value, true))
			card.append(textarea, meta, createRemoveButton(text.itemIndex, 'Quitar texto'))
			body.append(card)
		}
	}

	if (snapshot.texts.length === 0 && snapshot.media.length === 0) {
		const empty = document.createElement('div')
		empty.className = 'empty'
		empty.textContent = mediaOnlyMode
			? 'Pulsa media compatible para añadir tweets o posts.'
			: 'Selecciona texto o elige media para empezar el recorte.'
		body.append(empty)
	}

	const previewPanel = document.createElement('section')
	previewPanel.className = 'preview-panel'
	const previewHeading = document.createElement('div')
	previewHeading.className = 'preview-heading'
	previewHeading.textContent = 'Contenido del hilo'
	const previewContent = document.createElement('div')
	previewContent.className = 'preview-content'
	function renderVisualPreview(): void {
		previewContent.textContent = (snapshot.bbcode || 'El recorte todavía no tiene contenido.')
			.replace(/\[url=[^\]]+\]([\s\S]*?)\[\/url\]/gi, '$1')
			.replace(/\[media\]([\s\S]*?)\[\/media\]/gi, '[media] $1')
			.replace(/\[quote\]\n?([\s\S]*?)\n?\[\/quote\]/gi, '$1')
	}
	previewPanel.append(previewHeading, previewContent)
	body.append(previewPanel)
	renderVisualPreview()

	const footer = document.createElement('footer')
	footer.className = 'footer'
	const statusStrip = document.createElement('div')
	statusStrip.className = 'status-strip'
	const collectActions = document.createElement('div')
	collectActions.className = 'collect-actions'
	if (mediaOnlyMode) collectActions.style.gridTemplateColumns = '1fr'
	const actions = document.createElement('div')
	actions.className = 'actions'

	function setTrayStatus(text: string, active = false): void {
		statusStrip.textContent = text
		statusStrip.classList.toggle('status-active', active)
	}

	setTrayStatus(
		mediaOnlyMode
			? 'Modo social: solo tweets/posts compatibles'
			: snapshot.activePicker === 'media'
			? 'Añadiendo media: vídeos, tweets y posts compatibles'
			: 'Listo para añadir texto o media',
		mediaOnlyMode || Boolean(snapshot.activePicker)
	)

	const addSelection = document.createElement('button')
	addSelection.type = 'button'
	addSelection.className = 'action secondary'
	addSelection.title = 'Añade el texto que tengas seleccionado en la noticia'
	addSelection.innerHTML =
		'<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg> Añadir texto seleccionado'
	addSelection.addEventListener('pointerdown', event => event.preventDefault())
	addSelection.addEventListener('click', () => {
		setTrayStatus('Añadiendo texto seleccionado...', true)
		sendTrayAction('add-selection')
	})
	if (!mediaOnlyMode) collectActions.append(addSelection)

	let stopMediaPicker: (() => void) | null = null
	const pickMedia = document.createElement('button')
	pickMedia.type = 'button'
	pickMedia.className = 'action secondary'
	pickMedia.title = 'Activa el selector para añadir YouTube, tweets o Instagram embebidos en esta noticia'
	pickMedia.innerHTML = mediaOnlyMode
		? 'Seleccionar media embebida'
		: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg> Seleccionar media embebida'

		function getMediaUrlFromElement(element: Element): string | null {
			function getElementString(element: Element): string {
				return [
					element.id,
					element.className,
					element.getAttribute('aria-label'),
					element.getAttribute('title'),
					element.getAttribute('role'),
				]
					.filter(value => typeof value === 'string')
					.join(' ')
					.toLowerCase()
			}

			function looksLikeYoutubeElement(element: Element): boolean {
				const marker = getElementString(element)
				if (/(youtube|youtu\.be|ytimg|yt-|yt_|video)/i.test(marker)) return true
				return Boolean(
					element.querySelector(
						'a[href*="youtu"], iframe[src*="youtu"], img[src*="ytimg"], img[src*="youtube"], source[src*="youtu"]'
					)
				)
			}

			function getYoutubeIdFromDataset(element: Element): string | null {
				const candidates = [
					element.getAttribute('data-youtube-id'),
					element.getAttribute('data-youtubeid'),
					element.getAttribute('data-yt-id'),
					element.getAttribute('data-video-id'),
					element.getAttribute('data-videoid'),
					element.getAttribute('data-id'),
				]
				const id = candidates.find(value => value && /^[A-Za-z0-9_-]{6,}$/.test(value))
				return id && looksLikeYoutubeElement(element) ? `https://www.youtube.com/watch?v=${encodeURIComponent(id)}` : null
			}

			function looksLikeEmbeddableContainer(element: Element): boolean {
				const marker = getElementString(element)
				if (/(youtube|youtu\.be|ytimg|twitter|tweet|instagram|embed|player|media|video)/i.test(marker)) {
					return true
				}
				if (
					element.matches(
						'iframe, video, source, img, blockquote, [data-youtube-id], [data-youtubeid], [data-yt-id], [data-video-id], [data-videoid], [data-src], [data-lazy-src], [data-video-url], [data-embed-url], [data-youtube-url]'
					)
				) {
					return true
				}
				return false
			}

			function getRawUrlFromElement(element: Element): string | null {
				if (element instanceof HTMLAnchorElement && element.href) return element.href
				if (element instanceof HTMLIFrameElement && element.src) return element.src
				if (element instanceof HTMLVideoElement) return element.currentSrc || element.src || element.poster || null
				if (element instanceof HTMLSourceElement && element.src) return element.src
				if (element instanceof HTMLImageElement) return element.currentSrc || element.src || element.dataset.src || null

				const directAttributes = [
					'href',
					'src',
					'poster',
					'data-src',
					'data-lazy-src',
					'data-url',
					'data-href',
					'data-video-url',
					'data-embed-url',
					'data-youtube-url',
				]
				for (const attribute of directAttributes) {
					const value = element.getAttribute(attribute)
					if (value) return value
				}

				if (!looksLikeEmbeddableContainer(element)) return null

				const child = element.querySelector<HTMLAnchorElement | HTMLIFrameElement | HTMLVideoElement | HTMLImageElement | HTMLSourceElement>(
					'a[href], iframe[src], video[src], video[poster], img[src], img[data-src], source[src], [data-video-url], [data-embed-url], [data-youtube-url], [data-url], [data-href]'
				)
				if (child) return getRawUrlFromElement(child)
				return null
			}

			const dataSetYoutubeUrl = getYoutubeIdFromDataset(element)
			if (dataSetYoutubeUrl) return dataSetYoutubeUrl
			const rawUrl = getRawUrlFromElement(element)
			if (!rawUrl) return null
			try {
				const parsed = new URL(rawUrl, document.baseURI)
				const host = parsed.hostname.replace(/^www\./, '').toLowerCase()
			const isYoutube =
				host === 'youtu.be' ||
					host === 'youtube.com' ||
					host.endsWith('.youtube.com') ||
					host === 'ytimg.com' ||
					host.endsWith('.ytimg.com') ||
					host === 'youtube-nocookie.com' ||
					host.endsWith('.youtube-nocookie.com')
			const isTwitter =
				host === 'twitter.com' ||
				host === 'x.com' ||
				host.endsWith('.twitter.com') ||
				host.endsWith('.x.com')
			const isInstagram = host === 'instagram.com' || host.endsWith('.instagram.com') || host === 'instagr.am'
			if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
				if (isYoutube) {
					const videoId =
						host === 'youtu.be'
							? parsed.pathname.split('/').filter(Boolean)[0]
							: parsed.searchParams.get('v') ||
							  parsed.pathname.match(/^\/(?:embed|shorts|live)\/([^/?#]+)/)?.[1] ||
							  parsed.pathname.match(/^\/(?:vi|vi_webp)\/([^/?#]+)/)?.[1] ||
							  null
					return videoId ? `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}` : null
				}
			if (isTwitter) {
				const statusMatch = parsed.pathname.match(/^\/([A-Za-z0-9_]+)\/status(?:es)?\/(\d+)\/?$/i)
				const embedStatusId = parsed.pathname.match(/^\/i\/status\/(\d+)\/?$/i)?.[1]
				if (statusMatch) return `https://twitter.com/${statusMatch[1]}/status/${statusMatch[2]}`
				return embedStatusId ? `https://twitter.com/i/status/${embedStatusId}` : null
			}
			if (isInstagram) {
				const postMatch = parsed.pathname.match(/^\/(p|reel|tv)\/([A-Za-z0-9_-]+)\/?$/i)
				return postMatch ? `https://www.instagram.com/${postMatch[1]}/${postMatch[2]}/` : null
			}
			return null
		} catch {
			return null
		}
	}

		function setMediaPicker(enabled: boolean): void {
		stopMediaPicker?.()
		stopMediaPicker = null
		pickMedia.classList.toggle('picker-active', enabled)
		pickMedia.innerHTML = enabled
			? 'Pulsa media'
			: mediaOnlyMode
			? 'Seleccionar media embebida'
			: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg> Seleccionar media embebida'
		setTrayStatus(
			enabled ? 'Añadiendo media: vídeos, tweets y posts compatibles' : 'Listo para añadir texto o media',
			enabled
		)
		if (!enabled) return

		const previousOutlines = new WeakMap<HTMLElement, string>()
		const previousCursors = new WeakMap<HTMLElement, string>()
		const touchedElements = new Set<HTMLElement>()
		const overlayLayer = document.createElement('div')
		overlayLayer.style.position = 'absolute'
		overlayLayer.style.left = '0'
		overlayLayer.style.top = '0'
		overlayLayer.style.zIndex = '2147483646'
		overlayLayer.style.pointerEvents = 'none'
		;(document.body || document.documentElement).append(overlayLayer)

			function getMediaElementFromEvent(event: Event): HTMLElement | null {
				const target = event.target
				if (!(target instanceof Element)) return null
				let candidate: Element | null = target
				let depth = 0
				while (candidate && depth < 6) {
					if (candidate instanceof HTMLElement && getMediaUrlFromElement(candidate)) return candidate
					candidate = candidate.parentElement
					depth += 1
				}
				return null
			}

		function highlightElement(element: HTMLElement): void {
			if (!previousOutlines.has(element)) previousOutlines.set(element, element.style.outline)
			if (!previousCursors.has(element)) previousCursors.set(element, element.style.cursor)
			touchedElements.add(element)
			element.style.outline = '3px solid #fbbf24'
			element.style.cursor = 'copy'
		}

		function restoreElement(element: HTMLElement): void {
			element.style.outline = previousOutlines.get(element) ?? ''
			element.style.cursor = previousCursors.get(element) ?? ''
		}

		function onMouseOver(event: MouseEvent): void {
			const element = getMediaElementFromEvent(event)
			if (element) highlightElement(element)
		}

		function onMouseOut(event: MouseEvent): void {
			const element = getMediaElementFromEvent(event)
			if (element) restoreElement(element)
		}

			function onClick(event: MouseEvent): void {
				const element = getMediaElementFromEvent(event)
				if (!element) return
			const mediaUrl = getMediaUrlFromElement(element)
			if (!mediaUrl) return
			event.preventDefault()
			event.stopPropagation()
			event.stopImmediatePropagation()
				sendTrayAction('add-media', { mediaUrl, pickerMode: 'media' })
			}

			function getOverlayAnchorElement(element: HTMLElement): HTMLElement {
				const visual = element.querySelector<HTMLElement>('iframe, video, img[src], img[data-src]')
				if (!visual) return element
				const rect = visual.getBoundingClientRect()
				return rect.width >= 24 && rect.height >= 18 ? visual : element
			}

			function createMediaOverlay(element: HTMLElement, mediaUrl: string): HTMLButtonElement {
				const overlay = document.createElement('button')
			overlay.type = 'button'
			overlay.textContent = 'Añadir media'
			overlay.title = mediaUrl
			overlay.style.position = 'absolute'
			overlay.style.border = '1px solid rgba(251, 191, 36, 0.86)'
			overlay.style.borderRadius = '999px'
			overlay.style.background = 'rgba(15, 23, 42, 0.86)'
			overlay.style.boxShadow = '0 10px 28px rgba(0, 0, 0, 0.34)'
			overlay.style.color = '#fef3c7'
			overlay.style.cursor = 'copy'
			overlay.style.font = '850 12px/1 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
			overlay.style.minHeight = '30px'
			overlay.style.padding = '7px 11px'
			overlay.style.pointerEvents = 'auto'
			overlay.style.whiteSpace = 'nowrap'
			overlay.addEventListener('click', event => {
				event.preventDefault()
				event.stopPropagation()
				sendTrayAction('add-media', { mediaUrl, pickerMode: 'media' })
			})
			overlayLayer.append(overlay)
			highlightElement(element)
			return overlay
		}

			const seenOverlayUrls = new Set<string>()
			const overlays = Array.from(
				document.querySelectorAll<HTMLElement>(
					'a[href], iframe[src], video, source[src], img[src], img[data-src], [data-src], [data-lazy-src], [data-id], [data-youtube-id], [data-youtubeid], [data-yt-id], [data-video-id], [data-videoid], [data-video-url], [data-embed-url], [data-youtube-url], [data-url], [data-href]'
				)
			)
					.map(element => {
						const mediaUrl = getMediaUrlFromElement(element)
						if (!mediaUrl || seenOverlayUrls.has(mediaUrl)) return null
						seenOverlayUrls.add(mediaUrl)
						const overlayAnchor = getOverlayAnchorElement(element)
						return { element: overlayAnchor, mediaUrl, overlay: createMediaOverlay(overlayAnchor, mediaUrl) }
					})
			.filter((entry): entry is { element: HTMLElement; mediaUrl: string; overlay: HTMLButtonElement } =>
				Boolean(entry)
			)

		function positionMediaOverlays(): void {
			for (const { element, overlay } of overlays) {
				const rect = element.getBoundingClientRect()
				if (rect.width < 24 || rect.height < 18 || rect.bottom < 0 || rect.right < 0) {
					overlay.style.display = 'none'
					continue
				}
				overlay.style.display = 'block'
				overlay.style.left = `${Math.max(0, rect.left + window.scrollX + 10)}px`
				overlay.style.top = `${Math.max(0, rect.top + window.scrollY + 10)}px`
				overlay.style.maxWidth = `${Math.max(100, rect.width - 20)}px`
				overlay.style.overflow = 'hidden'
				overlay.style.textOverflow = 'ellipsis'
			}
		}

		positionMediaOverlays()

		document.addEventListener('mouseover', onMouseOver, true)
		document.addEventListener('mouseout', onMouseOut, true)
		document.addEventListener('click', onClick, true)
		window.addEventListener('scroll', positionMediaOverlays, true)
		window.addEventListener('resize', positionMediaOverlays)
		stopMediaPicker = () => {
			document.removeEventListener('mouseover', onMouseOver, true)
			document.removeEventListener('mouseout', onMouseOut, true)
			document.removeEventListener('click', onClick, true)
			window.removeEventListener('scroll', positionMediaOverlays, true)
			window.removeEventListener('resize', positionMediaOverlays)
			overlayLayer.remove()
			for (const element of touchedElements) restoreElement(element)
			pickMedia.classList.remove('picker-active')
			pickMedia.innerHTML = mediaOnlyMode
				? 'Seleccionar media embebida'
				: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg> Seleccionar media embebida'
		}
		cleanupCallbacks.push(() => stopMediaPicker?.())
	}
	pickMedia.addEventListener('click', () => {
		const enabled = !stopMediaPicker
		setMediaPicker(enabled)
		sendTrayAction('set-picker', { pickerMode: enabled ? 'media' : 'none' })
	})
	collectActions.append(pickMedia)

	const create = document.createElement('button')
	create.type = 'button'
	create.className = 'action primary'
	const selectedName =
		snapshot.subforums.find(subforum => subforum.slug === snapshot.selectedSubforum)?.name || 'Mediavida'
	create.title = `Abrir el editor de Mediavida en ${selectedName} con este recorte`
	create.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg> Crear en ${selectedName}`
	create.disabled = !snapshot.selectedSubforum
	create.addEventListener('click', () => {
		const selectedSubforum = subforumSelect.value || snapshot.selectedSubforum
		if (!selectedSubforum) return
		const itemByIndex = new Map<number, ThreadClipperBasketItem>()
		for (const media of snapshot.media) {
			itemByIndex.set(media.itemIndex, { type: 'media', value: media.url })
		}
		for (const textarea of Array.from(shadow.querySelectorAll<HTMLTextAreaElement>('.text-editor'))) {
			const itemIndex = Number(textarea.dataset.itemIndex)
			if (!Number.isInteger(itemIndex)) continue
			itemByIndex.set(itemIndex, {
				type: 'text',
				value: textarea.value,
			})
		}
		const editedItems = Array.from(itemByIndex.entries())
			.sort(([leftIndex], [rightIndex]) => leftIndex - rightIndex)
			.map(([, item]) => item)
		sendTrayAction('create', {
			subforum: selectedSubforum,
			createSnapshot: {
				title: titleInput.value,
				subforum: selectedSubforum,
				textFormat: snapshot.textFormat,
				items: editedItems,
			},
		})
	})
	actions.append(create)

	const clear = document.createElement('button')
	clear.type = 'button'
	clear.className = 'action subtle'
	clear.title = 'Vacía el recorte actual y mantiene abierto el panel'
	clear.innerHTML =
		'<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg> Limpiar'
	clear.addEventListener('click', () => {
		setTrayStatus('Limpiando recorte...', true)
		sendTrayAction('clear')
	})
	actions.append(clear)
	footer.append(statusStrip, collectActions, actions)
	tray.append(header, body, footer)
	shadow.append(style, tray)
	document.documentElement.append(host)

	if (snapshot.activePicker === 'media') setMediaPicker(true)
}

function removeThreadClipperTray(): void {
	;(globalThis as typeof globalThis & { __mvpThreadClipperTrayCleanup?: () => void }).__mvpThreadClipperTrayCleanup?.()
	document.getElementById('mvp-thread-clipper-tray-host')?.remove()
}

function notifyBasketUpdated(tabId: number | undefined, basket: ThreadClipperBasket): void {
	const textCount = basket.items.filter(item => item.type === 'text').length
	const mediaCount = basket.items.filter(item => item.type === 'media').length
	notifyTab(
		tabId,
		`✅ Recorte actualizado (${textCount} texto${textCount === 1 ? '' : 's'}, ${mediaCount} media)`
	)
}

async function showThreadClipperTray(tabId: number | undefined, basket: ThreadClipperBasket): Promise<void> {
	if (!tabId || !browser.scripting?.executeScript) return
	try {
		const [subforums, theme] = await Promise.all([getConfiguredClipperSubforums(), getThreadClipperThemePalette()])
		await browser.scripting.executeScript({
			target: { tabId },
			func: renderThreadClipperTray,
			args: [getBasketSnapshot(basket, subforums, theme)],
		})
	} catch (error) {
		logger.warn('Thread clipper: could not render visual tray', error)
	}
}

async function hideThreadClipperTray(tabId: number | undefined): Promise<void> {
	if (!tabId || !browser.scripting?.executeScript) return
	try {
		await browser.scripting.executeScript({
			target: { tabId },
			func: removeThreadClipperTray,
		})
	} catch {
		// Ignore tray cleanup failures; the source tab may be gone.
	}
}

async function readActiveThreadClipperBasket(
	message: Partial<ThreadClipperTrayMessage>,
	tabId: number | undefined
): Promise<ThreadClipperBasket | null> {
	const basket = await readThreadClipperBasket()
	if (!basket) return null
	const hasMatchingSession = message.sessionId ? basket.sessionId === message.sessionId : basket.tabId === tabId
	if (!hasMatchingSession || basket.tabId !== tabId) {
		await hideThreadClipperTray(tabId)
		notifyTab(tabId, 'ℹ️ Este recorte ya no está activo')
		return null
	}
	return basket
}

function isValidCreateSnapshot(value: unknown): value is ThreadClipperCreateSnapshot {
	if (!value || typeof value !== 'object') return false
	const snapshot = value as Partial<ThreadClipperCreateSnapshot>
	return (
		typeof snapshot.title === 'string' &&
		(snapshot.subforum === undefined ||
			(typeof snapshot.subforum === 'string' && VALID_SUBFORUM_SLUGS.has(snapshot.subforum))) &&
		(snapshot.textFormat === 'quote' || snapshot.textFormat === 'plain') &&
		Array.isArray(snapshot.items)
	)
}

function sanitizeCreateSnapshotItems(items: readonly ThreadClipperBasketItem[]): ThreadClipperBasketItem[] {
	let textCount = 0
	let mediaCount = 0
	const sanitized: ThreadClipperBasketItem[] = []
	for (const item of items) {
		if (item.type === 'text') {
			if (textCount >= THREAD_CLIPPER_LIMITS.maxTextItems) continue
			const value = sanitizeBbcodeMultilineText(item.value).slice(0, MAX_SELECTION_LENGTH).trim()
			if (!value) continue
			sanitized.push({ type: 'text', value, format: item.format })
			textCount += 1
			continue
		}
		if (item.type === 'media') {
			if (mediaCount >= THREAD_CLIPPER_LIMITS.maxMediaItems) continue
			const [value] = normalizeClipMediaUrls([item.value])
			if (!value) continue
			sanitized.push({ type: 'media', value, provider: item.provider })
			mediaCount += 1
			continue
		}
		if (item.type === 'link') {
			const value = normalizeClipSourceUrl(item.value)
			if (value && typeof item.label === 'string') sanitized.push({ type: 'link', value, label: item.label })
		}
	}
	return sanitized
}

async function handleThreadClipperTrayAction(
	message: Partial<ThreadClipperTrayMessage>,
	tabId: number | undefined
): Promise<void> {
	if (message.action === 'set-picker') {
		const basket = await readActiveThreadClipperBasket(message, tabId)
		if (!basket) return
		const activePicker = message.pickerMode === 'media' ? message.pickerMode : undefined
		await updateThreadClipperBasketPicker(basket, activePicker)
		return
	}

	if (message.action === 'set-text-format') {
		const basket = await readActiveThreadClipperBasket(message, tabId)
		if (!basket || (message.textFormat !== 'quote' && message.textFormat !== 'plain')) return
		const updatedBasket = await updateThreadClipperBasketTextFormat(basket, message.textFormat)
		await showThreadClipperTray(tabId, updatedBasket)
		return
	}

	if (message.action === 'set-title') {
		const basket = await readActiveThreadClipperBasket(message, tabId)
		if (!basket || typeof message.title !== 'string') return
		const updatedBasket = await updateThreadClipperBasketTitle(basket, message.title)
		await showThreadClipperTray(tabId, updatedBasket)
		return
	}

	if (message.action === 'set-subforum') {
		const basket = await readActiveThreadClipperBasket(message, tabId)
		if (!basket || typeof message.subforum !== 'string' || !VALID_SUBFORUM_SLUGS.has(message.subforum)) return
		const updatedBasket = await updateThreadClipperBasketSubforum(basket, message.subforum)
		await showThreadClipperTray(tabId, updatedBasket)
		return
	}

	if (message.action === 'update-text-item') {
		const basket = await readActiveThreadClipperBasket(message, tabId)
		if (!basket || typeof message.itemIndex !== 'number' || typeof message.value !== 'string') return
		const item = basket.items[message.itemIndex]
		if (!item || item.type !== 'text') return
		const nextValue = message.value.slice(0, MAX_SELECTION_LENGTH)
		const items = basket.items.map((currentItem, index) =>
			index === message.itemIndex
				? { ...currentItem, value: nextValue }
				: currentItem
		)
		await updateThreadClipperBasketItems(basket, items)
		return
	}

	if (message.action === 'add-selection' || message.action === 'add-media') {
		const basket = await readActiveThreadClipperBasket(message, tabId)
		if (!basket) {
			return
		}

		const items =
			message.action === 'add-selection'
				? (await captureCurrentClip({ tabId })).items
				: createBasketItems({ mediaUrls: typeof message.mediaUrl === 'string' ? [message.mediaUrl] : [] })
		const updatedBasket = await addToThreadClipperBasket({
			sourceUrl: basket.sourceUrl,
			sourceTitle: basket.sourceTitle,
			sessionId: basket.sessionId,
			tabId: basket.tabId,
			items,
		})
		if (!updatedBasket) {
			notifyTab(tabId, 'ℹ️ Selecciona texto o un vídeo/tweet/post compatible')
			return
		}

		const basketWithPicker = await updateThreadClipperBasketPicker(
			updatedBasket,
			message.pickerMode === 'media' ? message.pickerMode : updatedBasket.activePicker
		)
		await showThreadClipperTray(tabId, basketWithPicker)
		notifyBasketUpdated(tabId, basketWithPicker)
		return
	}

	if (message.action === 'remove-item' || message.action === 'clear-kind') {
		const basket = await readActiveThreadClipperBasket(message, tabId)
		if (!basket) return

		const items =
			message.action === 'remove-item' && typeof message.itemIndex === 'number'
				? basket.items.filter((_, index) => index !== message.itemIndex)
				: message.action === 'clear-kind' && message.itemType
				? basket.items.filter(item => item.type !== message.itemType)
				: basket.items
		const updatedBasket = await updateThreadClipperBasketItems(basket, items)
		await showThreadClipperTray(tabId, updatedBasket)
		notifyBasketUpdated(tabId, updatedBasket)
		return
	}

	if (message.action === 'clear') {
		const basket = await readActiveThreadClipperBasket(message, tabId)
		if (!basket) {
			return
		}
		const updatedBasket = await updateThreadClipperBasketPicker(
			await updateThreadClipperBasketItems(basket, []),
			undefined
		)
		await showThreadClipperTray(tabId, updatedBasket)
		notifyTab(tabId, '🧹 Recorte limpiado')
		return
	}

	if (message.action === 'create' && typeof message.subforum === 'string') {
		const basket = await readActiveThreadClipperBasket(message, tabId)
		if (!basket) {
			return
		}
		const createSnapshot = isValidCreateSnapshot(message.createSnapshot) ? message.createSnapshot : undefined
		const prefill = buildClippedThreadPrefill(
			basketToPrefillInput({
				subforum: createSnapshot?.subforum || message.subforum,
				basket: {
					...basket,
					title: createSnapshot ? trimThreadTitle(createSnapshot.title) : basket.title,
					textFormat: createSnapshot?.textFormat ?? basket.textFormat,
					items: createSnapshot ? sanitizeCreateSnapshotItems(createSnapshot.items) : basket.items,
				},
			})
		)
		if (!prefill) return

		await saveClippedThreadPrefill(prefill)
		await addThreadClipperHistoryEntry({
			title: prefill.title,
			sourceUrl: prefill.sourceUrl,
			sourceTitle: basket.sourceTitle,
			subforum: prefill.subforum,
			template: basket.template ?? 'news',
			body: prefill.body,
		})
		await clearThreadClipperBasket()
		await hideThreadClipperTray(tabId)
		await browser.tabs.create({ url: `${MV_BASE_URL}${getNewThreadUrl(prefill.subforum)}` })
	}
}

async function handleOpenThreadClipperTray(input: {
	sourceUrl: string
	tabTitle: string
	tabId?: number
}): Promise<void> {
	try {
		if (isMediavidaSourceUrl(input.sourceUrl)) {
			notifyTab(input.tabId, 'ℹ️ El recortador de noticias no se usa dentro de Mediavida')
			return
		}
		if (isDirectClipperBlockedSourceUrl(input.sourceUrl)) {
			notifyTab(input.tabId, 'ℹ️ Abre el recortador desde una noticia externa')
			return
		}
			const captured = await capturePageClip(input.tabId)
			if (!input.tabId) return
			const basket = await openThreadClipperBasket({
				sourceUrl: input.sourceUrl,
				sourceTitle: buildSourceLinkTitle(captured?.source?.title || input.tabTitle, input.sourceUrl),
				tabId: input.tabId,
				source: captured?.source,
			})
		if (!basket) {
			logger.warn('Thread clipper: unsupported source URL for visual tray', input.sourceUrl)
			return
		}
		await showThreadClipperTray(input.tabId, basket)
	} catch (error) {
		logger.error('Error opening Mediavida thread clipper tray:', error)
	}
}

function captureSelectionForThreadClipper(): CapturedPageClip {
	const BLOCK_TAGS = new Set([
		'ADDRESS',
		'ARTICLE',
		'ASIDE',
		'BLOCKQUOTE',
		'BR',
		'DD',
		'DIV',
		'DL',
		'DT',
		'FIGCAPTION',
		'FIGURE',
		'FOOTER',
		'FORM',
		'H1',
		'H2',
		'H3',
		'H4',
		'H5',
		'H6',
		'HEADER',
		'HR',
		'LI',
		'MAIN',
		'NAV',
		'OL',
		'P',
		'PRE',
		'SECTION',
		'TABLE',
		'UL',
	])
	function getMeta(selector: string): string {
		const element = document.querySelector<HTMLMetaElement>(selector)
		return element?.content?.trim() || ''
	}

	function getJsonLdObjects(): Array<Record<string, unknown>> {
		const objects: Array<Record<string, unknown>> = []
		for (const script of Array.from(
			document.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]')
		)) {
			try {
				const parsed = JSON.parse(script.textContent || '')
				const values = Array.isArray(parsed) ? parsed : [parsed]
				for (const value of values) {
					if (value && typeof value === 'object') objects.push(value as Record<string, unknown>)
					const graph = (value as { '@graph'?: unknown })?.['@graph']
					if (Array.isArray(graph)) {
						for (const graphItem of graph) {
							if (graphItem && typeof graphItem === 'object') objects.push(graphItem as Record<string, unknown>)
						}
					}
				}
			} catch {
				// Ignore malformed JSON-LD.
			}
		}
		return objects
	}

	function getJsonLdString(keys: string[]): string {
		for (const object of getJsonLdObjects()) {
			for (const key of keys) {
				const value = object[key]
				if (typeof value === 'string' && value.trim()) return value.trim()
				if (value && typeof value === 'object') {
					const nested = value as Record<string, unknown>
					if (typeof nested.name === 'string') return nested.name.trim()
					if (typeof nested.url === 'string') return nested.url.trim()
				}
				if (Array.isArray(value)) {
					const first = value.find(item => typeof item === 'string' || (item && typeof item === 'object'))
					if (typeof first === 'string') return first.trim()
					if (first && typeof first === 'object') {
						const nested = first as Record<string, unknown>
						if (typeof nested.name === 'string') return nested.name.trim()
						if (typeof nested.url === 'string') return nested.url.trim()
					}
				}
			}
		}
		return ''
	}

	function absolutize(url: string): string {
		try {
			return new URL(url, document.baseURI).href
		} catch {
			return ''
		}
	}

	function getHost(url: string): string {
		try {
			return new URL(url).hostname.replace(/^www\./, '')
		} catch {
			return location.hostname.replace(/^www\./, '')
		}
	}

	function getPageSource(): ClipSourceMetadata {
		const canonicalUrl = absolutize(document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href || '')
		const url = canonicalUrl || location.href
		const title =
			getMeta('meta[property="og:title"]') ||
			getMeta('meta[name="twitter:title"]') ||
			getJsonLdString(['headline', 'name']) ||
			document.title ||
			getHost(url)
		const description =
			getMeta('meta[property="og:description"]') ||
			getMeta('meta[name="twitter:description"]') ||
			getMeta('meta[name="description"]') ||
			getJsonLdString(['description'])
		const siteName = getMeta('meta[property="og:site_name"]') || getHost(url)
		const publishedAt =
			getMeta('meta[property="article:published_time"]') ||
			getMeta('meta[name="date"]') ||
			getJsonLdString(['datePublished', 'uploadDate'])
		return {
			url,
			canonicalUrl: canonicalUrl || undefined,
			domain: getHost(url),
			siteName: siteName || undefined,
			title,
			description: description || undefined,
			publishedAt: publishedAt || undefined,
		}
	}

	const source = getPageSource()
	const selection = window.getSelection()
	if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
		return { text: '', mediaUrls: [], source }
	}

	const fragment = document.createDocumentFragment()
	for (let index = 0; index < selection.rangeCount; index += 1) {
		fragment.append(selection.getRangeAt(index).cloneContents())
	}

	function appendTextFromNode(node: Node, parts: string[]): void {
		if (node.nodeType === Node.TEXT_NODE) {
			parts.push(node.textContent || '')
			return
		}
		if (!(node instanceof Element)) return

		if (
			node.matches(
				'script, style, noscript, template, iframe, svg, canvas, audio, video, [hidden], [aria-hidden="true"]'
			)
		) {
			return
		}

		const isBlock = BLOCK_TAGS.has(node.tagName)
		if (node.tagName === 'BR') {
			parts.push('\n')
			return
		}
		if (isBlock && parts.length > 0) parts.push('\n')
		for (const child of Array.from(node.childNodes)) {
			appendTextFromNode(child, parts)
		}
		if (isBlock) parts.push('\n')
	}

	const parts: string[] = []
	for (const child of Array.from(fragment.childNodes)) {
		appendTextFromNode(child, parts)
	}

	const text = parts
		.join('')
		.replace(/\r\n?/g, '\n')
		.replace(/[ \t\f\v]+/g, ' ')
		.replace(/ *\n */g, '\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim()

	return { text, mediaUrls: [], source }
}

async function capturePageClip(tabId: number | undefined): Promise<CapturedPageClip | null> {
	if (!tabId || !browser.scripting?.executeScript) return null
	try {
		const [result] = await browser.scripting.executeScript({
			target: { tabId },
			func: captureSelectionForThreadClipper,
		})
		return result?.result ?? null
	} catch (error) {
		logger.warn('Thread clipper: could not capture rich page selection', error)
		return null
	}
}

async function captureCurrentClip(input: {
	tabId?: number
	selectionText?: string
}): Promise<{ items: ThreadClipperBasketItem[]; source?: ClipSourceMetadata }> {
	const captured = await capturePageClip(input.tabId)
	return {
		items: createBasketItems({
			text: captured?.text || input.selectionText,
			mediaUrls: captured?.mediaUrls ?? [],
		}),
		source: captured?.source,
	}
}

// =============================================================================
// Utilities
// =============================================================================

/**
 * Send a notification to a tab (shows as a toast via content script)
 */
function notifyTab(tabId: number | undefined, message: string): void {
	if (!tabId) return
	sendMessage('showToast', { message }, tabId).catch(() => {
		// Tab might not have content script, ignore
	})
}
