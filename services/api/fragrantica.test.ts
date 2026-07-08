import { describe, expect, it } from 'vitest'
import { normalizeFragranticaPerfumeUrl, parseFragranticaHtml } from './fragrantica'

describe('normalizeFragranticaPerfumeUrl', () => {
	it('normalizes supported perfume links to the Spanish HTTPS page', () => {
		expect(
			normalizeFragranticaPerfumeUrl('http://fragrantica.com/perfume/Dior/Sauvage-31861.html?foo=bar#reviews')
		).toBe('https://www.fragrantica.es/perfume/Dior/Sauvage-31861.html')
	})

	it('rejects non-perfume Fragrantica links', () => {
		expect(normalizeFragranticaPerfumeUrl('https://www.fragrantica.es/designers/Dior.html')).toBeNull()
	})
})

describe('parseFragranticaHtml', () => {
	it('extracts the fragrance summary from Spanish Fragrantica markup', () => {
		const html = `
			<html>
				<head>
					<title>Sauvage Dior para Hombres Fragrantica</title>
					<meta property="og:image" content="https://fimgs.net/mdimg/perfume/375x500.31861.jpg">
					<script type="application/ld+json">
						{
							"@type": "Product",
							"name": "Sauvage Dior",
							"description": "Notas de Salida son bergamota y pimienta; Nota de Corazón es lavanda; Notas de Fondo son ambroxan y cedro.",
							"brand": { "name": "Dior" },
							"aggregateRating": { "ratingValue": "4.02", "ratingCount": "18421" },
							"image": "https://fimgs.net/mdimg/perfume/375x500.31861.jpg"
						}
					</script>
				</head>
				<body>
					<h1>Sauvage Dior para Hombres</h1>
					<div class="accord-box" style="background: #9ed7d5; width: 94%;">fresco especiado</div>
					<div class="accord-box" style="background: #b88454; width: 72%;">amaderado</div>
				<img src="https://fimgs.net/mdimg/perfume-thumbs/dark-375x500.31861.avif">
					<div id="pyramid">
						<h4><span class="inline-block px-3 py-1 uppercase tracking-wider">Notas de Salida </span></h4>
						<div class="pyramid-level-container">
							<a href="https://www.fragrantica.es/notas/Bergamota-1.html"><span class="pyramid-note-label mt-1.5">Bergamota</span></a>
							<a href="https://www.fragrantica.es/notas/Pimienta-2.html"><span class="pyramid-note-label mt-1.5">Pimienta</span></a>
						</div>
						<h4><span class="inline-block px-3 py-1 uppercase tracking-wider">Corazón </span></h4>
						<div class="pyramid-level-container">
							<a href="https://www.fragrantica.es/notas/Lavanda-3.html"><span class="pyramid-note-label mt-1.5">Lavanda</span></a>
						</div>
						<h4><span class="inline-block px-3 py-1 uppercase tracking-wider">Base </span></h4>
						<div class="pyramid-level-container">
							<a href="https://www.fragrantica.es/notas/Ambroxan-4.html"><span class="pyramid-note-label mt-1.5">Ambroxan</span></a>
							<a href="https://www.fragrantica.es/notas/Cedro-5.html"><span class="pyramid-note-label mt-1.5">Cedro</span></a>
						</div>
						<button>Votar por ingredientes</button>
					</div>
				</body>
			</html>
		`

		const fragrance = parseFragranticaHtml(html, 'https://www.fragrantica.es/perfume/Dior/Sauvage-31861.html')

		expect(fragrance).toMatchObject({
			id: '31861',
			url: 'https://www.fragrantica.es/perfume/Dior/Sauvage-31861.html',
			title: 'Sauvage Dior',
			brand: 'Dior',
			audience: 'Hombres',
			image: 'https://fimgs.net/mdimg/perfume-thumbs/dark-375x500.31861.avif',
			rating: { value: 4.02, count: 18421 },
			accords: [
				{ label: 'fresco especiado', color: '#9ed7d5', score: 94 },
				{ label: 'amaderado', color: '#b88454', score: 72 },
			],
			pyramid: {
				top: ['Bergamota', 'Pimienta'],
				middle: ['Lavanda'],
				base: ['Ambroxan', 'Cedro'],
			},
		})
	})

	it('does not let the descriptive paragraph hijack pyramid extraction (regression)', () => {
		const html = `
			<html>
				<body>
					<h1>White Soho Zara para Hombres</h1>
					<p>La Nota de Salida es almizcle ambreta; la Nota de Corazón es raíz de lirio; la Nota de Fondo es maderas blancas.</p>
					<a href="/lang/es">Es</a><a href="/lang/it">Ti</a>
					<div id="pyramid">
						<h4><span class="inline-block px-3 py-1 uppercase tracking-wider">Notas de Salida </span></h4>
						<div class="pyramid-level-container">
							<a href="https://www.fragrantica.es/notas/Ambreta-107.html"><span class="pyramid-note-label mt-1.5">almizcle ambreta</span></a>
						</div>
						<h4><span class="inline-block px-3 py-1 uppercase tracking-wider">Corazón </span></h4>
						<div class="pyramid-level-container">
							<a href="https://www.fragrantica.es/notas/Raiz-101.html"><span class="pyramid-note-label mt-1.5">raíz de lirio</span></a>
						</div>
						<h4><span class="inline-block px-3 py-1 uppercase tracking-wider">Base </span></h4>
						<div class="pyramid-level-container">
							<a href="https://www.fragrantica.es/notas/Maderas-315.html"><span class="pyramid-note-label mt-1.5">maderas blancas</span></a>
						</div>
						<button>Votar por ingredientes</button>
					</div>
				</body>
			</html>
		`

		const fragrance = parseFragranticaHtml(html, 'https://www.fragrantica.es/perfume/Zara/White-Soho-57107.html')

		expect(fragrance.pyramid).toEqual({
			top: ['almizcle ambreta'],
			middle: ['raíz de lirio'],
			base: ['maderas blancas'],
		})
	})

	it('filters language and designer links from perfume pyramid notes', () => {
		const html = `
			<html>
				<body>
					<h1>Y Eau de Parfum Yves Saint Laurent para Hombres</h1>
					<meta name="description" content="Notas de Salida son manzana, jengibre y bergamota; Notas de Corazón son salvia, bayas de enebro y geranio; Notas de Fondo son Amberwood, haba tonka, cedro, vetiver e incienso de olíbano (franquincienso).">
					<p>Acordes principales fresco especiado aromático amaderado cítrico Buscar por acordes</p>
					<section>
						<h2>Pirámide del perfume</h2>
						<h3>Notas de Salida</h3>
						<a>manzana</a><a>jengibre</a><a>bergamota</a>
						<h3>Corazón</h3>
						<a>Llaszlo (Fragrantica.com)</a><a>FragNoAh! (Fragrantica.com)</a><a>Skittleriddle (Fragrantica.com)</a>
						<h3>Base</h3>
						<a>Amberwood</a><a>haba tonka</a><a>cedro</a><a>vetiver</a>
						<a>Čestina</a><a>Ελληνικά</a><a>Монгол</a><a>Русский</a><a>Claire Liégent</a><a>Dominique Ropion</a>
					</section>
				</body>
			</html>
		`

		const fragrance = parseFragranticaHtml(html, 'https://www.fragrantica.es/perfume/Yves-Saint-Laurent/Y-Eau-de-Parfum-50757.html')

		expect(fragrance.accords.map(accord => accord.label)).toEqual([
			'fresco especiado',
			'aromático',
			'amaderado',
			'cítrico',
		])
		expect(fragrance.pyramid).toEqual({
			top: ['manzana', 'jengibre', 'bergamota'],
			middle: ['salvia', 'bayas de enebro', 'geranio'],
			base: ['Amberwood', 'haba tonka', 'cedro', 'vetiver', 'incienso de olíbano (franquincienso)'],
		})
	})

	it('falls back to the flat "Notas de fragancia" widget when there is no Salida/Corazón/Base pyramid', () => {
		const html = `
			<html>
				<body>
					<h1>Bogoss Blue Temptation Zara para Hombres</h1>
					<section>
						<h2>Composición de la fragancia</h2>
						<div class="notes-heading">
							<h3>Notas de fragancia</h3>
							<button>Mostrar votos</button>
							<button>Ocultar etiquetas</button>
						</div>
						<a>Agua de coco</a><a>piña</a><a>bergamota</a>
						<button>Votar por ingredientes</button>
					</section>
				</body>
			</html>
		`

		const fragrance = parseFragranticaHtml(html, 'https://www.fragrantica.es/perfume/Zara/Bogoss-Blue-Temptation-136622.html')

		expect(fragrance.pyramid).toEqual({ top: [], middle: [], base: [] })
		expect(fragrance.notes).toEqual(['Agua de coco', 'piña', 'bergamota'])
	})
})
