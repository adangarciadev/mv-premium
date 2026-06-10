import { describe, expect, it } from 'vitest'
import {
	extractThreadCreatorUsernameFromRow,
	extractThreadPathFromRow,
	extractThreadTitleFromRow,
	extractSubforumIdFromThreadPath,
	canExtractThreadCreatorFromPath,
	normalizeThreadPath,
	parseHiddenThreadFromUrl,
} from './thread-utils'

describe('hidden-threads thread-utils', () => {
	describe('normalizeThreadPath', () => {
		it('normalizes a standard thread URL', () => {
			const result = normalizeThreadPath('https://www.mediavida.com/foro/cine/supergirl-2026-dc-studios-729454')
			expect(result).toBe('/foro/cine/supergirl-2026-dc-studios-729454')
		})

		it('removes page, hash and live suffix', () => {
			expect(
				normalizeThreadPath('https://www.mediavida.com/foro/cine/supergirl-2026-dc-studios-729454/5#125')
			).toBe('/foro/cine/supergirl-2026-dc-studios-729454')

			expect(normalizeThreadPath('/foro/feda/fedachat-mas-retraso-flotilla-726612/live')).toBe(
				'/foro/feda/fedachat-mas-retraso-flotilla-726612'
			)
		})

		it('returns null for non-thread URLs', () => {
			expect(normalizeThreadPath('https://www.mediavida.com/foro/cine')).toBeNull()
			expect(normalizeThreadPath('https://www.mediavida.com/foro/spy')).toBeNull()
			expect(normalizeThreadPath('https://example.com/foro/cine/hilo-123')).toBeNull()
		})
	})

	describe('parseHiddenThreadFromUrl', () => {
		it('extracts normalized metadata from URL', () => {
			const parsed = parseHiddenThreadFromUrl('https://www.mediavida.com/foro/cine/supergirl-2026-dc-studios-729454/5')

			expect(parsed).toEqual({
				id: '/foro/cine/supergirl-2026-dc-studios-729454',
				title: 'Supergirl 2026 Dc Studios',
				subforum: 'Cine',
				subforumId: '/foro/cine',
			})
		})
	})

	describe('extractThreadPathFromRow', () => {
		it('extracts a thread path from a row element', () => {
			document.body.innerHTML = `
				<table>
					<tbody id="temas">
						<tr id="t729454">
							<td class="col-th">
								<div class="thread">
									<a href="/foro/cine/supergirl-2026-dc-studios-729454/5">Supergirl</a>
								</div>
								<div class="tag-group">
									<a href="/foro/cine/tag/accion">Acción</a>
								</div>
							</td>
						</tr>
					</tbody>
				</table>
			`

			const row = document.querySelector('tbody#temas tr')!
			expect(extractThreadPathFromRow(row)).toBe('/foro/cine/supergirl-2026-dc-studios-729454')
		})

		it('extracts a thread path from profile "Últimos posts" style rows', () => {
			document.body.innerHTML = `
				<table id="temas" class="mv full posts">
					<tbody>
						<tr>
							<td class="autor-avatar">
								<a href="/foro/mediavida"><i class="fid fid-4"></i></a>
							</td>
							<td class="col-th">
								<div class="thread">
									<a class="title" href="/foro/mediavida/mediavida-premium-chrome-firefox-extension-731168/12#331">
										Mediavida Premium
									</a>
								</div>
							</td>
							<td class="last-av">
								<a href="/foro/mediavida/mediavida-premium-chrome-firefox-extension-731168/12#331">2m</a>
							</td>
						</tr>
					</tbody>
				</table>
			`

			const row = document.querySelector('table#temas tbody tr')!
			expect(extractThreadPathFromRow(row)).toBe('/foro/mediavida/mediavida-premium-chrome-firefox-extension-731168')
		})

		it('returns null when row does not contain a thread link', () => {
			document.body.innerHTML = `
				<table>
					<tbody id="temas">
						<tr>
							<td class="col-th"><div class="thread"><a href="/foro/cine/tag/accion">Acción</a></div></td>
						</tr>
					</tbody>
				</table>
			`

			const row = document.querySelector('tbody#temas tr')!
			expect(extractThreadPathFromRow(row)).toBeNull()
		})
	})

	describe('content rule helpers', () => {
		it('extracts the visible thread title from a row', () => {
			document.body.innerHTML = `
				<table>
					<tbody id="temas">
						<tr>
							<td class="col-th">
								<div class="thread">
									<a title="Título completo" href="/foro/cine/titulo-completo-123">Título corto</a>
								</div>
							</td>
						</tr>
					</tbody>
				</table>
			`

			const row = document.querySelector('tbody#temas tr')!
			expect(extractThreadTitleFromRow(row)).toBe('Título completo')
		})

		it('ignores subforum links inside the thread block when extracting title', () => {
			document.body.innerHTML = `
				<table>
					<tbody id="temas">
						<tr>
							<td class="col-th">
								<div class="thread">
									<a class="tag" href="/foro/deportes">Deportes</a>
									<a class="title" href="/foro/deportes/pretemporada-real-madrid-cf-123">
										Pretemporada 2026/27: Real Madrid CF
									</a>
								</div>
							</td>
						</tr>
					</tbody>
				</table>
			`

			const row = document.querySelector('tbody#temas tr')!
			expect(extractThreadPathFromRow(row)).toBe('/foro/deportes/pretemporada-real-madrid-cf-123')
			expect(extractThreadTitleFromRow(row)).toBe('Pretemporada 2026/27: Real Madrid CF')
		})

		it('extracts the subforum id from a normalized thread path', () => {
			expect(extractSubforumIdFromThreadPath('/foro/juegos/ofertas-steam-123')).toBe('/foro/juegos')
			expect(extractSubforumIdFromThreadPath(null)).toBeNull()
		})

		it('does not trust row users as thread creators on global forum views', () => {
			expect(canExtractThreadCreatorFromPath('/foro/spy')).toBe(false)
			expect(canExtractThreadCreatorFromPath('/foro/spy/live')).toBe(false)
			expect(canExtractThreadCreatorFromPath('/foro/new')).toBe(false)
			expect(canExtractThreadCreatorFromPath('/foro/unread')).toBe(false)
			expect(canExtractThreadCreatorFromPath('/foro/top')).toBe(false)
			expect(canExtractThreadCreatorFromPath('/foro/featured')).toBe(false)
			expect(canExtractThreadCreatorFromPath('/foro/juegos')).toBe(true)
		})
	})

	describe('extractThreadCreatorUsernameFromRow', () => {
		it('extracts the creator from standard subforum rows', () => {
			document.body.innerHTML = `
				<table>
					<tbody id="temas">
						<tr>
							<td class="col-th">
								<div class="thread">
									<a href="/foro/deportes/thread-oficial-123">Thread oficial</a>
								</div>
							</td>
							<td class="col-av col-av-m ddtc">
								<a class="tooltip-left" title="JMBaDBoY creó el tema - 3h" href="/id/JMBaDBoY">
									<img alt="JMBaDBoY" src="/avatar.jpg">
								</a>
								<a class="tooltip-left" style="margin-left: 5px" title="Styles hizo el último comentario" href="/id/Styles">
									<img alt="Styles" src="/avatar2.jpg">
								</a>
							</td>
						</tr>
					</tbody>
				</table>
			`

			const row = document.querySelector('tbody#temas tr')!
			expect(extractThreadCreatorUsernameFromRow(row)).toBe('JMBaDBoY')
		})

		it('extracts the creator when op is also the last commenter', () => {
			document.body.innerHTML = `
				<table>
					<tbody id="temas">
						<tr>
							<td class="col-th">
								<div class="thread">
									<a href="/foro/deportes/nba-playoffs-2026-734396">NBA Playoffs 2026</a>
								</div>
							</td>
							<td class="col-av col-av-m ddtc">
								<a class="tooltip-left op" title="Rudeboyx creó el tema - 16d  - y ha hecho el último comentario" href="/id/Rudeboyx">
									<img alt="Rudeboyx" src="/avatar.jpg">
								</a>
								&nbsp;
							</td>
						</tr>
					</tbody>
				</table>
			`

			const row = document.querySelector('tbody#temas tr')!
			expect(extractThreadCreatorUsernameFromRow(row)).toBe('Rudeboyx')
		})

		it('returns null when the row has no creator cell', () => {
			document.body.innerHTML = `
				<table>
					<tbody id="temas">
						<tr>
							<td class="col-th">
								<div class="thread">
									<a href="/foro/deportes/thread-oficial-123">Thread oficial</a>
								</div>
							</td>
						</tr>
					</tbody>
				</table>
			`

			const row = document.querySelector('tbody#temas tr')!
			expect(extractThreadCreatorUsernameFromRow(row)).toBeNull()
		})

		it('prefers the link explicitly marked as creator by title/original-title', () => {
			document.body.innerHTML = `
				<table>
					<tbody id="temas">
						<tr>
							<td class="bautor">
								<a href="/id/LastPoster" title="LastPoster hizo el último comentario">LastPoster</a>
								<a href="/id/TopicOwner" original-title="TopicOwner creó el tema - 1d">TopicOwner</a>
							</td>
						</tr>
					</tbody>
				</table>
			`

			const row = document.querySelector('tbody#temas tr')!
			expect(extractThreadCreatorUsernameFromRow(row)).toBe('TopicOwner')
		})
	})
})
