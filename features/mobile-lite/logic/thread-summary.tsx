/**
 * Mobile Lite — Thread AI Module
 *
 * Injects a thread-companion AI button that opens a bottom sheet with:
 *  - Page summary (single + multi-page), or
 *  - User analysis (single + multi-page) when the thread is filtered by ?u=user.
 * Reuses the desktop thread-summarizer engines; renders in the shared sheet.
 *
 * Gated on: context.isThreadPage (via registry.ts shouldRun)
 * Feature flag: MobileLite (enforced centrally by initMobileLite)
 */

import { useEffect, useRef, useState } from 'react'
import ScrollText from 'lucide-react/dist/esm/icons/scroll-text'
import UserSearch from 'lucide-react/dist/esm/icons/user-search'
import { ShadowWrapper } from '@/components/shadow-wrapper'
import { FeatureFlag, isFeatureEnabled } from '@/lib/feature-flags'
import { logger } from '@/lib/logger'
import { getPlatformKind } from '@/lib/platform'
import {
	createContainer,
	isFeatureMounted,
	mountFeatureWithBoundary,
	unmountFeature,
} from '@/lib/content-modules/utils/react-helpers'
import { summarizeCurrentThread } from '@/features/thread-summarizer/logic/summarize'
import { summarizeMultiplePages } from '@/features/thread-summarizer/logic/summarize-multi-page'
import { analyzeUserMultiplePages } from '@/features/thread-summarizer/logic/analyze-user'
import { getActiveUserFilter, getCurrentPageNumber } from '@/features/thread-summarizer/logic/extract-posts'
import { getMultiPageLimit, getTotalPages, type MultiPageProgress } from '@/features/thread-summarizer/logic/fetch-pages'
import {
	formatCacheAge,
	getCachedMultiAge,
	getCachedMultiSummary,
	getCachedSingleAge,
	getCachedSingleSummary,
	getCachedUserAnalysisMulti,
	getCachedUserAnalysisMultiAge,
	setCachedMultiSummary,
	setCachedSingleSummary,
	setCachedUserAnalysisMulti,
} from '@/features/thread-summarizer/logic/summary-cache'
import {
	summaryNeedsAiConfig,
	toMultiSummaryBBCode,
	toMultiSummaryViewModel,
	toThreadSummaryBBCode,
	toThreadSummaryViewModel,
	type ThreadSummaryViewModel,
} from './thread-summary-view-model'
import {
	toUserAnalysisBBCode,
	toUserAnalysisViewModel,
	userAnalysisNeedsAiConfig,
	type UserAnalysisViewModel,
} from './user-analysis-view-model'
import { getPremiumPillButtonCss } from './native-button-styles'
import {
	ensureSummarySheetChromeStyles,
	setSummarySheetOpen,
	teardownSummarySheetChrome,
} from './summary-sheet-chrome'
import { ThreadSummarySheet } from '../components/thread-summary-sheet'
import { MOBILE_LITE_PANEL_OPEN_EVENT } from '../components/mobile-lite-panel'

// =============================================================================
// CONSTANTS
// =============================================================================

/** Custom event fired by the Light-DOM button to trigger the React root. */
export const THREAD_SUMMARY_TRIGGER_EVENT = 'mvp-mobile-lite-thread-summary:trigger'

const FEATURE_ID = 'mobile-lite-thread-summary'
const CONTAINER_ID = 'mvp-mobile-lite-thread-summary-root'
const BUTTON_ID = 'mvp-mobile-lite-summarize-button'
const BUTTON_ATTR = 'data-mvp-mobile-lite-summarize-btn'
const STYLE_ID = 'mvp-mobile-lite-thread-summary-styles'

type AiMode = 'summary' | 'analysis'

let initialized = false

// =============================================================================
// GUARD / UTILS
// =============================================================================

function isMobileLiteThreadSummaryAllowed(): boolean {
	return getPlatformKind() === 'firefox-android' && isFeatureEnabled(FeatureFlag.MobileLite)
}

function getPageNumberSafe(): number {
	try {
		return getCurrentPageNumber()
	} catch {
		return 1
	}
}

