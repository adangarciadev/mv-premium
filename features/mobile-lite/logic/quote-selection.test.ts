import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
	getPlatformKind: vi.fn(() => 'firefox-android'),
	isFeatureEnabled: vi.fn(() => true),
	getSettings: vi.fn(() => Promise.resolve({ quoteSelectionEnabled: true })),
}))

vi.mock('@/lib/platform', () => ({
	getPlatformKind: mocks.getPlatformKind,
}))

vi.mock('@/lib/feature-flags', () => ({
	FeatureFlag: {
		MobileLite: 'mobile-lite',
	},
	isFeatureEnabled: mocks.isFeatureEnabled,
}))

vi.mock('@/store/settings-store', () => ({
	getSettings: mocks.getSettings,
}))

import {
	initMobileLiteQuoteSelection,
	syncMobileLiteQuoteSelection,
	teardownMobileLiteQuoteSelection,
} from './quote-selection'

const STYLE_ID = 'mvp-mobile-lite-quote-selection-styles'

// Native MV markup confirmed on device: direct child of <body>, absolutely
// positioned in document coordinates just above the selection.
function appendQuoteButton(): HTMLElement {
	const button = document.createElement('button')
	button.type = 'button'
	button.className = 'btn btn-primary quote'
	button.textContent = 'citar'
	button.style.position = 'absolute'
	button.style.top = '4835.29px'
	button.style.left = '674.3px'
	document.body.appendChild(button)
	return button
}

function mockSelectionRect(rect: Partial<DOMRect> | null): void {
	const selection = rect
		? ({
				isCollapsed: false,
				rangeCount: 1,
				getRangeAt: () => ({
					getBoundingClientRect: () => ({ top: 0, right: 0, bottom: 0, left: 0, width: 0, height: 20, ...rect }),
				}),
			} as unknown as Selection)
		: ({ isCollapsed: true, rangeCount: 0 } as unknown as Selection)

	vi.spyOn(window, 'getSelection').mockReturnValue(selection)
}

function flushObservers(): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, 0))
}

// Default selection: bottom=300 → top = 300 + 24px offset = 324px.
// jsdom has no layout (offsetWidth = 0) so the 64px width fallback applies:
// left = 100 + 50/2 - 64/2 = 93px.
const DEFAULT_RECT = { bottom: 300, left: 100, width: 50 }

describe('Mobile Lite quote selection', () => {
	beforeEach(() => {
		vi.useRealTimers()
		vi.clearAllMocks()
		mocks.getPlatformKind.mockReturnValue('firefox-android')
		mocks.isFeatureEnabled.mockReturnValue(true)
		mocks.getSettings.mockResolvedValue({ quoteSelectionEnabled: true })
		document.body.innerHTML = ''
		document.head.innerHTML = ''
		mockSelectionRect(DEFAULT_RECT)
	})

	afterEach(() => {
		teardownMobileLiteQuoteSelection()
		vi.restoreAllMocks()
	})

	it('moves the native quote button below the selection when Mediavida shows it', async () => {
		initMobileLiteQuoteSelection()

		const button = appendQuoteButton()
		await flushObservers()

		expect(button.style.top).toBe('324px')
		expect(button.style.left).toBe('93px')
	})

	it('repositions the button already present at init', async () => {
		const button = appendQuoteButton()

		initMobileLiteQuoteSelection()
		await flushObservers()

		expect(button.style.top).toBe('324px')
	})

	it('keeps the button below the selection when Mediavida rewrites its position', async () => {
		initMobileLiteQuoteSelection()
		const button = appendQuoteButton()
		await flushObservers()

		// MV repositions for a new selection (always above it)
		mockSelectionRect({ bottom: 500, left: 100, width: 50 })
		button.style.top = '460px'
		button.style.left = '120px'
		await flushObservers()

		expect(button.style.top).toBe('524px')
		expect(button.style.left).toBe('93px')
	})

	it('clamps the button to the viewport right edge', async () => {
		initMobileLiteQuoteSelection()

		mockSelectionRect({ bottom: 300, left: 1000, width: 20 })
		appendQuoteButton()
		await flushObservers()

		const button = document.querySelector<HTMLElement>('body > button.quote')
		// innerWidth (1024) - fallback width (64) - edge margin (8)
		expect(button?.style.left).toBe('952px')
	})

	it('follows the selection handles via selectionchange when Mediavida does not reposition', async () => {
		vi.useFakeTimers()
		initMobileLiteQuoteSelection()
		const button = appendQuoteButton()
		await vi.advanceTimersByTimeAsync(0)
		expect(button.style.top).toBe('324px')

		mockSelectionRect({ bottom: 500, left: 100, width: 50 })
		document.dispatchEvent(new Event('selectionchange'))
		await vi.advanceTimersByTimeAsync(100)

		expect(button.style.top).toBe('524px')
	})

	it('leaves the button alone when the selection is collapsed', async () => {
		initMobileLiteQuoteSelection()

		mockSelectionRect(null)
		const button = appendQuoteButton()
		await flushObservers()

		expect(button.style.top).toBe('4835.29px')
		expect(button.style.left).toBe('674.3px')
	})

	it('injects the touch-target and selection-highlight styles when enabled', async () => {
		initMobileLiteQuoteSelection()
		await flushObservers()

		const style = document.getElementById(STYLE_ID)
		expect(style).toBeTruthy()
		expect(style?.textContent).toContain('min-height: 44px')
		expect(style?.textContent).toContain('::selection')
	})

	it('does nothing when the setting is disabled', async () => {
		mocks.getSettings.mockResolvedValue({ quoteSelectionEnabled: false })
		initMobileLiteQuoteSelection()

		const button = appendQuoteButton()
		await flushObservers()

		expect(button.style.top).toBe('4835.29px')
		expect(document.getElementById(STYLE_ID)).toBeNull()
	})

	it('does nothing outside Firefox Android', async () => {
		mocks.getPlatformKind.mockReturnValue('firefox-desktop')
		initMobileLiteQuoteSelection()

		const button = appendQuoteButton()
		await flushObservers()

		expect(button.style.top).toBe('4835.29px')
	})

	it('can be toggled at runtime from the panel via sync', async () => {
		initMobileLiteQuoteSelection()
		const button = appendQuoteButton()
		await flushObservers()
		expect(button.style.top).toBe('324px')

		await syncMobileLiteQuoteSelection(false)
		expect(document.getElementById(STYLE_ID)).toBeNull()

		// MV rewrites the position; with the toggle off we no longer interfere
		mockSelectionRect({ bottom: 500, left: 100, width: 50 })
		button.style.top = '460px'
		await flushObservers()
		expect(button.style.top).toBe('460px')

		await syncMobileLiteQuoteSelection(true)
		await flushObservers()
		expect(button.style.top).toBe('524px')
		expect(document.getElementById(STYLE_ID)).toBeTruthy()
	})

	it('stops repositioning after teardown', async () => {
		initMobileLiteQuoteSelection()
		const button = appendQuoteButton()
		await flushObservers()

		teardownMobileLiteQuoteSelection()

		mockSelectionRect({ bottom: 500, left: 100, width: 50 })
		button.style.top = '460px'
		await flushObservers()

		expect(button.style.top).toBe('460px')
		expect(document.getElementById(STYLE_ID)).toBeNull()
	})
})
