import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockSettingsState = vi.hoisted(() => ({
	twitterLiteEmbedsEnabled: false,
}))

import {
	cleanupThreadPreview,
	extractFirstPostPreview,
	getThreadPreviewUrlFromRow,
	getThreadTitleLinkFromRow,
	injectThreadPreviewButtons,
	isPreviewTruncable,
	normalizeThreadPreviewUrl,
} from './thread-preview'
import { sendMessage } from '@/lib/messaging'
import { reinitializeEmbeds } from '@/lib/content-modules/utils/reinitialize-embeds'
import { useSettingsStore } from '@/store/settings-store'
import { EXPAND_CLASS, STYLE_ID } from './constants'

vi.mock('@/lib/messaging', () => ({
	sendMessage: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
	logger: {
		warn: vi.fn(),
	},
}))

vi.mock('@/lib/content-modules/utils/reinitialize-embeds', () => ({
	reinitializeEmbeds: vi.fn(),
	setupGlobalEmbedListener: vi.fn(),
}))

vi.mock('@/store/settings-store', () => ({
	useSettingsStore: {
		getState: () => mockSettingsState,
		setState: (updates: Partial<typeof mockSettingsState>) => Object.assign(mockSettingsState, updates),
	},
}))

const mockedSendMessage = vi.mocked(sendMessage)
const mockedReinitializeEmbeds = vi.mocked(reinitializeEmbeds)

function renderThreadTable(): void {
	document.body.innerHTML = `
		<table id="tablatemas" class="mv full">
			<tbody id="temas">
				<tr class="unread">
					<td class="col-th">
						<div class="thread">
							<a id="a735773" class="hb" title="me han robado la cuenta de steam" href="/foro/juegos/me-han-robado-cuenta-steam-735773">me han robado la cuenta de steam</a>
							<span class="unread-g">&nbsp;<a href="/foro/juegos/me-han-robado-cuenta-steam-735773#17" class="unseen-num">17</a></span>
						</div>
						<div class="tag-group"><a href="/foro/juegos/tag/stream" class="cat-badge">Stream</a></div>
					</td>
					<td class="thread-count">32</td>
					<td class="dtc">514</td>
					<td class="col-av">avatars</td>
					<td class="last-av">5m</td>
				</tr>
			</tbody>
		</table>
	`
}

function createThreadHtml(bodyHtml = '<p>Contenido del primer post</p>'): string {
	return `
		<div id="topic"><h1>Thread test</h1></div>
		<div id="posts-wrap">
			<div class="post" data-num="1" data-autor="AuL3">
				<div class="post-avatar">
					<a href="/id/AuL3"><img class="avatar" alt="AuL3" src="/style/img/pix.gif" data-src="/img/users/avatar/1u/1ux9btqhd.gif"></a>
				</div>
				<div class="post-header">
					<a class="autor" href="/id/AuL3" style="color: #f7be58">AuL3</a>
					<time title="26/5/26 a las 15:26">5m</time>
				</div>
				<div class="post-contents">
					<div class="body">${bodyHtml}</div>
				</div>
			</div>
		</div>
	`
}

function createRect(top: number, bottom: number): DOMRect {
	return {
		bottom,
		height: bottom - top,
		left: 0,
		right: 100,
		top,
		width: 100,
		x: 0,
		y: top,
		toJSON: () => ({}),
	} as DOMRect
}

