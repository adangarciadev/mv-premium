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
	getCurrentPageNumber: vi.fn(() => 1),
	formatCacheAge: vi.fn(() => 'hace 2 min'),
	getCachedSingleAge: vi.fn<() => number | null>(() => null),
	getCachedSingleSummary: vi.fn(() => null as ThreadSummary | null),
	setCachedSingleSummary: vi.fn(),
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

vi.mock('@/features/thread-summarizer/logic/extract-posts', () => ({
	getCurrentPageNumber: mocks.getCurrentPageNumber,
}))

vi.mock('@/features/thread-summarizer/logic/summary-cache', () => ({
	formatCacheAge: mocks.formatCacheAge,
	getCachedSingleAge: mocks.getCachedSingleAge,
	getCachedSingleSummary: mocks.getCachedSingleSummary,
	setCachedSingleSummary: mocks.setCachedSingleSummary,
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
		viewModel,
		cachedLabel,
		onClose,
	}: {
		isLoading: boolean
		viewModel: { title: string } | null
		cachedLabel: string | null
		onClose: () => void
	}) => (
		<div role="dialog" aria-label="Resumen del hilo">
			<span data-testid="thread-summary-loading">{isLoading ? 'loading' : 'idle'}</span>
			<span data-testid="thread-summary-title">{viewModel?.title ?? ''}</span>
			<span data-testid="thread-summary-cache">{cachedLabel ?? ''}</span>
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

	it('ignores duplicate trigger events while an AI request is pending', async () => {
		const firstRequest = createDeferred<ThreadSummary>()
		mocks.summarizeCurrentThread.mockReturnValueOnce(firstRequest.promise)

		initMobileLiteThreadSummary()

		await act(async () => {
			dispatchSummaryRequest()
			dispatchSummaryRequest()
		})

		expect(mocks.summarizeCurrentThread).toHaveBeenCalledOnce()
		await waitFor(() => expect(screen.getByTestId('thread-summary-loading')).toHaveTextContent('loading'))

		await act(async () => {
			firstRequest.resolve(BASE_SUMMARY)
			await firstRequest.promise
		})

		await waitFor(() => expect(screen.getByTestId('thread-summary-loading')).toHaveTextContent('idle'))
		expect(mocks.setCachedSingleSummary).toHaveBeenCalledWith(1, BASE_SUMMARY)

		const secondRequest = createDeferred<ThreadSummary>()
		mocks.summarizeCurrentThread.mockReturnValueOnce(secondRequest.promise)

		await act(async () => {
			dispatchSummaryRequest()
		})

		expect(mocks.summarizeCurrentThread).toHaveBeenCalledTimes(2)

		await act(async () => {
			secondRequest.resolve({ ...BASE_SUMMARY, title: 'Segundo resumen' })
			await secondRequest.promise
		})

		await waitFor(() => expect(screen.getByTestId('thread-summary-title')).toHaveTextContent('Segundo resumen'))
	})

	it('serves cached summaries without starting an AI request', async () => {
		mocks.getCachedSingleSummary.mockReturnValue(BASE_SUMMARY)
		mocks.getCachedSingleAge.mockReturnValue(120_000)

		initMobileLiteThreadSummary()

		await act(async () => {
			dispatchSummaryRequest()
		})

		expect(mocks.summarizeCurrentThread).not.toHaveBeenCalled()
		expect(mocks.formatCacheAge).toHaveBeenCalledWith(120_000)
		await waitFor(() => expect(screen.getByTestId('thread-summary-title')).toHaveTextContent('Hilo de pruebas'))
		expect(screen.getByTestId('thread-summary-cache')).toHaveTextContent('hace 2 min')
	})
})
