/**
 * Multi-Page Summary Modal Component
 *
 * Allows the user to select a page range and shows
 * a multi-page thread summary with progress feedback.
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import Loader2 from 'lucide-react/dist/esm/icons/loader-2'
import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle'
import Bot from 'lucide-react/dist/esm/icons/bot'
import AlertCircle from 'lucide-react/dist/esm/icons/alert-circle'
import Layers from 'lucide-react/dist/esm/icons/layers'
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right'
import History from 'lucide-react/dist/esm/icons/history'
import UserSearch from 'lucide-react/dist/esm/icons/user-search'
import { ShadowWrapper } from '@/components/shadow-wrapper'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { sendMessage } from '@/lib/messaging'
import { summarizeMultiplePages, type MultiPageSummary } from '../logic/summarize-multi-page'
import { analyzeUserMultiplePages, type UserAnalysis } from '../logic/analyze-user'
import { getActiveUserFilter } from '../logic/extract-posts'
import {
	MAX_MULTI_PAGES_GEMINI,
	MAX_MULTI_PAGES_GROQ,
	getProviderMultiPageLimit,
	getTotalPages,
	getCurrentPage,
	type MultiPageProgress,
} from '../logic/fetch-pages'
import {
	getCachedMultiSummary, setCachedMultiSummary, getCachedMultiAge,
	getCachedUserAnalysisMulti, setCachedUserAnalysisMulti, getCachedUserAnalysisMultiAge,
	formatCacheAge,
} from '../logic/summary-cache'
import { getLastModelUsed } from '@/services/ai/gemini-service'
import { useAIModelLabel } from '@/hooks/use-ai-model-label'
import { buildUserAnalysisBBCode, buildMultiSummaryBBCode } from '../logic/build-copy-bbcode'
import { useSettingsStore } from '@/store/settings-store'
import { toast } from '@/lib/lazy-toast'
import {
	formatDuration,
	useSummaryTimer,
	useSummaryClipboard,
	SummaryModalHeader,
	SummaryErrorState,
	SummaryResultSection,
	UserAnalysisResultSection,
	SummaryMetadata,
	SummaryModalFooter,
	APIConsoleLinks,
	MetadataIcons,
} from './shared/summary-modal-shared'

// =============================================================================
// TYPES
// =============================================================================

type ModalStep = 'config' | 'loading' | 'result'

interface MultiPageSummaryModalProps {
	isOpen: boolean
	onClose: () => void
}

// =============================================================================
// COMPONENT
// =============================================================================

export function MultiPageSummaryModal({ isOpen, onClose }: MultiPageSummaryModalProps) {
	const activeUserFilter = useMemo(() => getActiveUserFilter(), [])
	const isUserAnalysisMode = !!activeUserFilter

	const [step, setStep] = useState<ModalStep>('config')
	const [summary, setSummary] = useState<MultiPageSummary | null>(null)
	const [userAnalysis, setUserAnalysis] = useState<UserAnalysis | null>(null)
	const [progress, setProgress] = useState<MultiPageProgress | null>(null)
	const [actualModel, setActualModel] = useState<string | null>(null)
	const [startedAtMs, setStartedAtMs] = useState<number | null>(null)
	const { modelLabel, isModelFallback, configuredModel, isProviderFallback, providerFallbackMessage } =
		useAIModelLabel(actualModel)
	const aiProvider = useSettingsStore(s => s.aiProvider)
	const hasProviderKey = useSettingsStore(s =>
		s.aiProvider === 'gemini' ? s.geminiApiKey.trim().length > 0 : s.groqApiKey.trim().length > 0
	)
	const providerMaxPages = getProviderMultiPageLimit(aiProvider)

	const { elapsedSeconds, setElapsedSeconds } = useSummaryTimer(step === 'loading', startedAtMs)

	// Page range state
	const totalPages = getTotalPages()
	const currentPage = getCurrentPage()
	const [fromPage, setFromPage] = useState(1)
	const [toPage, setToPage] = useState(Math.min(totalPages, 5))

	// Reset state when modal opens
	useEffect(() => {
		if (isOpen) {
			setStep('config')
			setSummary(null)
			setUserAnalysis(null)
			setProgress(null)
			setActualModel(null)
			setStartedAtMs(null)
			setElapsedSeconds(0)
			setFromPage(1)
			setToPage(Math.min(totalPages, 5))
		}
	}, [isOpen, totalPages, providerMaxPages, setElapsedSeconds])

	const pageCount = Math.max(1, toPage - fromPage + 1)
	const isValidRange = fromPage >= 1 && toPage >= fromPage && toPage <= totalPages && pageCount <= providerMaxPages

	const buildCopyText = useCallback(() => {
		if (isUserAnalysisMode && userAnalysis) {
			return buildUserAnalysisBBCode(userAnalysis, 'multi')
		}
		if (!summary) return null
		return buildMultiSummaryBBCode(summary)
	}, [isUserAnalysisMode, userAnalysis, summary])

	const { copied, handleCopy } = useSummaryClipboard(buildCopyText, {
		successMessage: isUserAnalysisMode ? 'Análisis copiado al portapapeles' : 'Resumen copiado al portapapeles',
	})

	const handleStartSummary = useCallback(async () => {
		if (!isValidRange || pageCount < 2) return

		const startedAt = Date.now()
		setStep('loading')
		setProgress(null)
		setActualModel(null)
		setStartedAtMs(startedAt)
		setElapsedSeconds(0)

		if (isUserAnalysisMode && activeUserFilter) {
			const result = await analyzeUserMultiplePages(activeUserFilter, fromPage, toPage, p => setProgress(p))
			const usedModel = getLastModelUsed()
			const timed: UserAnalysis = { ...result, generationMs: Date.now() - startedAt, modelUsed: usedModel || undefined }
			if (!timed.error) setCachedUserAnalysisMulti(activeUserFilter, fromPage, toPage, timed)
			setActualModel(usedModel)
			setUserAnalysis(timed)
		} else {
			const result = await summarizeMultiplePages(fromPage, toPage, p => setProgress(p))
			const usedModel = getLastModelUsed()
			const timedResult: MultiPageSummary = {
				...result,
				generationMs: Date.now() - startedAt,
				modelUsed: usedModel || undefined,
			}
			if (!timedResult.error) setCachedMultiSummary(fromPage, toPage, timedResult)
			setActualModel(usedModel)
			setSummary(timedResult)
		}

		setStep('result')
		setStartedAtMs(null)
	}, [isUserAnalysisMode, activeUserFilter, fromPage, toPage, isValidRange, pageCount, setElapsedSeconds])

	const handleLoadCached = useCallback(() => {
		if (isUserAnalysisMode && activeUserFilter) {
			const cached = getCachedUserAnalysisMulti(activeUserFilter, fromPage, toPage)
			if (cached) {
				setActualModel(cached.modelUsed || null)
				setUserAnalysis(cached)
				setStep('result')
				setStartedAtMs(null)
				setElapsedSeconds(0)
			}
		} else {
			const cached = getCachedMultiSummary(fromPage, toPage)
			if (cached) {
				setActualModel(cached.modelUsed || null)
				setSummary(cached)
				setStep('result')
				setStartedAtMs(null)
				setElapsedSeconds(0)
			}
		}
	}, [isUserAnalysisMode, activeUserFilter, fromPage, toPage, setElapsedSeconds])

	useEffect(() => {
		if (isOpen && !hasProviderKey) {
			toast.error(
				`No hay API Key configurada para ${aiProvider === 'gemini' ? 'Gemini' : 'Groq'}. Cerrando resumen multi-página.`
			)
			onClose()
		}
	}, [isOpen, hasProviderKey, aiProvider, onClose])

	const openAISettings = () => {
		sendMessage('openOptionsPage', 'settings?tab=ai')
		onClose()
	}

	const handleBackdropClick = (e: React.MouseEvent) => {
		if (e.target === e.currentTarget) {
			if (step !== 'loading') onClose()
		}
	}

	const currentError = isUserAnalysisMode ? userAnalysis?.error : summary?.error
	const isAINotConfigured = currentError?.includes('IA no configurada')
	const badgeTitle = providerFallbackMessage
		? providerFallbackMessage
		: isModelFallback
			? `Modelo configurado: ${configuredModel}`
			: undefined

	const hasResult = isUserAnalysisMode ? !!userAnalysis && !userAnalysis.error : !!summary && !summary.error
	const cachedAge = isUserAnalysisMode && activeUserFilter
		? getCachedUserAnalysisMultiAge(activeUserFilter, fromPage, toPage)
		: getCachedMultiAge(fromPage, toPage)

	const modalTitle = isUserAnalysisMode && activeUserFilter
		? `Análisis de ${activeUserFilter}`
		: 'Resumen Multi-Página'
	const modalIcon = isUserAnalysisMode
		? <UserSearch className="w-5 h-5 text-primary" />
		: <Layers className="w-5 h-5 text-primary" />

	if (!isOpen) return null

	return (
		<ShadowWrapper className="fixed inset-0 z-[9999]">
			<div
				className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
				onClick={handleBackdropClick}
			>
				<div className="bg-card border border-border rounded-lg shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
					<SummaryModalHeader
						icon={modalIcon}
						title={modalTitle}
						modelLabel={modelLabel}
						isModelFallback={isModelFallback}
						isProviderFallback={isProviderFallback}
						badgeTitle={badgeTitle}
						onClose={step !== 'loading' ? onClose : undefined}
					/>

					<div className="flex-1 overflow-y-auto p-4">
						{providerFallbackMessage && (
							<div className="mb-3 flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-md p-2.5">
								<AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
								<p className="text-xs text-amber-700 dark:text-amber-400">{providerFallbackMessage}</p>
							</div>
						)}
						{step === 'config' && (
							<ConfigStep
								fromPage={fromPage}
								toPage={toPage}
								totalPages={totalPages}
								currentPage={currentPage}
								pageCount={pageCount}
								isValidRange={isValidRange}
								aiProvider={aiProvider}
								providerMaxPages={providerMaxPages}
								isUserAnalysisMode={isUserAnalysisMode}
								activeUserFilter={activeUserFilter}
								onFromPageChange={setFromPage}
								onToPageChange={setToPage}
								onStart={handleStartSummary}
								onLoadCached={handleLoadCached}
								cachedAge={cachedAge}
							/>
						)}

						{step === 'loading' && (
							<LoadingStep
								progress={progress}
								pageCount={pageCount}
								elapsedSeconds={elapsedSeconds}
								isUserAnalysisMode={isUserAnalysisMode}
								activeUserFilter={activeUserFilter}
							/>
						)}

						{step === 'result' && currentError && (
							<SummaryErrorState
								error={currentError}
								isAINotConfigured={!!isAINotConfigured}
								onOpenSettings={openAISettings}
								extraAction={
									<Button size="sm" variant="outline" onClick={() => setStep('config')} className="mt-3 gap-2">
										<ChevronRight className="w-4 h-4 rotate-180" />
										Volver a intentar
									</Button>
								}
							/>
						)}

						{step === 'result' && isUserAnalysisMode && userAnalysis && !userAnalysis.error && (
							<>
								<UserAnalysisResultSection
									analysis={userAnalysis}
									beforeContent={
										userAnalysis.fetchErrors && userAnalysis.fetchErrors.length > 0 ? (
											<div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-md p-2.5">
												<AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
												<p className="text-xs text-amber-600 dark:text-amber-400">
													No se pudieron descargar las páginas: {userAnalysis.fetchErrors.join(', ')}
												</p>
											</div>
										) : undefined
									}
								/>
								<SummaryMetadata
									items={[
										{ icon: <Layers className="w-3.5 h-3.5" />, label: `Págs. ${userAnalysis.pageRange}` },
										{ icon: MetadataIcons.page, label: `${userAnalysis.pagesAnalyzed} páginas` },
										{ icon: MetadataIcons.posts, label: `${userAnalysis.postsAnalyzed} posts` },
										...(userAnalysis.modelUsed ? [{ icon: MetadataIcons.model, label: userAnalysis.modelUsed }] : []),
										...(typeof userAnalysis.generationMs === 'number'
											? [{ icon: MetadataIcons.time, label: formatDuration(userAnalysis.generationMs) }]
											: []),
									]}
								/>
								<APIConsoleLinks />
							</>
						)}

						{step === 'result' && !isUserAnalysisMode && summary && !summary.error && (
							<>
								<SummaryResultSection
									topic={summary.topic}
									keyPoints={summary.keyPoints}
									participants={summary.participants}
									status={summary.status}
									beforeContent={
										summary.fetchErrors.length > 0 ? (
											<div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-md p-2.5">
												<AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
												<p className="text-xs text-amber-600 dark:text-amber-400">
													No se pudieron descargar las páginas: {summary.fetchErrors.join(', ')}
												</p>
											</div>
										) : undefined
									}
								/>
								<SummaryMetadata
									items={[
										{ icon: <Layers className="w-3.5 h-3.5" />, label: `Págs. ${summary.pageRange}` },
										{ icon: MetadataIcons.page, label: `${summary.pagesAnalyzed} páginas` },
										{ icon: MetadataIcons.posts, label: `${summary.totalPostsAnalyzed} posts` },
										{ icon: MetadataIcons.authors, label: `${summary.totalUniqueAuthors} autores` },
										...(summary.modelUsed ? [{ icon: MetadataIcons.model, label: summary.modelUsed }] : []),
										...(typeof summary.generationMs === 'number'
											? [{ icon: MetadataIcons.time, label: formatDuration(summary.generationMs) }]
											: []),
									]}
								/>
								<APIConsoleLinks />
							</>
						)}
					</div>

					{step === 'result' && hasResult && (
						<SummaryModalFooter
							onRegenerate={handleStartSummary}
							onCopy={handleCopy}
							onClose={onClose}
							copied={copied}
							extraButtons={
								<Button
									variant="ghost"
									size="sm"
									onClick={() => setStep('config')}
									className="gap-1.5 text-muted-foreground"
								>
									<ChevronRight className="w-3.5 h-3.5 rotate-180" />
									Otro rango
								</Button>
							}
						/>
					)}
				</div>
			</div>
		</ShadowWrapper>
	)
}

// =============================================================================
// SUB-COMPONENTS (unique to multi-page)
// =============================================================================

function ConfigStep({
	fromPage,
	toPage,
	totalPages,
	currentPage,
	pageCount,
	isValidRange,
	aiProvider,
	providerMaxPages,
	isUserAnalysisMode,
	activeUserFilter,
	onFromPageChange,
	onToPageChange,
	onStart,
	onLoadCached,
	cachedAge,
}: {
	fromPage: number
	toPage: number
	totalPages: number
	currentPage: number
	pageCount: number
	isValidRange: boolean
	aiProvider: 'gemini' | 'groq'
	providerMaxPages: number
	isUserAnalysisMode: boolean
	activeUserFilter: string | null
	onFromPageChange: (v: number) => void
	onToPageChange: (v: number) => void
	onStart: () => void
	onLoadCached: () => void
	cachedAge: number | null
}) {
	const isGroq = aiProvider === 'groq'

	const presets = [
		{ label: 'Todo el hilo', from: 1, to: totalPages, show: totalPages <= providerMaxPages },
		{ label: 'Primeras 5', from: 1, to: Math.min(5, totalPages), show: totalPages >= 3 },
		{ label: 'Primeras 10', from: 1, to: Math.min(10, totalPages), show: totalPages >= 6 && providerMaxPages >= 10 },
		{ label: 'Primeras 20', from: 1, to: Math.min(20, totalPages), show: totalPages >= 15 && providerMaxPages >= 20 },
		{ label: 'Últimas 5', from: Math.max(1, totalPages - 4), to: totalPages, show: totalPages >= 3 },
		{
			label: 'Últimas 10',
			from: Math.max(1, totalPages - 9),
			to: totalPages,
			show: totalPages >= 6 && providerMaxPages >= 10,
		},
		{
			label: 'Últimas 20',
			from: Math.max(1, totalPages - 19),
			to: totalPages,
			show: totalPages >= 15 && providerMaxPages >= 20,
		},
		{
			label: `Desde actual (${currentPage})`,
			from: currentPage,
			to: Math.min(currentPage + providerMaxPages - 1, totalPages),
			show: currentPage > 1 && currentPage < totalPages,
		},
	].filter(p => p.show)

	return (
		<div className="space-y-5">
			{/* Info */}
			<div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
				<div className="flex items-start gap-2">
					{isUserAnalysisMode
						? <UserSearch className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
						: <Bot className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
					}
					<div>
						<p className="text-sm font-medium text-foreground">
							{isUserAnalysisMode && activeUserFilter
								? `Análisis de ${activeUserFilter} — múltiples páginas`
								: 'Resumen de múltiples páginas'}
						</p>
						<p className="text-xs text-muted-foreground mt-1">
							Selecciona el rango de páginas a {isUserAnalysisMode ? 'analizar' : 'resumir'}. El hilo tiene{' '}
							<strong>{totalPages}</strong> {totalPages === 1 ? 'página' : 'páginas'}.
							{totalPages > providerMaxPages && (
								<span className="text-amber-500"> (máximo {providerMaxPages} páginas con el proveedor actual)</span>
							)}
						</p>
					</div>
				</div>
			</div>

			{/* Provider limits */}
			<div
				className={cn(
					'rounded-lg p-3 border',
					isGroq ? 'bg-amber-500/10 border-amber-500/30' : 'bg-blue-500/10 border-blue-500/30'
				)}
			>
				<div className="flex items-start gap-2">
					<AlertTriangle className={cn('w-4 h-4 mt-0.5 flex-shrink-0', isGroq ? 'text-amber-500' : 'text-blue-500')} />
					<div className="space-y-1">
						<p className="text-sm font-medium text-foreground">
							Límites por proveedor (actual: {isGroq ? 'Groq / Kimi' : 'Gemini'})
						</p>
							<p className="text-xs text-muted-foreground">
								Groq / Kimi: <strong>2-{MAX_MULTI_PAGES_GROQ}</strong> páginas por límites de tokens por minuto
								(TPM) y rate limit.
							</p>
							<p className="text-xs text-muted-foreground">
								Nota: <strong>{MAX_MULTI_PAGES_GROQ}</strong> páginas es el tope del selector, pero en hilos densos (muchos
								posts, citas largas o spoilers) Groq puede dar rate limit antes.
							</p>
							<p className="text-xs text-muted-foreground">
								Gemini: <strong>2-{MAX_MULTI_PAGES_GEMINI}</strong> páginas por resumen, mejor tolerancia en hilos largos.
							</p>
						<p className="text-xs text-muted-foreground">
							Si necesitas más rango, cambia el proveedor desde Ajustes de IA.
						</p>
					</div>
				</div>
			</div>

			{/* Quick presets */}
			{presets.length > 0 && (
				<div className="space-y-2">
					<label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Rangos rápidos</label>
					<div className="flex flex-wrap gap-1.5">
						{presets.map(preset => (
							<button
								key={preset.label}
								onClick={() => {
									onFromPageChange(preset.from)
									onToPageChange(preset.to)
								}}
								className={cn(
									'px-2.5 py-1.5 text-xs rounded-md border transition-colors',
									fromPage === preset.from && toPage === preset.to
										? 'bg-primary text-primary-foreground border-primary'
										: 'bg-muted/30 text-foreground border-border hover:bg-muted/60'
								)}
							>
								{preset.label}
							</button>
						))}
					</div>
				</div>
			)}

			{/* Manual range */}
			<div className="space-y-2">
				<label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Rango personalizado</label>
				<div className="flex items-center gap-3">
					<div className="flex-1 space-y-1">
						<label className="text-xs text-muted-foreground">Desde</label>
						<input
							type="number"
							min={1}
							max={totalPages}
							value={fromPage}
							onChange={e => {
								const val = Math.max(1, Math.min(totalPages, parseInt(e.target.value) || 1))
								onFromPageChange(val)
							}}
							className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
						/>
					</div>
					<div className="text-muted-foreground mt-5">—</div>
					<div className="flex-1 space-y-1">
						<label className="text-xs text-muted-foreground">Hasta</label>
						<input
							type="number"
							min={1}
							max={totalPages}
							value={toPage}
							onChange={e => {
								const val = Math.max(1, Math.min(totalPages, parseInt(e.target.value) || 1))
								onToPageChange(val)
							}}
							className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
						/>
					</div>
				</div>
			</div>

			{/* Warnings */}
			{isValidRange && pageCount > 10 && (
				<div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-md p-2.5">
					<AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
					<p className="text-xs text-amber-600 dark:text-amber-400">
						{pageCount} páginas es un rango amplio. El resumen puede tardar más y perder detalle fino.
					</p>
				</div>
			)}

			{pageCount === 1 && isValidRange && (
				<div className="flex items-start gap-2 bg-primary/5 border border-primary/20 rounded-md p-2.5">
					{isUserAnalysisMode
						? <UserSearch className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
						: <Bot className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
					}
					<p className="text-xs text-muted-foreground">
						{isUserAnalysisMode
							? <>Para analizar una sola página, usa el botón <strong>Analizar</strong> del hilo. Este modo está pensado para rangos de 2 o más páginas.</>
							: <>Para resumir una sola página, usa el botón <strong>Resumir</strong> del hilo. Este modo está pensado para rangos de 2 o más páginas.</>
						}
					</p>
				</div>
			)}

			{!isValidRange && (
				<div className="flex items-start gap-2 bg-destructive/10 border border-destructive/30 rounded-md p-2.5">
					<AlertCircle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
					<p className="text-xs text-destructive">
						Rango no válido. Asegúrate de que las páginas están entre 1 y {totalPages}
						{pageCount > providerMaxPages ? ` y no superas ${providerMaxPages} páginas con ${isGroq ? 'Groq / Kimi' : 'Gemini'}.` : '.'}
					</p>
				</div>
			)}

			{/* Cached result */}
			{cachedAge !== null && pageCount >= 2 && (
				<button
					onClick={onLoadCached}
					className="w-full flex items-center gap-2.5 p-2.5 rounded-md border border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors text-left"
				>
					<History className="w-4 h-4 text-primary flex-shrink-0" />
					<div className="flex-1 min-w-0">
						<p className="text-sm font-medium text-foreground">
							{isUserAnalysisMode ? 'Ver último análisis' : 'Ver último resumen'}
						</p>
						<p className="text-xs text-muted-foreground">
							Generado {formatCacheAge(cachedAge)} · Págs. {fromPage}-{toPage}
						</p>
					</div>
					<ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
				</button>
			)}

			{/* Start button */}
			<Button onClick={onStart} disabled={!isValidRange || pageCount < 2} className="w-full gap-2" size="lg">
				{isUserAnalysisMode
					? <UserSearch className="w-4 h-4" />
					: <Layers className="w-4 h-4" />
				}
				{cachedAge !== null && pageCount >= 2
					? (isUserAnalysisMode ? 'Regenerar análisis' : 'Regenerar resumen')
					: (isUserAnalysisMode
						? `Analizar ${pageCount} ${pageCount === 1 ? 'página' : 'páginas'}`
						: `Resumir ${pageCount} ${pageCount === 1 ? 'página' : 'páginas'}`
					)
				}
			</Button>
		</div>
	)
}

