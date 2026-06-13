/**
 * Home Widgets - Stats cards, activity graph, and storage widget
 */
import { memo, useEffect, useRef, useState, lazy, Suspense } from 'react'
import Send from 'lucide-react/dist/esm/icons/send'
import MessageSquare from 'lucide-react/dist/esm/icons/message-square'
import Clock from 'lucide-react/dist/esm/icons/clock'
import History from 'lucide-react/dist/esm/icons/history'
import Database from 'lucide-react/dist/esm/icons/database'
import EyeOff from 'lucide-react/dist/esm/icons/eye-off'
import Eye from 'lucide-react/dist/esm/icons/eye'
import { useNavigate } from 'react-router-dom'
import { useSuspenseQuery, useQuery, useQueryClient } from '@tanstack/react-query'
import { browser } from 'wxt/browser'
import { ActivityGraph } from '@/features/stats'
import { getCurrentUser } from '../../lib/current-user'
import { getActivityData, clearActivityData } from '@/features/stats/storage'
import { getTimeStats } from '@/features/stats/logic/time-tracker'
import { getSubforumName } from '@/lib/subforums'
import { formatPreciseTime, formatBytes } from '@/lib/format-utils'
import { cn } from '@/lib/utils'
import { useSettingsStore } from '@/store'

// Lazy load - only loaded when user opens the inspector dialog
const StorageInspector = lazy(() =>
	import('./storage-inspector').then(m => ({ default: m.StorageInspector }))
)
import { currentYear } from './constants'

