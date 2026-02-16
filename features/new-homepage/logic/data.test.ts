import { describe, expect, it, beforeEach } from 'vitest'
import { getUsername, parseFavoritesList, parseNewsList, parseThreadTable } from './data'

function parse(html: string): Document {
	return new DOMParser().parseFromString(html, 'text/html')
}

describe('new-homepage data parsers', () => {
	beforeEach(() => {
		document.body.innerHTML = ''
	})

	it('extracts username from the user-data block', () => {
		document.body.innerHTML = '<div id="user-data"><span>adan</span></div>'
		expect(getUsername()).toBe('adan')
	})

	it('parses thread table rows from #temas', () => {
		const doc = parse(`
			<table id="temas">
				<tr>
					<td><a href="/foro/cine">cine</a></td>
					<td>
						<a class="hb" href="/foro/cine/hilo-123">Hilo de prueba</a>
						<a class="unseen-num" href="/foro/cine/hilo-123/2#55">4</a>
						<span class="thread-live"></span>
					</td>
					<td><span class="num reply">1.2k</span></td>
					<td></td>
					<td></td>
					<td>2m</td>
				</tr>
			</table>
		`)

		const threads = parseThreadTable(doc)
		expect(threads).toHaveLength(1)
		expect(threads[0]).toMatchObject({
			forumSlug: 'cine',
			title: 'Hilo de prueba',
			url: '/foro/cine/hilo-123',
			urlSinceLastVisit: '/foro/cine/hilo-123/2#55',
			responsesSinceLastVisit: 4,
			totalResponses: '1.2k',
			lastActivityAt: '2m',
			hasLive: true,
		})
	})

	it('parses favorites fly list items', () => {
		const doc = parse(`
			<ul>
				<li>
					<a class="fid" href="/foro/mediavida"></a>
					<a class="hb" href="/foro/mediavida/hilo-1" title="Tema favorito">Tema favorito</a>
					<a class="unseen-num" href="/foro/mediavida/hilo-1/2#99">7</a>
				</li>
			</ul>
		`)

		const favorites = parseFavoritesList(doc)
		expect(favorites).toHaveLength(1)
		expect(favorites[0]).toMatchObject({
			forumSlug: 'mediavida',
			title: 'Tema favorito',
			url: '/foro/mediavida/hilo-1',
			urlSinceLastVisit: '/foro/mediavida/hilo-1/2#99',
			responsesSinceLastVisit: 7,
		})
	})

	it('parses news cards from homepage blocks', () => {
		const doc = parse(`
			<div class="block">
				<div class="news-item">
					<a class="news-media" href="/foro/tv/noticia-1"> 255 </a>
					<img data-src="https://img.test/news.jpg" />
					<div class="news-info"><h4>Noticia de prueba</h4></div>
					<div class="news-meta">autor - 1h</div>
				</div>
			</div>
		`)

		const news = parseNewsList(doc)
		expect(news).toHaveLength(1)
		expect(news[0]).toMatchObject({
			forumSlug: 'tv',
			title: 'Noticia de prueba',
			url: '/foro/tv/noticia-1',
			thumbnail: 'https://img.test/news.jpg',
			totalResponses: '255',
			createdAt: '1h',
		})
	})
})
