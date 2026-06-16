import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ThreadSummary } from '@/features/thread-summarizer/logic/summarize'
import {
	THREAD_SUMMARY_TRIGGER_EVENT,
	initMobileLiteThreadSummary,
	teardownMobileLiteThreadSummary,
} from './thread-summary'

const mocks = vi.hoisted(() => ({
	getPlatformKind: vi.fn(() => 'firefox-android'),
	isFeatureEnabled: vi.fn(() => true),
	createContainer: vi.fn((options: { id?: string; parent: Element }) => {
		const container = document.createElement('div')
		if (options.id) container.id = options.id
		options.parent.appendChild(container)
		return container
	}),
	isFeatureMounted: vi.fn(() => false),
	mountFeatureWithBoundary: vi.fn(),
	unmountFeature: vi.fn(),
	summarizeCurrentThread: vi.fn<() => Promise<ThreadSummary>>(),
	summarizeMultiplePages: vi.fn(),
	analyzeUserInThread: vi.fn(),
	analyzeUserMultiplePages: vi.fn(),
	getCurrentPageNumber: vi.fn(() => 1),
	getActiveUserFilter: vi.fn<() => string | null>(() => null),
	getTotalPages: vi.fn(() => 1),
	getMultiPageLimit: vi.fn(() => 10),
	formatCacheAge: vi.fn(() => 'hace 2 min'),
	getCachedSingleAge: vi.fn<() => number | null>(() => null),
	getCachedSingleSummary: vi.fn(() => null as ThreadSummary | null),
	setCachedSingleSummary: vi.fn(),
	getCachedMultiSummary: vi.fn(() => null),
	setCachedMultiSummary: vi.fn(),
	getCachedMultiAge: vi.fn<() => number | null>(() => null),
	getCachedUserAnalysis: vi.fn(() => null),
	setCachedUserAnalysis: vi.fn(),
	getCachedUserAnalysisAge: vi.fn<() => number | null>(() => null),
	getCachedUserAnalysisMulti: vi.fn(() => null),
	setCachedUserAnalysisMulti: vi.fn(),
	getCachedUserAnalysisMultiAge: vi.fn<() => number | null>(() => null),
	loggerDebug: vi.fn(),
	loggerError: vi.fn(),
	ensureSummarySheetChromeStyles: vi.fn(),
	setSummarySheetOpen: vi.fn(),
	teardownSummarySheetChrome: vi.fn(),
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

vi.mock('@/lib/content-modules/utils/react-helpers', () => ({
	createContainer: mocks.createContainer,
	isFeatureMounted: mocks.isFeatureMounted,
	mountFeatureWithBoundary: mocks.mountFeatureWithBoundary,
	unmountFeature: mocks.unmountFeature,
}))

vi.mock('@/lib/logger', () => ({
	logger: {
		debug: mocks.loggerDebug,
		error: mocks.loggerError,
	},
}))

vi.mock('@/components/shadow-wrapper', () => ({
	ShadowWrapper: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock('@/features/thread-summarizer/logic/summarize', () => ({
	summarizeCurrentThread: mocks.summarizeCurrentThread,
}))

vi.mock('@/features/thread-summarizer/logic/summarize-multi-page', () => ({
	summarizeMultiplePages: mocks.summarizeMultiplePages,
}))

vi.mock('@/features/thread-summarizer/logic/analyze-user', () => ({
	analyzeUserInThread: mocks.analyzeUserInThread,
	analyzeUserMultiplePages: mocks.analyzeUserMultiplePages,
}))

vi.mock('@/features/thread-summarizer/logic/extract-posts', () => ({
	getCurrentPageNumber: mocks.getCurrentPageNumber,
	getActiveUserFilter: mocks.getActiveUserFilter,
}))

vi.mock('@/features/thread-summarizer/logic/fetch-pages', () => ({
	getTotalPages: mocks.getTotalPages,
	getMultiPageLimit: mocks.getMultiPageLimit,
}))

vi.mock('@/features/thread-summarizer/logic/summary-cache', () => ({
	formatCacheAge: mocks.formatCacheAge,
	getCachedSingleAge: mocks.getCachedSingleAge,
	getCachedSingleSummary: mocks.getCachedSingleSummary,
	setCachedSingleSummary: mocks.setCachedSingleSummary,
	getCachedMultiSummary: mocks.getCachedMultiSummary,
	setCachedMultiSummary: mocks.setCachedMultiSummary,
	getCachedMultiAge: mocks.getCachedMultiAge,
	getCachedUserAnalysis: mocks.getCachedUserAnalysis,
	setCachedUserAnalysis: mocks.setCachedUserAnalysis,
	getCachedUserAnalysisAge: mocks.getCachedUserAnalysisAge,
	getCachedUserAnalysisMulti: mocks.getCachedUserAnalysisMulti,
	setCachedUserAnalysisMulti: mocks.setCachedUserAnalysisMulti,
	getCachedUserAnalysisMultiAge: mocks.getCachedUserAnalysisMultiAge,
}))

vi.mock('./summary-sheet-chrome', () => ({
	ensureSummarySheetChromeStyles: mocks.ensureSummarySheetChromeStyles,
	setSummarySheetOpen: mocks.setSummarySheetOpen,
	teardownSummarySheetChrome: mocks.teardownSummarySheetChrome,
}))

vi.mock('../components/mobile-lite-panel', () => ({
	MOBILE_LITE_PANEL_OPEN_EVENT: 'mvp-mobile-lite-panel:open',
}))

vi.mock('../components/thread-summary-sheet', () => ({
	ThreadSummarySheet: ({
		isLoading,
		summaryVm,
		cachedLabel,
		rangePicker,
		onClose,
	}: {
		isLoading: boolean
		summaryVm: { title: string } | null
		cachedLabel: string | null
		rangePicker: { onGenerate: () => void } | null
		onClose: () => void
	}) => (
		<div role="dialog" aria-label="Resumen del hilo">
			<span data-testid="thread-summary-loading">{isLoading ? 'loading' : 'idle'}</span>
			<span data-testid="thread-summary-title">{summaryVm?.title ?? ''}</span>
			<span data-testid="thread-summary-cache">{cachedLabel ?? ''}</span>
			<span data-testid="thread-summary-phase">{rangePicker ? 'range' : 'result'}</span>
			{rangePicker && (
				<button type="button" data-testid="thread-summary-generate" onClick={rangePicker.onGenerate}>
					Generar
				</button>
			)}
			<button type="button" onClick={onClose}>
				Cerrar
			</button>
		</div>
	),
}))

const BASE_SUMMARY: ThreadSummary = {
	topic: 'Tema del hilo',
	keyPoints: ['Primer punto'],
	participants: [{ name: 'UserA', contribution: 'Aporta contexto' }],
	status: 'Debate activo',
	title: 'Hilo de pruebas',
	postsAnalyzed: 12,
	uniqueAuthors: 4,
	pageNumber: 1,
}

function createDeferred<T>() {
	let resolve!: (value: T) => void
	let reject!: (reason?: unknown) => void
	const promise = new Promise<T>((promiseResolve, promiseReject) => {
		resolve = promiseResolve
		reject = promiseReject
	})
	return { promise, resolve, reject }
}

function dispatchSummaryRequest() {
	window.dispatchEvent(new CustomEvent(THREAD_SUMMARY_TRIGGER_EVENT))
}

describe('Mobile Lite thread summary', () => {
	let mountedRoot: ReturnType<typeof render> | null = null

	beforeEach(() => {
		vi.clearAllMocks()
		mocks.getPlatformKind.mockReturnValue('firefox-android')
		mocks.isFeatureEnabled.mockReturnValue(true)
		mocks.isFeatureMounted.mockReturnValue(false)
		mocks.getCurrentPageNumber.mockReturnValue(1)
		mocks.getCachedSingleSummary.mockReturnValue(null)
		mocks.getCachedSingleAge.mockReturnValue(null)
		mocks.formatCacheAge.mockReturnValue('hace 2 min')
		mocks.summarizeCurrentThread.mockResolvedValue(BASE_SUMMARY)
		mocks.mountFeatureWithBoundary.mockImplementation((_featureId: string, _container: Element, element: ReactElement) => {
			mountedRoot = render(element)
		})
		document.body.innerHTML = '<div id="thread-companion"><div class="more-actions"></div></div>'
	})

	afterEach(() => {
		teardownMobileLiteThreadSummary()
		mountedRoot?.unmount()
		mountedRoot = null
		cleanup()
	})

	it('opens the page picker instead of summarising immediately', async () => {
		initMobileLiteThreadSummary()

		await act(async () => {
			dispatchSummaryRequest()
		})

		// The trigger only opens the chooser — nothing is generated yet.
		await waitFor(() => expect(screen.getByTestId('thread-summary-phase')).toHaveTextContent('range'))
		expect(mocks.summarizeCurrentThread).not.toHaveBeenCalled()
	})

	it('summarises the current page and ignores duplicate generate clicks while pending', async () => {
		const firstRequest = createDeferred<ThreadSummary>()
		mocks.summarizeCurrentThread.mockReturnValueOnce(firstRequest.promise)

		initMobileLiteThreadSummary()
		await act(async () => {
			dispatchSummaryRequest()
		})
		await waitFor(() => expect(screen.getByTestId('thread-summary-generate')).toBeInTheDocument())

		// Default range = current page → "Generar" runs the single-page summariser.
		await act(async () => {
			screen.getByTestId('thread-summary-generate').click()
			screen.getByTestId('thread-summary-generate').click()
		})

		expect(mocks.summarizeCurrentThread).toHaveBeenCalledOnce()

		await act(async () => {
			firstRequest.resolve(BASE_SUMMARY)
			await firstRequest.promise
		})

		await waitFor(() => expect(screen.getByTestId('thread-summary-title')).toHaveTextContent('Hilo de pruebas'))
		expect(mocks.setCachedSingleSummary).toHaveBeenCalledWith(1, BASE_SUMMARY)
	})

	it('serves a cached current-page summary without an AI request', async () => {
		mocks.getCachedSingleSummary.mockReturnValue(BASE_SUMMARY)
		mocks.getCachedSingleAge.mockReturnValue(120_000)

		initMobileLiteThreadSummary()
		await act(async () => {
			dispatchSummaryRequest()
		})
		await waitFor(() => expect(screen.getByTestId('thread-summary-generate')).toBeInTheDocument())

		await act(async () => {
			screen.getByTestId('thread-summary-generate').click()
		})

		expect(mocks.summarizeCurrentThread).not.toHaveBeenCalled()
		expect(mocks.formatCacheAge).toHaveBeenCalledWith(120_000)
		await waitFor(() => expect(screen.getByTestId('thread-summary-title')).toHaveTextContent('Hilo de pruebas'))
		expect(screen.getByTestId('thread-summary-cache')).toHaveTextContent('hace 2 min')
	})
})
