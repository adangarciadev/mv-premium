import { describe, it, expect } from 'vitest'
import { cleanPostContent } from './clean-post-content'

function createEl(html: string): Element {
	const div = document.createElement('div')
	div.innerHTML = html
	return div
}

describe('cleanPostContent', () => {
	describe('default behavior (thread summarizer mode)', () => {
		it('should extract plain text content', () => {
			const el = createEl('<p>Hola mundo</p>')
			expect(cleanPostContent(el)).toBe('Hola mundo')
		})

		it('should remove blockquotes', () => {
			const el = createEl('<blockquote>Citado</blockquote>Mi respuesta')
			expect(cleanPostContent(el)).toBe('Mi respuesta')
		})

		it('should remove .cita and .ref elements', () => {
			const el = createEl('<div class="cita">Cita</div><div class="ref">Ref</div>Contenido')
			expect(cleanPostContent(el)).toBe('Contenido')
		})

		it('should remove spoiler elements by default', () => {
			const el = createEl('<div class="spoiler">Secreto</div>Visible')
			expect(cleanPostContent(el)).toBe('Visible')
		})

		it('should remove .sp elements by default', () => {
			const el = createEl('<div class="sp">Oculto</div>Texto')
			expect(cleanPostContent(el)).toBe('Texto')
		})

		it('should remove edit/edited elements', () => {
			const el = createEl('Post<div class="edit">Editado</div>')
			expect(cleanPostContent(el)).toBe('Post')
		})

		it('should strip post metadata and controls when content root is .post-body', () => {
			const el = createEl(`
				<div class="post-body">
					<div class="post-meta">
						<a class="autor">DiVerTiMiX</a>
						<span class="ct">Cristóbal Chorras</span>
						<span class="rd">4d</span>
						<a class="qn">#1269</a>
					</div>
					<div class="post-contents">
						<p>Comentario real del usuario.</p>
					</div>
					<div class="post-controls">
						<button>Responder</button>
					</div>
				</div>
			`)
			expect(cleanPostContent(el, { keepSpoilers: true })).toBe('Comentario real del usuario.')
		})

		it('should remove script and style tags', () => {
			const el = createEl('Text<script>alert(1)</script><style>.x{}</style>')
			expect(cleanPostContent(el)).toBe('Text')
		})

		it('should remove media embeds', () => {
			const el = createEl('Pre <div data-s9e-mediaembed>Video</div> Post')
			expect(cleanPostContent(el)).toBe('Pre Post')
		})

		it('should remove common social embed wrappers', () => {
			const el = createEl('A <blockquote class="twitter-tweet">tweet</blockquote> B')
			expect(cleanPostContent(el)).toBe('A B')
		})

		it('should remove media/iframe/video containers', () => {
			const el = createEl(
				'A <div class="media-container">M</div> <div class="iframe-container">I</div> <div class="video-container">V</div> B'
			)
			expect(cleanPostContent(el)).toBe('A B')
		})

		it('should remove iframe/video/audio/object/embed tags', () => {
			const el = createEl(
				'Antes<iframe src="x"></iframe><video></video><audio></audio><object></object><embed></embed>Después'
			)
			expect(cleanPostContent(el)).toBe('AntesDespués')
		})

		it('should return empty for media-only URL posts', () => {
			const el = createEl('<a href="https://x.com/user/status/123">https://x.com/user/status/123</a>')
			expect(cleanPostContent(el, { keepSpoilers: true })).toBe('')
		})

		it('should keep user text when media URL is accompanied by commentary', () => {
			const el = createEl('Menuda vergüenza <a href="https://x.com/user/status/123">https://x.com/user/status/123</a>')
			expect(cleanPostContent(el, { keepSpoilers: true })).toBe('Menuda vergüenza')
		})

		it('should remove images', () => {
			const el = createEl('Antes<img src="x.jpg" alt="foto">Después')
			expect(cleanPostContent(el)).toBe('AntesDespués')
		})

		it('should remove signatures', () => {
			const el = createEl('Post<div class="post-signature">Firma</div>')
			expect(cleanPostContent(el)).toBe('Post')
		})

		it('should normalize whitespace', () => {
			const el = createEl('Mucho    espacio\n\nen\tblanco')
			expect(cleanPostContent(el)).toBe('Mucho espacio en blanco')
		})

		it('should return empty string for empty content', () => {
			const el = createEl('')
			expect(cleanPostContent(el)).toBe('')
		})

		it('should not modify the original element', () => {
			const el = createEl('<blockquote>Cita</blockquote>Respuesta')
			cleanPostContent(el)
			expect(el.querySelector('blockquote')).not.toBeNull()
		})

		it('should not remove code blocks by default', () => {
			const el = createEl('Text <pre>code here</pre> More')
			expect(cleanPostContent(el)).toBe('Text code here More')
		})
	})

	describe('keepSpoilers option (post summarizer mode)', () => {
		it('should keep spoiler content when keepSpoilers is true', () => {
			const el = createEl('<div class="spoiler">Contenido secreto</div>')
			expect(cleanPostContent(el, { keepSpoilers: true })).toBe('Contenido secreto')
		})

		it('should remove spoiler trigger links but keep content', () => {
			const el = createEl(
				'<div class="spoiler-wrap"><a class="spoiler">Click para desplegar</a><div class="spoiler">Secreto</div></div>'
			)
			const result = cleanPostContent(el, { keepSpoilers: true })
			expect(result).toContain('Secreto')
			expect(result).not.toContain('Click para desplegar')
		})

		it('should remove .quote elements when keepSpoilers is true', () => {
			const el = createEl('<div class="quote">Citado</div>Respuesta')
			expect(cleanPostContent(el, { keepSpoilers: true })).toBe('Respuesta')
		})

		it('should still remove blockquotes when keepSpoilers is true', () => {
			const el = createEl('<blockquote>Cita</blockquote>Respuesta')
			expect(cleanPostContent(el, { keepSpoilers: true })).toBe('Respuesta')
		})
	})

	describe('removeCodeBlocks option', () => {
		it('should remove pre elements when removeCodeBlocks is true', () => {
			const el = createEl('Text <pre>function() {}</pre> More')
			expect(cleanPostContent(el, { removeCodeBlocks: true })).toBe('Text More')
		})

		it('should remove code elements when removeCodeBlocks is true', () => {
			const el = createEl('Text <code>inline code</code> More')
			expect(cleanPostContent(el, { removeCodeBlocks: true })).toBe('Text More')
		})

		it('should keep code blocks when removeCodeBlocks is false', () => {
			const el = createEl('Text <pre>code</pre> More')
			expect(cleanPostContent(el, { removeCodeBlocks: false })).toBe('Text code More')
		})
	})

	describe('combined options (post summary equivalent)', () => {
		it('should match extractPostText behavior with keepSpoilers + removeCodeBlocks', () => {
			const el = createEl(
				'<blockquote>Cita</blockquote>' +
					'<div class="spoiler-wrap"><a class="spoiler">Mostrar</a><div class="spoiler">Spoiler text</div></div>' +
					'<pre>var x = 1;</pre>' +
					'Contenido real del post'
			)

			const result = cleanPostContent(el, { keepSpoilers: true, removeCodeBlocks: true })
			expect(result).not.toContain('Cita')
			expect(result).toContain('Spoiler text')
			expect(result).not.toContain('var x = 1')
			expect(result).toContain('Contenido real del post')
		})
	})

	describe('userAnalysisMode', () => {
		it('should preserve quoted text wrapped in explicit markers', () => {
			const el = createEl('<blockquote>Texto citado</blockquote>Respuesta propia')
			const result = cleanPostContent(el, { userAnalysisMode: true })
			expect(result).toContain('[CITA_INICIO]')
			expect(result).toContain('Texto citado')
			expect(result).toContain('[CITA_FIN]')
			expect(result).toContain('Respuesta propia')
		})

		it('should convert quote links to reply markers', () => {
			const el = createEl('<div class="cita"><a class="quote" rel="123">#123</a> @Pepe dijo</div>Respuesta')
			const result = cleanPostContent(el, { userAnalysisMode: true })
			expect(result).toContain('[→ responde al #123]')
		})

		it('should extract quoted post number from href formats', () => {
			const el = createEl('<div class="cita"><a class="quote" href="#post-456">cita</a></div>Respuesta')
			const result = cleanPostContent(el, { userAnalysisMode: true })
			expect(result).toContain('[→ responde al #456]')
		})

		it('should not generate invalid reply markers when quote link has no numeric reference', () => {
			const el = createEl('<div class="cita"><a class="quote" href="/foro/hilo">cita</a></div>Respuesta')
			const result = cleanPostContent(el, { userAnalysisMode: true })
			expect(result).not.toContain('#undefined')
			expect(result).not.toContain('[→ responde al #]')
			expect(result).toContain('Respuesta')
		})
	})
})
