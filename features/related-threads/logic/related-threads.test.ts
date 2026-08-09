import { beforeEach, describe, expect, it } from 'vitest'
import { DOM_MARKERS, EARLY_STYLE_IDS, RUNTIME_CACHE_KEYS } from '@/constants'
import { applyRelatedThreadsDisplay, initRelatedThreadsDisplay, teardownRelatedThreadsDisplay } from './related-threads'
import { useSettingsStore } from '@/store/settings-store'

function renderRelatedThreads(): void {
	document.body.innerHTML = `
		<div id="unrelated">
			<table id="tablatemas"><tbody id="temas"><tr><td>Listado normal</td></tr></tbody></table>
		</div>
		<div class="block hilos-relacionados">
			<h2 class="rel-head"><span>Hilos relacionados</span></h2>
			<div class="wpx"><table><tbody><tr><td>Hilo relacionado</td></tr></tbody></table></div>
		</div>
	`
}

function getElements() {
	const block = document.querySelector<HTMLElement>('.hilos-relacionados')!
	const heading = block.querySelector<HTMLElement>('.rel-head')!
	const content = block.querySelector<HTMLElement>('.wpx')!
	return { block, heading, content }
}

describe('related threads display', () => {
	beforeEach(() => {
		document.head.innerHTML = ''
		document.body.innerHTML = ''
		useSettingsStore.setState({ relatedThreadsDisplay: 'hidden' })
		localStorage.clear()
	})

	it('takes over from early injection and updates its synchronous cache', () => {
		renderRelatedThreads()
		const earlyStyle = document.createElement('style')
		earlyStyle.id = EARLY_STYLE_IDS.RELATED_THREADS
		document.head.append(earlyStyle)

		applyRelatedThreadsDisplay('collapsible')

		expect(document.getElementById(EARLY_STYLE_IDS.RELATED_THREADS)).toBeNull()
		expect(localStorage.getItem(RUNTIME_CACHE_KEYS.RELATED_THREADS_DISPLAY)).toBe('collapsible')
	})

	it('hides only the related-thread block', () => {
		renderRelatedThreads()
		const { block } = getElements()

		applyRelatedThreadsDisplay('hidden')

		expect(block.hidden).toBe(true)
		expect(document.querySelector<HTMLElement>('#unrelated')?.hidden).toBe(false)
	})

	it('stays hidden when Mediavida forces blocks to display', () => {
		renderRelatedThreads()
		const siteStyle = document.createElement('style')
		siteStyle.textContent = '.block { display: block !important; }'
		document.head.append(siteStyle)
		const { block } = getElements()

		applyRelatedThreadsDisplay('hidden')

		expect(getComputedStyle(block).display).toBe('none')
	})

	it('creates a closed accessible disclosure', () => {
		renderRelatedThreads()
		const { content } = getElements()

		applyRelatedThreadsDisplay('collapsible')

		const button = document.querySelector<HTMLButtonElement>(`.${DOM_MARKERS.CLASSES.RELATED_THREADS_TOGGLE}`)
		expect(button).not.toBeNull()
		expect(button).toHaveAttribute('aria-expanded', 'false')
		expect(button).toHaveAttribute('aria-controls', content.id)
		expect(button).toHaveAttribute('aria-label', 'Mostrar u ocultar hilos relacionados')
		expect(content.hidden).toBe(true)
	})

	it('opens and closes the related-thread content', () => {
		renderRelatedThreads()
		const { content } = getElements()
		applyRelatedThreadsDisplay('collapsible')
		const button = document.querySelector<HTMLButtonElement>(`.${DOM_MARKERS.CLASSES.RELATED_THREADS_TOGGLE}`)!

		button.click()
		expect(button).toHaveAttribute('aria-expanded', 'true')
		expect(content.hidden).toBe(false)

		button.click()
		expect(button).toHaveAttribute('aria-expanded', 'false')
		expect(content.hidden).toBe(true)
	})

	it('does not duplicate controls or click handlers on repeated initialization', () => {
		renderRelatedThreads()
		const { content } = getElements()

		applyRelatedThreadsDisplay('collapsible')
		applyRelatedThreadsDisplay('collapsible')

		const buttons = document.querySelectorAll<HTMLButtonElement>(`.${DOM_MARKERS.CLASSES.RELATED_THREADS_TOGGLE}`)
		expect(buttons).toHaveLength(1)
		buttons[0].click()
		expect(content.hidden).toBe(false)
	})

	it('preserves the expanded state when the injection runs again', () => {
		renderRelatedThreads()
		const { content } = getElements()
		applyRelatedThreadsDisplay('collapsible')
		const button = document.querySelector<HTMLButtonElement>(`.${DOM_MARKERS.CLASSES.RELATED_THREADS_TOGGLE}`)!
		button.click()

		applyRelatedThreadsDisplay('collapsible')

		expect(document.querySelector(`.${DOM_MARKERS.CLASSES.RELATED_THREADS_TOGGLE}`)).toBe(button)
		expect(button).toHaveAttribute('aria-expanded', 'true')
		expect(content.hidden).toBe(false)
	})

	it('restores the original markup in original mode', () => {
		renderRelatedThreads()
		const { block, heading, content } = getElements()
		const originalHeading = heading.innerHTML

		applyRelatedThreadsDisplay('collapsible')
		applyRelatedThreadsDisplay('original')

		expect(block.hidden).toBe(false)
		expect(content.hidden).toBe(false)
		expect(heading.innerHTML).toBe(originalHeading)
		expect(content).not.toHaveAttribute('id')
		expect(document.getElementById(DOM_MARKERS.IDS.RELATED_THREADS_STYLES)).toBeNull()
	})

	it('preserves a native content id during teardown', () => {
		renderRelatedThreads()
		const { content } = getElements()
		content.id = 'native-related-content'

		applyRelatedThreadsDisplay('collapsible')
		teardownRelatedThreadsDisplay()

		expect(content.id).toBe('native-related-content')
	})

	it('assigns unique control ids when multiple related-thread blocks exist', () => {
		renderRelatedThreads()
		document.body.insertAdjacentHTML(
			'beforeend',
			'<div class="hilos-relacionados"><h2 class="rel-head">Más relacionados</h2><div class="wpx"></div></div>'
		)

		applyRelatedThreadsDisplay('collapsible')

		const controlledIds = Array.from(
			document.querySelectorAll<HTMLButtonElement>(`.${DOM_MARKERS.CLASSES.RELATED_THREADS_TOGGLE}`),
			button => button.getAttribute('aria-controls')
		)
		expect(new Set(controlledIds).size).toBe(2)
	})

	it('leaves malformed collapsible markup unchanged', () => {
		document.body.innerHTML = '<div class="hilos-relacionados"><h2 class="rel-head">Hilos relacionados</h2></div>'
		const block = document.querySelector<HTMLElement>('.hilos-relacionados')!
		const original = block.innerHTML

		applyRelatedThreadsDisplay('collapsible')

		expect(block.hidden).toBe(false)
		expect(block.innerHTML).toBe(original)
	})

	it('is a safe no-op when the related-thread block is absent', () => {
		document.body.innerHTML = '<table id="tablatemas"><tbody id="temas"></tbody></table>'

		expect(() => applyRelatedThreadsDisplay('hidden')).not.toThrow()
		expect(() => applyRelatedThreadsDisplay('collapsible')).not.toThrow()
		expect(() => teardownRelatedThreadsDisplay()).not.toThrow()
	})

	it('reads the persisted mode during initialization', () => {
		renderRelatedThreads()
		useSettingsStore.setState({ relatedThreadsDisplay: 'original' })

		initRelatedThreadsDisplay()

		expect(getElements().block.hidden).toBe(false)
		expect(document.querySelector(`.${DOM_MARKERS.CLASSES.RELATED_THREADS_TOGGLE}`)).toBeNull()
	})

	it('teardown allows a clean reinitialization', () => {
		renderRelatedThreads()

		applyRelatedThreadsDisplay('collapsible')
		teardownRelatedThreadsDisplay()
		applyRelatedThreadsDisplay('collapsible')

		expect(document.querySelectorAll(`.${DOM_MARKERS.CLASSES.RELATED_THREADS_TOGGLE}`)).toHaveLength(1)
		expect(getElements().content.hidden).toBe(true)
	})
})