function getTotalPagesSafe(): number {
	let total = 1
	try {
		total = Math.max(1, getTotalPages())
	} catch {
		total = 1
	}
	if (total > 1) return total

	// Mobile fallback: the desktop pagination selectors miss MV's mobile layout.
	// Scan links that point to a page of THIS thread (path /<base>/N or ?pagina=N)
	// and take the highest — scoping to the thread base avoids thread/post IDs.
	const base = window.location.pathname.replace(/\/\d+$/, '')
	document.querySelectorAll<HTMLAnchorElement>('a[href]').forEach(link => {
		const href = link.getAttribute('href') ?? ''
		let pageNum = 0

		const queryMatch = href.match(/[?&]pagina=(\d+)/)
		if (queryMatch) pageNum = Number.parseInt(queryMatch[1], 10)

		const baseIndex = href.indexOf(base)
		if (baseIndex !== -1) {
			const pathMatch = href.slice(baseIndex + base.length).match(/^\/(\d+)/)
			if (pathMatch) pageNum = Math.max(pageNum, Number.parseInt(pathMatch[1], 10))
		}

		if (Number.isFinite(pageNum) && pageNum > total) total = pageNum
	})

	// Last resort: the "current / total" label in MV's mobile bottom nav (e.g. "1/20").
	const navMatch = (document.getElementById('bottom-nav')?.textContent ?? '').match(/(\d+)\s*\/\s*(\d+)/)
	if (navMatch) {
		const parsed = Number.parseInt(navMatch[2], 10)
		if (Number.isFinite(parsed) && parsed > total) total = parsed
	}

	return total
}

function ageLabel(ageMs: number | null): string | null {
	return ageMs !== null ? formatCacheAge(ageMs) : null
}

function progressText(p: MultiPageProgress): string {
	return p.phase === 'summarizing'
		? `Resumiendo… (${p.current}/${p.total})`
		: `Cargando páginas… (${p.current}/${p.total})`
}

function errorThreadVm(message: string): ThreadSummaryViewModel {
	return {
		title: '',
		topic: '',
		keyPoints: [],
		participants: [],
		status: '',
		hasError: true,
		errorMessage: message,
		postsAnalyzed: 0,
		pageNumber: 1,
		metaLabel: '',
	}
}

function errorAnalysisVm(username: string, message: string): UserAnalysisViewModel {
	return {
		username,
		tagline: '',
		profile: '',
		topics: [],
		interactions: [],
		style: '',
		highlights: [],
		verdict: '',
		avatarUrl: undefined,
		hasError: true,
		errorMessage: message,
		metaLabel: '',
	}
}

// =============================================================================
// REACT ROOT COMPONENT
// =============================================================================