export function HomeWidgets() {
	const queryClient = useQueryClient()

	// Auto-refresh when tab becomes visible (not on every focus)
	// Only invalidate after 5 minutes of inactivity to avoid excessive refetches
	useEffect(() => {
		let lastRefresh = Date.now()
		const REFRESH_THRESHOLD_MS = 5 * 60 * 1000 // 5 minutes

		const handleVisibilityChange = () => {
			if (document.visibilityState === 'visible') {
				const timeSinceLastRefresh = Date.now() - lastRefresh
				if (timeSinceLastRefresh > REFRESH_THRESHOLD_MS) {
					// Invalidate with exact queryKey match for better control
					queryClient.invalidateQueries({ queryKey: ['dashboard', 'widgets'], exact: true })
					queryClient.invalidateQueries({ queryKey: ['current-user'], exact: true })
					lastRefresh = Date.now()
				}
			}
		}

		document.addEventListener('visibilitychange', handleVisibilityChange)

		return () => {
			document.removeEventListener('visibilitychange', handleVisibilityChange)
		}
	}, [queryClient])

	// 1. Fetch Dashboard Stats (Parallelized)
	const { data } = useSuspenseQuery({
		queryKey: ['dashboard', 'widgets'],
		queryFn: async () => {
			const [activityData, timeStats, storageBytes, storageItems] = await Promise.all([
				getActivityData(),
				getTimeStats(),
				browser.storage.local.getBytesInUse(null),
				browser.storage.local.get(null).then(items => Object.keys(items).length),
			])

			const quota = (browser.storage.local as any).QUOTA_BYTES || 5242880

			return {
				activityData,
				timeStats,
				storageStats: {
					used: storageBytes,
					quota,
					percentage: Math.min((storageBytes / quota) * 100, 100),
					items: storageItems,
				},
			}
		},
	})

	const { activityData, timeStats, storageStats } = data
	const { data: user } = useQuery({ queryKey: ['current-user'], queryFn: getCurrentUser })
	const username = user?.username || 'Usuario'

	// Logic for Stats (calculated from data)
	const allPostEntries = Object.values(activityData)
		.flat()
		.filter(entry => entry.type === 'post' && new Date(entry.timestamp).getFullYear() === currentYear)

	// POSTS: only count new posts (create = new thread, publish = reply), NOT edits
	const totalPosts = allPostEntries.filter(entry => entry.action !== 'update').length
	const threadsCreated = allPostEntries.filter(entry => entry.action === 'create').length

	// Process Time Stats
	const sortedSubforums = Object.entries(timeStats)
		.map(([slug, time]) => ({
			slug,
			name: getSubforumName(slug),
			timeMs: time,
		}))
		.sort((a, b) => b.timeMs - a.timeMs)

	const maxVal = sortedSubforums[0]?.timeMs || 1
	const topSubforums = sortedSubforums.slice(0, 5).map(s => ({
		...s,
		percent: Math.round((s.timeMs / maxVal) * 100),
	}))

	const totalTimeMs = Object.values(timeStats).reduce((acc, curr) => acc + curr, 0)

	const activeSubforum = {
		name: sortedSubforums[0]?.name || '-',
		timeMs: sortedSubforums[0]?.timeMs || 0,
	}

	// Check if activity tracking is enabled
	const enableActivityTracking = useSettingsStore(s => s.enableActivityTracking)
	const navigate = useNavigate()

	// Early return with disabled state if tracking is off
	if (!enableActivityTracking) {
		return (
			<DisabledActivityView
				activeSubforum={activeSubforum}
				topSubforums={topSubforums}
				storageStats={storageStats}
				username={username}
				navigate={navigate}
				totalTimeMs={totalTimeMs}
			/>
		)
	}

	return (
		<>
			{/* Main Stats Grid */}
			<div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
				{/* Posts Card */}
				<StatCard
					icon={Send}
					label="Posts"
					value={totalPosts}
					subtext={`en ${currentYear}`}
					className="reveal reveal-d2"
				/>

				{/* Threads Card */}
				<StatCard
					icon={MessageSquare}
					label="Hilos"
					value={threadsCreated}
					subtext="creados"
					className="reveal reveal-d3"
				/>

				{/* Active Time Card */}
				<StatCard
					icon={Clock}
					label="Subforo Más Activo"
					value={formatPreciseTime(activeSubforum.timeMs)}
					subtext={`en ${activeSubforum.name}`}
					className="reveal reveal-d4"
				/>

				{/* Total Time Card */}
				<StatCard
					icon={History}
					label="Tiempo Total"
					value={formatPreciseTime(totalTimeMs)}
					subtext=""
					variant="featured"
					className="reveal reveal-d5"
				/>
			</div>

			{/* Full Width Heatmap */}
			<div className="w-full reveal reveal-d5">
				<ActivityGraph
					activityData={activityData}
					username={username}
					onClearData={async () => {
						await clearActivityData()
						queryClient.invalidateQueries({ queryKey: ['dashboard', 'widgets'] })
					}}
				/>
			</div>

			{/* Secondary Grid: Top Subforums + Storage */}
			<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
				<div className="reveal reveal-d6 h-full">
					<TopSubforumsCard topSubforums={topSubforums} totalTimeMs={totalTimeMs} />
				</div>
				<div className="reveal reveal-d6 h-full">
					<StorageCard storageStats={storageStats} />
				</div>
			</div>
		</>
	)
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

interface StatCardProps {
	icon: React.ComponentType<{ className?: string }>
	label: string
	value: string | number
	subtext: string
	variant?: 'default' | 'featured' | 'disabled'
	className?: string
}

/**
 * Animates a number from 0 to target on first mount (ease-out cubic).
 * Subsequent target changes (refetches) jump directly — no re-animation.
 * Respects prefers-reduced-motion.
 */
function useCountUp(target: number, durationMs = 800): number {
	const reduced =
		typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
	const animatedOnce = useRef(false)
	const [value, setValue] = useState(reduced ? target : 0)

	useEffect(() => {
		if (reduced || animatedOnce.current) {
			setValue(target)
			return
		}
		animatedOnce.current = true
		let raf: number
		const t0 = performance.now()
		const tick = (now: number) => {
			const progress = Math.min((now - t0) / durationMs, 1)
			setValue(Math.round(target * (1 - Math.pow(1 - progress, 3))))
			if (progress < 1) raf = requestAnimationFrame(tick)
		}
		raf = requestAnimationFrame(tick)
		return () => cancelAnimationFrame(raf)
	}, [target, durationMs, reduced])

	return value
}

/**
 * Renders time strings ("19h 57m 23s") with de-emphasized unit letters.
 * Numeric values count up on mount; non-time strings render as-is.
 */
function StatValue({ value }: { value: string | number }) {
	const animated = useCountUp(typeof value === 'number' ? value : 0)
	if (typeof value === 'number') return <>{animated.toLocaleString('es-ES')}</>

	const parts = value.split(/(\d+)/).filter(Boolean)
	const isTime = /\d+\s*[hms]/.test(value)
	if (!isTime) return <>{value}</>

	return (
		<>
			{parts.map((part, i) =>
				/^\d+$/.test(part) ? (
					<span key={i}>{part}</span>
				) : (
					<span key={i} className="text-base font-medium text-muted-foreground">
						{part}
					</span>
				)
			)}
		</>
	)
}

const StatCard = memo(function StatCard({
	icon: Icon,
	label,
	value,
	subtext,
	variant = 'default',
	className,
}: StatCardProps) {
	const isFeatured = variant === 'featured'
	const isDisabled = variant === 'disabled'

	return (
		<div
			data-slot="card"
			className={cn(
				'relative overflow-hidden rounded-xl border bg-card p-5',
				isFeatured && 'glint-border card-hero',
				isDisabled && 'opacity-50 blur-[1.5px] pointer-events-none select-none',
				className
			)}
		>
			{/* Hero corner glow — only on the featured (selected) metric */}
			{isFeatured && (
				<div
					aria-hidden
					className="pointer-events-none absolute -right-10 -top-12 h-28 w-28 rounded-full opacity-70 blur-2xl"
					style={{ background: 'var(--glow-primary)' }}
				/>
			)}

			{/* Label + faint marker icon (icon de-emphasized, analytics style) */}
			<div className="relative flex items-start justify-between">
				<span className="font-data text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
					{label}
				</span>
				<Icon
					className={cn('h-3.5 w-3.5 shrink-0', isFeatured ? 'text-primary/35' : 'text-muted-foreground/25')}
				/>
			</div>

			{/* The number — the hero of the card */}
			<div
				className={cn(
					'relative mt-5 font-data text-[2rem] font-bold leading-none tracking-tight tabular-nums',
					isFeatured ? 'text-primary text-glow' : isDisabled ? 'text-muted-foreground' : 'text-foreground'
				)}
			>
				<StatValue value={value} />
			</div>

			{subtext && <p className="relative mt-2.5 line-clamp-1 text-xs text-muted-foreground">{subtext}</p>}
		</div>
	)
})

interface TopSubforumsCardProps {
	topSubforums: Array<{ slug: string; name: string; timeMs: number; percent: number }>
	totalTimeMs: number
}

const TopSubforumsCard = memo(function TopSubforumsCard({ topSubforums, totalTimeMs }: TopSubforumsCardProps) {
	return (
		<div data-slot="card" className="bg-card border rounded-xl p-5 h-full">
			<div className="flex items-center justify-between mb-4">
				<h3 className="text-[15px] font-semibold text-foreground flex items-center gap-2.5">
					<Clock className="h-4 w-4 text-primary" />
					Tiempo por subforo
				</h3>
				<span className="font-data text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
					Top 5
				</span>
			</div>

			{topSubforums.length > 0 ? (
				<div className="divide-y divide-foreground/[0.06]">
					{topSubforums.map((sub, index) => {
						const isTop = index === 0
						const share = totalTimeMs > 0 ? Math.round((sub.timeMs / totalTimeMs) * 100) : 0
						return (
							<div key={sub.slug} className="flex items-center gap-3 py-3 first:pt-1">
								<span
									className={cn(
										'w-4 shrink-0 text-right font-data text-[11px] font-semibold tabular-nums',
										isTop ? 'text-primary' : 'text-muted-foreground/60'
									)}
								>
									{index + 1}
								</span>
								<span
									className={cn(
										'min-w-0 flex-1 truncate text-[13px]',
										isTop ? 'font-semibold text-foreground' : 'font-medium text-foreground/90'
									)}
								>
									{sub.name}
								</span>
								<span className="shrink-0 font-data text-[12px] tabular-nums text-foreground/80">
									{formatPreciseTime(sub.timeMs)}
								</span>
								<span className="w-9 shrink-0 text-right font-data text-[11px] tabular-nums text-muted-foreground/50">
									{share}%
								</span>
							</div>
						)
					})}
				</div>
			) : (
				<div className="text-center py-8 text-muted-foreground text-sm italic">Aún no hay datos de actividad</div>
			)}
		</div>
	)
})

interface StorageCardProps {
	storageStats: {
		used: number
		quota: number
		percentage: number
		items: number
	}
}

function StorageCard({ storageStats }: StorageCardProps) {
	const isCritical = storageStats.percentage > 90
	const isWarning = storageStats.percentage > 75

	return (
		<div data-slot="card" className="bg-card border rounded-xl p-5 h-full flex flex-col">
			<div className="flex items-center justify-between mb-4">
				<h3 className="text-[15px] font-semibold text-foreground flex items-center gap-2.5">
					<Database className="h-4 w-4 text-primary" />
					Almacenamiento
				</h3>
				<span className="font-data text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
					Local
				</span>
			</div>

			<div className="flex-1 flex flex-col gap-5">
				{/* Usage Bar */}
				<div>
					<div className="flex items-baseline justify-between mb-2">
						<span className="font-data text-2xl font-semibold tabular-nums text-foreground">
							{formatBytes(storageStats.used)}{' '}
							<span className="text-xs font-medium text-muted-foreground">/ {formatBytes(storageStats.quota)}</span>
						</span>
						<span
							className={cn(
								'font-data text-xs font-semibold tabular-nums',
								isCritical ? 'text-destructive' : 'text-primary'
							)}
						>
							{storageStats.percentage.toFixed(1)}%
						</span>
					</div>
					<div className="h-[7px] w-full bg-foreground/[0.06] rounded-full overflow-hidden">
						<div
							className={cn(
								'bar-grow h-full rounded-full transition-all duration-1000 ease-out',
								isCritical
									? 'bg-destructive'
									: isWarning
										? 'bg-amber-500'
										: 'bg-gradient-to-r from-primary/60 to-primary shadow-[0_0_10px_var(--glow-primary)]'
							)}
							style={{ width: `${storageStats.percentage}%` }}
						/>
					</div>
				</div>

				<div className="grid grid-cols-2 gap-3 text-xs">
					<div className="bg-foreground/[0.04] rounded-lg p-3 border border-border/50">
						<span className="block font-data text-[9px] font-medium uppercase tracking-[0.18em] text-muted-foreground mb-1.5">
							Items totales
						</span>
						<span className="font-data text-base font-semibold tabular-nums text-foreground">{storageStats.items}</span>
					</div>
					<div className="bg-foreground/[0.04] rounded-lg p-3 border border-border/50">
						<span className="block font-data text-[9px] font-medium uppercase tracking-[0.18em] text-muted-foreground mb-1.5">
							Estado
						</span>
						<span
							className={cn(
								'font-data text-base font-semibold flex items-center gap-2',
								isCritical ? 'text-destructive' : 'text-foreground'
							)}
						>
							<span
								className={cn(
									'w-1.5 h-1.5 rounded-full shrink-0',
									isCritical ? 'bg-destructive' : 'bg-primary shadow-[0_0_8px_var(--glow-primary)]'
								)}
							/>
							{isCritical ? 'Crítico' : 'Saludable'}
						</span>
					</div>

					<Suspense
						fallback={
							<button
								disabled
								className="flex items-center justify-center gap-2 w-full p-2 mt-2 text-xs font-medium text-muted-foreground rounded-lg border border-dashed border-muted opacity-50"
							>
								<Eye className="w-3 h-3 animate-pulse" />
								Cargando...
							</button>
						}
					>
						<StorageInspector
							triggerButton={
								<button className="flex items-center justify-center gap-2 w-full p-2 mt-2 text-xs font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors border border-dashed border-primary/30">
									<Eye className="w-3 h-3" />
									Inspeccionar contenido
								</button>
							}
						/>
					</Suspense>
				</div>

				<p className="text-[10px] text-muted-foreground/60 text-center mt-auto">
					Datos guardados localmente en tu navegador
				</p>
			</div>
		</div>
	)
}

// =============================================================================
// DISABLED STATE
// =============================================================================

interface DisabledActivityViewProps {
	activeSubforum: { name: string; timeMs: number }
	topSubforums: Array<{ slug: string; name: string; timeMs: number; percent: number }>
	storageStats: StorageCardProps['storageStats']
	username: string
	navigate: (path: string) => void
	totalTimeMs: number
}

function DisabledActivityView({
	activeSubforum,
	topSubforums,
	storageStats,
	username,
	navigate,
	totalTimeMs,
}: DisabledActivityViewProps) {
	return (
		<>
			{/* Main Stats Grid */}
			<div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
				{/* Posts & Threads Cards - Disabled */}
				<StatCard icon={Send} label="Posts" value="-" subtext={`en ${currentYear}`} variant="disabled" />
				<StatCard icon={MessageSquare} label="Hilos" value="-" subtext="creados" variant="disabled" />

				{/* Active Time Card - STAYS VISIBLE (uses timeStats, not activityData) */}
				<StatCard
					icon={Clock}
					label="Subforo Más Activo"
					value={formatPreciseTime(activeSubforum.timeMs)}
					subtext={`en ${activeSubforum.name}`}
				/>

				{/* Total Time Card - STAYS VISIBLE */}
				<StatCard
					icon={History}
					label="Tiempo Total"
					value={formatPreciseTime(totalTimeMs)}
					subtext=""
					variant="featured"
				/>
			</div>

			{/* Heatmap - disabled with overlay */}
			<div className="w-full relative">
				<div className="opacity-40 pointer-events-none select-none blur-[1.5px]">
					<ActivityGraph activityData={{}} username={username} />
				</div>
				{/* Centered overlay on heatmap */}
				<div className="absolute inset-0 flex items-center justify-center">
					<button
						onClick={() => navigate('/settings?tab=advanced')}
						className="bg-card/95 backdrop-blur-sm border border-border rounded-xl px-5 py-3 shadow-lg flex items-center gap-3 hover:bg-card transition-colors"
					>
						<EyeOff className="h-5 w-5 text-muted-foreground" />
						<div className="flex flex-col items-start">
							<span className="text-sm font-medium text-foreground">Registro de actividad desactivado</span>
							<span className="text-xs text-primary">Activar en Ajustes →</span>
						</div>
					</button>
				</div>
			</div>

			{/* Secondary Grid remains visible (time by subforum + storage) */}
			<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
				<TopSubforumsCard topSubforums={topSubforums} totalTimeMs={totalTimeMs} />
				<StorageCard storageStats={storageStats} />
			</div>
		</>
	)
}
