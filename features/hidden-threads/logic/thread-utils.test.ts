import { describe, expect, it } from 'vitest'
import { extractThreadPathFromRow, normalizeThreadPath, parseHiddenThreadFromUrl } from './thread-utils'

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
})
