import { describe, expect, it, vi } from 'vitest'

vi.mock('../generated/color-map', () => ({
	MV_THEME_COLOR_RULES: [
		{
			s: '.box',
			p: 'border',
			v: '1px solid #1c2022',
			c: ['#1c2022'],
		},
		{
			s: '.grad',
			p: 'background',
			v: 'linear-gradient(to bottom, #1c2022 0, #171a1c 100%)',
			c: ['#1c2022', '#171a1c'],
		},
		{
			s: '.text',
			p: 'color',
			v: '#f0f0f0',
			c: ['#f0f0f0'],
		},
		{
			s: '.thread-live',
			p: 'color',
			v: '#bb4949',
			c: ['#bb4949'],
		},
		{
			s: '.hover-target:hover,.non-hover-surface',
			p: 'background-color',
			v: '#393e41',
			c: ['#393e41'],
		},
		{
			s: '#header,#usermenu > li.avw',
			p: 'background',
			v: '#323639',
			c: ['#323639'],
		},
		{
			s: '.forums .icon-col,.infobg,table.mv th,table.mv tfoot td',
			p: 'background-color',
			v: '#272d30',
			c: ['#272d30'],
		},
		{
			s: '.post.info',
			p: 'border-color',
			v: '#21262b',
			c: ['#21262b'],
		},
	],
}))

import { generateMvThemeCSS } from './css-override-generator'
import { shiftColor } from './color-shift'