function LoadingStep({
	progress,
	pageCount,
	elapsedSeconds,
	isUserAnalysisMode,
	activeUserFilter,
}: {
	progress: MultiPageProgress | null
	pageCount: number
	elapsedSeconds: number
	isUserAnalysisMode: boolean
	activeUserFilter: string | null
}) {
	const getProgressText = () => {
		if (!progress) return 'Preparando...'
		if (progress.message) return progress.message

		if (progress.phase === 'fetching') {
			return `Descargando páginas... (${progress.current}/${progress.total})`
		}

		if (progress.phase === 'summarizing') {
			if (progress.totalBatches && progress.totalBatches > 1) {
				if (progress.batch === progress.totalBatches) {
					return 'Generando resumen global...'
				}
				return `Analizando bloque ${progress.batch}/${progress.totalBatches}...`
			}
			return 'Analizando con IA...'
		}

		return 'Procesando...'
	}

	const getPercentage = () => {
		if (!progress) return 0

		if (progress.phase === 'fetching') {
			return Math.round((progress.current / progress.total) * 40)
		}

		if (progress.phase === 'summarizing') {
			return 40 + Math.round((progress.current / progress.total) * 60)
		}

		return 0
	}

	const percentage = getPercentage()

	return (
		<div className="flex flex-col items-center justify-center py-12 gap-5">
			<div className="relative">
				<Loader2 className="w-12 h-12 animate-spin text-primary" />
				<div className="absolute inset-0 flex items-center justify-center">
					<span className="text-[10px] font-bold text-primary">{percentage}%</span>
				</div>
			</div>

			<div className="text-center space-y-2">
				<p className="text-sm font-medium text-foreground">{getProgressText()}</p>
				<p className="text-xs text-muted-foreground">
						{isUserAnalysisMode && activeUserFilter
							? `Analizando a ${activeUserFilter} · Esto puede tardar`
							: `Resumiendo ${pageCount} páginas · Esto puede tardar`
						}
					</p>
				<p className="text-xs text-muted-foreground/80">Tiempo transcurrido: {elapsedSeconds}s</p>
			</div>

			{/* Progress bar */}
			<div className="w-full max-w-xs">
				<div className="h-1.5 bg-muted rounded-full overflow-hidden">
					<div
						className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
						style={{ width: `${percentage}%` }}
					/>
				</div>
			</div>
		</div>
	)
}