function ThreadAiReactRoot() {
	const [isOpen, setIsOpen] = useState(false)
	const [isLoading, setIsLoading] = useState(false)
	const [mode, setMode] = useState<AiMode>('summary')
	const [userFilter, setUserFilter] = useState<string | null>(null)
	const [summaryVm, setSummaryVm] = useState<ThreadSummaryViewModel | null>(null)
	const [analysisVm, setAnalysisVm] = useState<UserAnalysisViewModel | null>(null)
	const [bbcode, setBbcode] = useState<string | null>(null)
	const [cachedLabel, setCachedLabel] = useState<string | null>(null)
	const [canMultiPage, setCanMultiPage] = useState(false)
	const [phase, setPhase] = useState<'result' | 'range'>('result')
	const [fromPage, setFromPage] = useState(1)
	const [toPage, setToPage] = useState(1)
	const [totalPages, setTotalPages] = useState(1)
	const [isGeneratingMulti, setIsGeneratingMulti] = useState(false)
	const [progressLabel, setProgressLabel] = useState<string | null>(null)
	const busyRef = useRef(false)

	useEffect(() => {
		const handler = () => {
			if (busyRef.current) return

			const filter = getActiveUserFilter()
			const nextMode: AiMode = filter ? 'analysis' : 'summary'
			const pageNumber = getPageNumberSafe()
			const total = getTotalPagesSafe()

			setMode(nextMode)
			setUserFilter(filter)
			setProgressLabel(null)
			setTotalPages(total)
			setCanMultiPage(total > 1)
			setSummaryVm(null)
			setAnalysisVm(null)
			setBbcode(null)
			setCachedLabel(null)
			// Always let the user choose first: current page (the default) or a page
			// range. Nothing is generated until they confirm in the picker.
			setFromPage(pageNumber)
			setToPage(pageNumber)
			setIsLoading(false)
			setPhase('range')
			setIsOpen(true)
		}

		window.addEventListener(THREAD_SUMMARY_TRIGGER_EVENT, handler)
		return () => window.removeEventListener(THREAD_SUMMARY_TRIGGER_EVENT, handler)
	}, [])

	// Hide MV's fixed bottom nav while the sheet is open so it can't cover the footer.
	useEffect(() => {
		setSummarySheetOpen(isOpen)
		return () => setSummarySheetOpen(false)
	}, [isOpen])

	const handleConfigureAi = () => {
		setIsOpen(false)
		window.dispatchEvent(new CustomEvent(MOBILE_LITE_PANEL_OPEN_EVENT, { detail: { tab: 'settings' } }))
	}

	const handleExpand = () => {
		// Reopen the picker keeping the user's last selection ("Cambiar páginas").
		setTotalPages(getTotalPagesSafe())
		setProgressLabel(null)
		setPhase('range')
	}

	const handleGenerateMulti = async () => {
		if (busyRef.current) return
		busyRef.current = true
		setIsGeneratingMulti(true)
		setProgressLabel('Preparando…')
		const onProgress = (p: MultiPageProgress) => setProgressLabel(progressText(p))
		try {
			if (mode === 'summary') {
				// Current page only → use the loaded-DOM single summarizer (no refetch).
				if (fromPage === toPage && fromPage === getPageNumberSafe()) {
					const cached = getCachedSingleSummary(fromPage)
					const summary = cached ?? (await summarizeCurrentThread())
					if (!cached && !summary.error) setCachedSingleSummary(fromPage, summary)
					const vm = toThreadSummaryViewModel(summary)
					setSummaryVm(vm)
					setAnalysisVm(null)
					setBbcode(vm.hasError ? null : toThreadSummaryBBCode(vm))
					setCachedLabel(cached ? ageLabel(getCachedSingleAge(fromPage)) : null)
				} else {
					const cached = getCachedMultiSummary(fromPage, toPage)
					const result = cached ?? (await summarizeMultiplePages(fromPage, toPage, onProgress))
					if (!cached && !result.error) setCachedMultiSummary(fromPage, toPage, result)
					const vm = toMultiSummaryViewModel(result)
					setSummaryVm(vm)
					setAnalysisVm(null)
					setBbcode(vm.hasError ? null : toMultiSummaryBBCode(result))
					setCachedLabel(cached ? ageLabel(getCachedMultiAge(fromPage, toPage)) : null)
				}
			} else if (userFilter) {
				const cached = getCachedUserAnalysisMulti(userFilter, fromPage, toPage)
				const result = cached ?? (await analyzeUserMultiplePages(userFilter, fromPage, toPage, onProgress))
				if (!cached && !result.error) setCachedUserAnalysisMulti(userFilter, fromPage, toPage, result)
				const vm = toUserAnalysisViewModel(result)
				setAnalysisVm(vm)
				setSummaryVm(null)
				setBbcode(vm.hasError ? null : toUserAnalysisBBCode(result, 'multi'))
				setCachedLabel(cached ? ageLabel(getCachedUserAnalysisMultiAge(userFilter, fromPage, toPage)) : null)
			}
			setPhase('result')
		} catch (error) {
			logger.error('[MobileLite] ThreadAI: multi-page error', error)
			if (mode === 'summary') {
				setSummaryVm(errorThreadVm('Error inesperado al generar el resumen.'))
			} else {
				setAnalysisVm(errorAnalysisVm(userFilter ?? '', 'Error inesperado al generar el análisis.'))
			}
			setPhase('result')
		} finally {
			busyRef.current = false
			setIsGeneratingMulti(false)
			setProgressLabel(null)
		}
	}

	if (!isOpen) return null

	const isAnalysis = mode === 'analysis'
	const needsAiConfig =
		(summaryVm ? summaryNeedsAiConfig(summaryVm) : false) || (analysisVm ? userAnalysisNeedsAiConfig(analysisVm) : false)
	const hasResult = (summaryVm && !summaryVm.hasError) || (analysisVm && !analysisVm.hasError)
	const expandLabel = phase === 'result' && hasResult && canMultiPage ? 'Cambiar páginas' : null

	return (
		<ThreadSummarySheet
			icon={
				isAnalysis ? (
					<UserSearch className="h-5 w-5 shrink-0 text-[#f0a020]" aria-hidden="true" />
				) : (
					<ScrollText className="h-5 w-5 shrink-0 text-[#f0a020]" aria-hidden="true" />
				)
			}
			title={isAnalysis ? `Análisis de @${userFilter}` : summaryVm?.title || 'Resumen del hilo'}
			ariaLabel={isAnalysis ? 'Análisis de usuario' : 'Resumen del hilo'}
			loadingSubtitle={isAnalysis ? `Analizando a ${userFilter}` : 'Analizando los posts de la página'}
			isLoading={isLoading}
			summaryVm={summaryVm}
			analysisVm={analysisVm}
			cachedLabel={cachedLabel}
			bbcode={bbcode}
			onConfigureAi={needsAiConfig ? handleConfigureAi : undefined}
			expandLabel={expandLabel}
			onExpand={handleExpand}
			rangePicker={
				phase === 'range'
					? {
							title: isAnalysis ? 'Páginas a analizar' : 'Páginas a resumir',
							ctaLabel: isAnalysis ? 'Analizar' : 'Resumir',
							fromPage,
							toPage,
							totalPages,
							currentPage: getPageNumberSafe(),
							maxPages: getMultiPageLimit(),
							isGenerating: isGeneratingMulti,
							progressLabel,
							onChange: (from, to) => {
								setFromPage(from)
								setToPage(to)
							},
							onGenerate: handleGenerateMulti,
					  }
					: null
			}
			onClose={() => setIsOpen(false)}
		/>
	)
}