describe('generateMvThemeCSS', () => {
	it('returns empty css when there are no overrides', () => {
		expect(generateMvThemeCSS({})).toBe('')
	})

	it('replaces colors inside shorthand and gradient values', () => {
		const newPageBg = '#2a2f33'
		const css = generateMvThemeCSS({ 'page-bg': newPageBg })
		const shiftedShade = shiftColor('#171a1c', '#1c2022', newPageBg)

		expect(css).toContain(`.box{border:1px solid ${newPageBg} !important}`)
		expect(css).toContain(
			`.grad{background:linear-gradient(to bottom, ${newPageBg} 0, ${shiftedShade} 100%) !important}`
		)
	})

	it('applies inferred matching for non-explicit neutral shades', () => {
		const newTextPrimary = '#c9d1dc'
		const css = generateMvThemeCSS({ 'text-primary': newTextPrimary })
		const expected = shiftColor('#f0f0f0', '#ecedef', newTextPrimary)

		expect(css).toContain(`.text{color:${expected} !important}`)
	})

	it('emits baseline mapped rules for unchanged groups when customization is active', () => {
		const css = generateMvThemeCSS({ accent: '#3aa0ff' })

		expect(css).toContain('.box{border:1px solid #1c2022 !important}')
	})

	it('keeps thread-live color locked to red', () => {
		const css = generateMvThemeCSS({ accent: '#3aa0ff', 'container-bg': '#2d3640' })

		expect(css).toContain('.thread-live{color:#bb4949 !important;border:1px solid #bb4949 !important}')
		expect(css).toContain('.thread-live:hover{background-color:#bb4949 !important;border-color:#bb4949 !important;color:#39464c !important}')
		expect(css).not.toContain('.thread-live{color:#3aa0ff !important}')
	})

	it('adds topbar fallback rules even if accent group was not changed', () => {
		const css = generateMvThemeCSS({ 'container-bg': '#2d3640' })

		expect(css).toContain('#foros_spy #tab_spy')
		expect(css).toContain('color:#fc8f22 !important')
		expect(css).toContain('#header{border-bottom-color:')
		expect(css).toContain('#topbar #logo')
		expect(css).toContain('#topbar #usermenu > li')
		expect(css).toContain('#sections > li > a, #usermenu > li > a')
		expect(css).not.toContain('#sections{background:')
	})

	it('adds brand menu fallback rules to keep divider and second header aligned', () => {
		const css = generateMvThemeCSS({
			'page-bg': '#1f2a35',
			'surface-bg': '#2b3948',
			accent: '#3aa0ff',
			'text-primary': '#d7e3ef',
		})

		expect(css).toContain('#brand-menu{background:')
		expect(css).toContain('border-top-color:')
		expect(css).toContain('#brand-menu li.active a,#brand-menu li.active a span.m{color:')
	})

	it('adds hero menu fallback rules so profile hero updates with theme changes', () => {
		const css = generateMvThemeCSS({ 'page-bg': '#213447' })

		expect(css).toContain('.hero-menu{background-color:')
		expect(css).toContain('.hero-menu li span.lbl{color:')
		expect(css).toContain('.hero-menu li.active a,.hero-menu li.active a span.m{color:')
	})

	it('applies hover group only on hover selectors', () => {
		const css = generateMvThemeCSS({ 'hover-bg': '#2a4ea0' })

		expect(css).toContain('.hover-target:hover{background-color:')
		expect(css).not.toContain('.non-hover-surface{background-color:#2a4ea0 !important}')
	})

	it('updates header and usermenu name background through surface group', () => {
		const newSurface = '#2f4f7f'
		const css = generateMvThemeCSS({ 'surface-bg': newSurface })
		const shifted = shiftColor('#323639', '#272d30', newSurface)

		expect(css).toContain(`#header,#usermenu > li.avw{background:${shifted} !important}`)
	})

	it('updates table header, forum icon column and infobg through surface group', () => {
		const newSurface = '#314b6e'
		const css = generateMvThemeCSS({ 'surface-bg': newSurface })

		expect(css).toContain(
			`.forums .icon-col,.infobg,table.mv th,table.mv tfoot td{background-color:${newSurface} !important}`
		)
	})

	it('applies a distinct moderated-post info background when surface changes', () => {
		const newSurface = '#314b6e'
		const css = generateMvThemeCSS({ 'surface-bg': newSurface })
		const expectedBg = shiftColor('#272a2b', '#272d30', newSurface)
		const expectedBorder = shiftColor('#21262b', '#272d30', newSurface)

		expect(css).toContain(
			`.post.info{background-color:${expectedBg} !important;border-color:${expectedBorder} !important}`
		)
	})

	it('keeps unread old and unread new badges separated', () => {
		const css = generateMvThemeCSS({
			'unread-old': '#64748b',
			'unread-new': '#f59e0b',
		})

		expect(css).toContain('.unread-num{background-color:#64748b !important')
		expect(css).toContain('.unseen-num{background-color:#f59e0b !important')
		expect(css).toContain('.unseen-num:hover{background-color:#1c2022 !important;color:#f59e0b !important}')
	})

	it('adds readability fallbacks for key controls in light themes', () => {
		const css = generateMvThemeCSS({
			'page-bg': '#f4f7fb',
			'button-bg': '#dbe5f2',
			accent: '#9a5200',
			'unread-new': '#9a5200',
		})

		expect(css).toContain('#header .bubble,#usermenu .bubble{background-color:#9a5200 !important')
		expect(css).toContain('.btn-primary, .btn-primary:hover')
		expect(css).toContain('.btn.btn-inverse, .btn.btn-inverse:hover')
		expect(css).toContain('.hero-controls .btn-primary')
		expect(css).toContain('.hero-controls .btn.btn-inverse')
		expect(css).toContain('#post-editor .editor-controls button')
	})

	it('adds fallback rules for post controls active and checked states', () => {
		const css = generateMvThemeCSS({
			accent: '#9a5200',
			'text-primary': '#1d2b3a',
			'text-secondary': '#32495f',
			'hover-bg': '#d8e4f3',
			'page-bg': '#f4f7fb',
		})

		expect(css).toContain('.post-controls .buttons .post-btn.active')
		expect(css).toContain('.post-controls .buttons .post-btn.bookmark.active')
		expect(css).toContain('.post-controls .post-btn.checked')
		expect(css).toContain('.post-controls .post-btn.btnmola i')
		expect(css).toContain('.post-controls .buttons .post-btn.active,.post-controls .buttons .post-btn.bookmark.active,.post-controls .buttons .post-btn.masmola.active,.post-controls .post-btn.checked,.post-controls .post-n.checked{color:#9a5200 !important}')
	})

	it('adds explicit postit fallback rules so sticky thread info follows theme colors', () => {
		const css = generateMvThemeCSS({
			accent: '#9a5200',
			'page-bg': '#f4f7fb',
			'surface-bg': '#dbe5f2',
			'border-3d': '#9aa9bb',
			'text-primary': '#1d2b3a',
			'text-muted': '#50647a',
		})

		expect(css).toContain('#postit{background-color:')
		expect(css).toContain('#postit .toggle{color:')
		expect(css).toContain('#postit .post-contents')
		expect(css).toContain('#postit a:not(.spoiler){color:#9a5200 !important}')
	})

	it('adds thread metrics fallback rules for map classes and time counters', () => {
		const css = generateMvThemeCSS({
			'text-primary': '#f0f6ff',
			'text-secondary': '#d4e1ee',
			'text-muted': '#8fa1b3',
			'unread-new': '#d0872f',
		})

		expect(css).toContain('body .num,body .age,body .m_date,body .thread-count .num{color:#8fa1b3 !important}')
		expect(css).toContain('body .thread-count .num.reply{color:#d4e1ee !important}')
		expect(css).toContain('body .cmap-h{color:#d4e1ee !important}')
		expect(css).toContain('body .hmap-h{color:#d0872f !important}')
		expect(css).toContain('body .unread .last-av .m_date{color:#f0f6ff !important}')
	})

	it('keeps accent color for post controls in dark themes', () => {
		const css = generateMvThemeCSS({
			accent: '#e8a030',
			link: '#4c8fcc',
			'page-bg': '#1c2022',
			'text-primary': '#ecedef',
			'text-secondary': '#b3c3d3',
			'hover-bg': '#393e41',
		})

		expect(css).toContain('.post-controls .buttons .post-btn.active,.post-controls .buttons .post-btn.bookmark.active,.post-controls .buttons .post-btn.masmola.active,.post-controls .post-btn.checked,.post-controls .post-n.checked{color:#e8a030 !important}')
	})
})