describe('thread-preview', () => {
	beforeEach(() => {
		mockedSendMessage.mockReset()
		mockedReinitializeEmbeds.mockReset()
		useSettingsStore.setState({ twitterLiteEmbedsEnabled: false })
	})

	afterEach(() => {
		cleanupThreadPreview()
		vi.unstubAllGlobals()
	})

	it('extracts the main title link from a forum row', () => {
		renderThreadTable()
		const row = document.querySelector('tr')!

		const link = getThreadTitleLinkFromRow(row)

		expect(link?.getAttribute('href')).toBe('/foro/juegos/me-han-robado-cuenta-steam-735773')
		expect(getThreadPreviewUrlFromRow(row)).toBe(
			'https://www.mediavida.com/foro/juegos/me-han-robado-cuenta-steam-735773'
		)
	})

	it('normalizes thread URLs to the first page without query or hash', () => {
		expect(normalizeThreadPreviewUrl('/foro/juegos/paralives-735724/5#125')).toBe(
			'https://www.mediavida.com/foro/juegos/paralives-735724'
		)
		expect(normalizeThreadPreviewUrl('https://www.mediavida.com/foro/juegos/paralives-735724?unread')).toBe(
			'https://www.mediavida.com/foro/juegos/paralives-735724'
		)
		expect(normalizeThreadPreviewUrl('https://example.com/foro/juegos/paralives-735724')).toBeNull()
	})

	it('extracts and cleans the first post preview from fetched HTML', () => {
		const doc = new DOMParser().parseFromString(
			createThreadHtml(`
				<p>Hola <strong>MV</strong></p>
				<script>alert(1)</script>
				<button>Responder</button>
				<img src="/style/img/pix.gif" data-src="/img/test.jpg" onclick="alert(1)">
			`),
			'text/html'
		)

		const preview = extractFirstPostPreview(doc, 'https://www.mediavida.com/foro/juegos/test-123')

		expect(preview?.postHtml).toContain('class="post"')
		expect(preview?.postHtml).toContain('<strong>MV</strong>')
		expect(preview?.postHtml).toContain('src="/img/test.jpg"')
		expect(preview?.postHtml).toContain('data-num="1"')
		expect(preview?.postHtml).not.toContain('<script')
		expect(preview?.postHtml).not.toContain('onclick')
	})

	it('keeps post likes as read-only summary and removes voting controls', () => {
		const doc = new DOMParser().parseFromString(
			createThreadHtml(`
				<p>Post con manitas</p>
				<div class="post-controls">
					<a href="/foro/thumbs.php?tid=1&num=1" class="post-btn btnmola post-n hot-1">
						<i class="fa fa-thumbs-up"></i><span>7</span>
					</a>
					<a href="#" class="post-btn masmola">votar</a>
				</div>
			`),
			'text/html'
		)

		const preview = extractFirstPostPreview(doc, 'https://www.mediavida.com/foro/juegos/test-123')
		const previewDoc = new DOMParser().parseFromString(preview?.postHtml ?? '', 'text/html')

		expect(previewDoc.querySelector('.mvp-thread-preview-like-summary')?.textContent).toContain('7')
		expect(previewDoc.querySelector('.mvp-thread-preview-like-summary')?.getAttribute('aria-label')).toBe('7 me gusta')
		expect(previewDoc.querySelector('a.masmola')).toBeNull()
		expect(previewDoc.querySelector('a[href*="thumbs.php"]')).toBeNull()
	})

	it('ignores generic post containers and preserves the real post markup', () => {
		const doc = new DOMParser().parseFromString(
			`
				<div id="topic"><h1>Llega el Verano</h1></div>
				<div id="post-container">
					<div id="post-1">
						<div class="post-header">
							<a class="autor" href="/id/Fetillera" style="color: #8bb8f7">Fetillera</a>
							<span class="date">3d</span>
							<span>última edición domingo 24 may, 00:17</span>
						</div>
						<div class="post-avatar"><img class="avatar" src="/img/users/avatar/feti.png"></div>
						<div class="post-contents">
							<div class="body">
								<p><strong>Fetillera</strong></p>
								<p>última edición domingo 24 may, 00:17</p>
								<h2>Los termómetros se disparan</h2>
								<p>Los efectos de una masa de aire cálida ya se notan.</p>
							</div>
						</div>
					</div>
				</div>
			`,
			'text/html'
		)

		const preview = extractFirstPostPreview(doc, 'https://www.mediavida.com/foro/off-topic/llega-verano-123')

		expect(preview?.postHtml).toContain('id="post-1"')
		expect(preview?.postHtml).toContain('<strong>Fetillera</strong>')
		expect(preview?.postHtml).toContain('última edición')
		expect(preview?.postHtml).toContain('Los termómetros se disparan')
	})

	it('detects truncable content by scroll height', () => {
		const element = document.createElement('div')
		Object.defineProperty(element, 'scrollHeight', { value: 460, configurable: true })

		expect(isPreviewTruncable(element, 280)).toBe(true)
		expect(isPreviewTruncable(element, 400)).toBe(false)
	})

	it('does not mark a preview as truncable when measured content fits the visible body', () => {
		const element = document.createElement('div')
		Object.defineProperty(element, 'clientHeight', { value: 760, configurable: true })
		Object.defineProperty(element, 'scrollHeight', { value: 772, configurable: true })

		expect(isPreviewTruncable(element, 760)).toBe(false)
	})

	it('uses real first-post content height instead of inflated preview scroll height', () => {
		const element = document.createElement('div')
		element.innerHTML = `
			<div class="post">
				<div class="post-contents"><p>Post corto con media ya visible.</p></div>
				<div class="post-controls"><span class="mvp-thread-preview-like-summary">4</span></div>
			</div>
		`
		document.body.appendChild(element)

		const contents = element.querySelector<HTMLElement>('.post-contents')!
		const controls = element.querySelector<HTMLElement>('.post-controls')!
		Object.defineProperty(element, 'clientHeight', { value: 760, configurable: true })
		Object.defineProperty(element, 'scrollHeight', { value: 980, configurable: true })
		element.getBoundingClientRect = vi.fn(() => createRect(100, 860))
		contents.getBoundingClientRect = vi.fn(() => createRect(130, 660))
		controls.getBoundingClientRect = vi.fn(() => createRect(690, 720))

		expect(isPreviewTruncable(element, 760)).toBe(false)
	})

	it('injects preview buttons once and opens a preview row', async () => {
		renderThreadTable()
		mockedSendMessage.mockResolvedValue({
			success: true,
			html: createThreadHtml('<p>Este es el OP del hilo.</p>'),
		})

		injectThreadPreviewButtons()
		injectThreadPreviewButtons()

		const button = document.querySelector<HTMLButtonElement>('[data-mvp-thread-preview]')!
		expect(document.querySelectorAll('[data-mvp-thread-preview]')).toHaveLength(1)

		button.click()

		await vi.waitFor(() => {
			expect(document.querySelector('[data-mvp-thread-preview-row]')?.textContent).toContain('Este es el OP del hilo.')
		})

		const previewRow = document.querySelector('[data-mvp-thread-preview-row]')!
		expect(previewRow.querySelector<HTMLImageElement>('.post-avatar img')?.src).toBe(
			'https://www.mediavida.com/img/users/avatar/1u/1ux9btqhd.gif'
		)
		expect(previewRow.querySelector<HTMLAnchorElement>('a.autor')?.href).toBe(
			'https://www.mediavida.com/id/AuL3'
		)
		expect(previewRow.querySelector('.post[data-num="1"]')).toBeTruthy()
		expect(mockedReinitializeEmbeds).toHaveBeenCalledTimes(1)
		expect(button.getAttribute('aria-expanded')).toBe('true')
		expect(mockedSendMessage).toHaveBeenCalledTimes(1)
		expect(mockedSendMessage).toHaveBeenCalledWith('fetchThreadPageHtml', {
			url: 'https://www.mediavida.com/foro/juegos/me-han-robado-cuenta-steam-735773',
		})
	})

	it('renders news-converted threads with the regular forum post shell', async () => {
		renderThreadTable()
		mockedSendMessage.mockResolvedValue({
			success: true,
			html: `
				<div id="posts-wrap">
					<div id="post-1" class="cf post news first op" data-num="1" data-autor="Batur">
						<a name="1" class="name-pad"></a>
						<div class="post-avatar">
							<a href="/id/Batur" data-id="137096" class="user-card">
								<img alt="Batur" class="avatar lazyload" src="/style/img/pix.gif" data-src="/img/users/avatar/6h/6hiy9r0Om_big.jpg">
							</a>
						</div>
						<div class="post-body">
							<div class="post-meta">
								<a class="autor user-card" href="/id/Batur" data-id="137096">Batur</a>
								<a class="qn" href="#1">#1</a>
								<span class="rd" title="26/5/26 a las 12:01">1d</span>
							</div>
							<div class="post-contents"><p>Evento de Dragon Quest.</p></div>
						</div>
					</div>
				</div>
			`,
		})

		injectThreadPreviewButtons()
		document.querySelector<HTMLButtonElement>('[data-mvp-thread-preview]')!.click()

		await vi.waitFor(() => {
			expect(document.querySelector('[data-mvp-thread-preview-row]')?.textContent).toContain('Evento de Dragon Quest.')
		})

		const post = document.querySelector<HTMLElement>('[data-mvp-thread-preview-row] #post-1')!
		expect(post.classList.contains('news')).toBe(false)
		expect(post.querySelector<HTMLImageElement>('.post-avatar img')?.src).toBe(
			'https://www.mediavida.com/img/users/avatar/6h/6hiy9r0Om_big.jpg'
		)
		expect(post.querySelector<HTMLAnchorElement>('.post-meta a.autor')?.textContent).toBe('Batur')
	})

	it('passes the tweet lite setting when reinitializing preview embeds', async () => {
		useSettingsStore.setState({ twitterLiteEmbedsEnabled: true })
		renderThreadTable()
		mockedSendMessage.mockResolvedValue({
			success: true,
			html: createThreadHtml(`
				<p>Tweet del OP.</p>
				<div data-s9e-mediaembed="twitter" class="embed twitter">
					<iframe allowfullscreen="" scrolling="no" style="border: 0px; height: 871px;" width="100%" src="//platform.twitter.com/embed/Tweet.html?id=2059168469766328430"></iframe>
				</div>
			`),
		})

		injectThreadPreviewButtons()
		document.querySelector<HTMLButtonElement>('[data-mvp-thread-preview]')!.click()

		await vi.waitFor(() => {
			expect(mockedReinitializeEmbeds).toHaveBeenCalledWith(
				expect.any(HTMLElement),
				expect.objectContaining({ forceReloadTwitter: true, twitterLiteMode: true })
			)
		})
	})

	it('keeps YouTube lite embeds visible in rendered previews', async () => {
		renderThreadTable()
		mockedSendMessage.mockResolvedValue({
			success: true,
			html: createThreadHtml(`
				<p>Trailer final</p>
				<div data-s9e-mediaembed="youtube" class="embed r16-9 yt">
					<div class="youtube_lite">
						<a class="preinit" data-height="349" data-youtube="Foltcapx62E" style="background-image:url(//i.ytimg.com/vi/Foltcapx62E/hqdefault.jpg)" data-params="" href="https://www.youtube.com/watch?v=Foltcapx62E"></a>
					</div>
				</div>
			`),
		})

		injectThreadPreviewButtons()
		document.querySelector<HTMLButtonElement>('[data-mvp-thread-preview]')!.click()

		await vi.waitFor(() => {
			expect(document.querySelector('[data-s9e-mediaembed="youtube"] [data-youtube="Foltcapx62E"]')).toBeTruthy()
		})

		const embed = document.querySelector<HTMLElement>('[data-s9e-mediaembed="youtube"]')!
		const link = embed.querySelector<HTMLAnchorElement>('[data-youtube="Foltcapx62E"]')!
		expect(embed.classList.contains('mvp-thread-preview-empty-embed')).toBe(false)
		expect(link.style.backgroundImage).toContain('//i.ytimg.com/vi/Foltcapx62E/hqdefault.jpg')

		const navigated = link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
		expect(navigated).toBe(false)
		const iframe = embed.querySelector<HTMLIFrameElement>('iframe')!
		const iframeUrl = new URL(iframe.src)
		expect(`${iframeUrl.origin}${iframeUrl.pathname}`).toBe('https://www.youtube.com/embed/Foltcapx62E')
		expect(iframeUrl.searchParams.get('autoplay')).toBe('1')
		expect(iframeUrl.searchParams.get('rel')).toBe('0')
		expect(iframeUrl.searchParams.get('origin')).toBe('https://www.mediavida.com')
		expect(iframe.getAttribute('referrerpolicy')).toBe('strict-origin-when-cross-origin')
		expect(embed.querySelector('[data-youtube="Foltcapx62E"]')).toBeNull()
	})

	it('keeps the expand control visually hidden for short previews', async () => {
		renderThreadTable()
		mockedSendMessage.mockResolvedValue({
			success: true,
			html: createThreadHtml(`
				<div data-s9e-mediaembed="youtube" class="embed r16-9 yt">
					<div class="youtube_lite">
						<a class="preinit" data-height="349" data-youtube="zleb0Lfrp2w" style="background-image:url(//i.ytimg.com/vi/zleb0Lfrp2w/hqdefault.jpg)" data-params="" href="https://www.youtube.com/watch?v=zleb0Lfrp2w"></a>
					</div>
				</div>
				<p><strong>Square Enix ha anunciado Dragon Quest Monsters: The Withered World.</strong></p>
				<p>El trailer confirma lanzamiento en PC, PlayStation 5, Xbox Series X/S, Nintendo Switch y Switch 2.</p>
			`),
		})

		injectThreadPreviewButtons()
		document.querySelector<HTMLButtonElement>('[data-mvp-thread-preview]')!.click()

		await vi.waitFor(() => {
			expect(document.querySelector('[data-s9e-mediaembed="youtube"] [data-youtube="zleb0Lfrp2w"]')).toBeTruthy()
		})

		const expandButton = document.querySelector<HTMLButtonElement>(`.${EXPAND_CLASS}`)!
		expect(expandButton.hidden).toBe(true)
		expect(document.getElementById(STYLE_ID)?.textContent).toContain(`.${EXPAND_CLASS}[hidden]`)
		expect(getComputedStyle(expandButton).display).toBe('none')
	})

	it('shows a partial real OP and expands it to the complete post', async () => {
		renderThreadTable()
		mockedSendMessage.mockResolvedValue({
			success: true,
			html: createThreadHtml('<p>Contenido largo.</p>'),
		})
		vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
			return window.setTimeout(() => {
				const body = document.querySelector<HTMLElement>('.mvp-thread-preview-body')
				if (body) {
					Object.defineProperty(body, 'scrollHeight', { value: 1200, configurable: true })
				}
				callback(0)
			}, 0)
		})

		injectThreadPreviewButtons()
		document.querySelector<HTMLButtonElement>('[data-mvp-thread-preview]')!.click()

		await vi.waitFor(() => {
			const expandButton = document.querySelector<HTMLButtonElement>('.mvp-thread-preview-expand')
			expect(expandButton?.hidden).toBe(false)
			expect(expandButton?.textContent).toContain('Ver más')
		})

		const body = document.querySelector<HTMLElement>('.mvp-thread-preview-body')!
		const expandButton = document.querySelector<HTMLButtonElement>('.mvp-thread-preview-expand')!
		expect(body.querySelector('.post[data-num="1"]')).toBeTruthy()
		expect(body.classList.contains('mvp-thread-preview-body-clamped')).toBe(true)
		expect(body.classList.contains('mvp-thread-preview-body-truncable')).toBe(true)

		expandButton.click()

		expect(body.classList.contains('mvp-thread-preview-body-clamped')).toBe(false)
		expect(expandButton.textContent).toContain('Ver menos')
	})

	it('injects preview buttons in subforum rows without native row ids', () => {
		renderThreadTable()
		const row = document.querySelector('tbody#temas tr')!
		expect(row.id).toBe('')

		injectThreadPreviewButtons()

		expect(row.querySelector('[data-mvp-thread-preview]')).toBeTruthy()
	})

	it('closes a preview and reopens it from cache', async () => {
		renderThreadTable()
		mockedSendMessage.mockResolvedValue({
			success: true,
			html: createThreadHtml('<p>Contenido cacheado.</p>'),
		})

		injectThreadPreviewButtons()
		const button = document.querySelector<HTMLButtonElement>('[data-mvp-thread-preview]')!

		button.click()
		await vi.waitFor(() => {
			expect(document.querySelector('[data-mvp-thread-preview-row]')?.textContent).toContain('Contenido cacheado.')
		})

		button.click()
		expect(document.querySelector('[data-mvp-thread-preview-row]')).toBeNull()

		button.click()
		await vi.waitFor(() => {
			expect(document.querySelector('[data-mvp-thread-preview-row]')?.textContent).toContain('Contenido cacheado.')
		})
		expect(mockedSendMessage).toHaveBeenCalledTimes(1)
	})

	it('renders an error row when fetching fails', async () => {
		renderThreadTable()
		mockedSendMessage.mockResolvedValue({
			success: false,
			error: 'HTTP 500',
		})

		injectThreadPreviewButtons()
		document.querySelector<HTMLButtonElement>('[data-mvp-thread-preview]')!.click()

		await vi.waitFor(() => {
			expect(document.querySelector('[data-mvp-thread-preview-row]')?.textContent).toContain(
				'No se pudo cargar la preview: HTTP 500'
			)
		})
	})
})