// =============================================================================
// LIGHT-DOM BUTTON (injected into MV's thread-companion area)
// =============================================================================

function injectSummarizeButton(): void {
	if (document.getElementById(BUTTON_ID)) return

	const companion = document.querySelector<HTMLElement>('#thread-companion, .thread-companion')
	if (!companion) return

	const actionsContainer = companion.querySelector<HTMLElement>('.more-actions, .actions, #more-actions')
	const insertTarget = actionsContainer ?? companion

	// Label morphs to "Analizar @user" when the thread is filtered by a user (?u=).
	const filter = getActiveUserFilter()
	const isAnalysis = Boolean(filter)

	const button = document.createElement('a')
	button.id = BUTTON_ID
	button.href = '#mvp-summarize'
	button.setAttribute(BUTTON_ATTR, 'true')
	button.setAttribute('aria-label', isAnalysis ? `Analizar a ${filter} con IA` : 'Resumir hilo con IA')
	button.className = 'btn'

	// Build content with DOM (not innerHTML) so a malicious ?u= can't inject HTML.
	const icon = document.createElement('i')
	icon.className = isAnalysis ? 'fa fa-user' : 'fa fa-magic'
	icon.setAttribute('aria-hidden', 'true')
	const label = document.createElement('span')
	label.textContent = isAnalysis ? `Analizar @${filter}` : 'Resumir'
	button.append(icon, label)

	button.addEventListener('click', event => {
		event.preventDefault()
		event.stopPropagation()
		window.dispatchEvent(new CustomEvent(THREAD_SUMMARY_TRIGGER_EVENT))
	})

	insertTarget.appendChild(button)
}

function removeSummarizeButton(): void {
	document.getElementById(BUTTON_ID)?.remove()
	document.querySelectorAll(`[${BUTTON_ATTR}="true"]`).forEach(el => el.remove())
}

function ensureButtonStyles(): void {
	if (document.getElementById(STYLE_ID)) return

	const style = document.createElement('style')
	style.id = STYLE_ID
	style.textContent = `
		${getPremiumPillButtonCss(`#${BUTTON_ID}.btn`)}
		#${BUTTON_ID}.btn {
			margin-left: 4px !important;
		}
		#${BUTTON_ID}.btn i {
			margin-right: 5px !important;
		}
	`
	document.head.appendChild(style)
}

// =============================================================================
// MODULE INIT / TEARDOWN
// =============================================================================

export function initMobileLiteThreadSummary(): void {
	if (!isMobileLiteThreadSummaryAllowed()) return
	if (initialized) return

	initialized = true

	if (!isFeatureMounted(FEATURE_ID)) {
		const container = createContainer({ id: CONTAINER_ID, parent: document.body })
		mountFeatureWithBoundary(
			FEATURE_ID,
			container,
			<ShadowWrapper>
				<ThreadAiReactRoot />
			</ShadowWrapper>,
			'Mobile Lite Thread AI'
		)
	}

	ensureButtonStyles()
	ensureSummarySheetChromeStyles()
	injectSummarizeButton()
}

export function teardownMobileLiteThreadSummary(): void {
	removeSummarizeButton()
	document.getElementById(STYLE_ID)?.remove()
	unmountFeature(FEATURE_ID)
	document.getElementById(CONTAINER_ID)?.remove()
	teardownSummarySheetChrome()
	initialized = false
}
