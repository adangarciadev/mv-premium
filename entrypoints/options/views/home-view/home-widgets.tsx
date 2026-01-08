/**
 * Home Widgets - Stats cards, activity graph, and storage widget
 */
import { memo, useEffect, lazy, Suspense } from 'react'
import Send from 'lucide-react/dist/esm/icons/send'
import MessageSquare from 'lucide-react/dist/esm/icons/message-square'
import Clock from 'lucide-react/dist/esm/icons/clock'
import Database from 'lucide-react/dist/esm/icons/database'
import EyeOff from 'lucide-react/dist/esm/icons/eye-off'
import Eye from 'lucide-react/dist/esm/icons/eye'
import { useNavigate } from 'react-router-dom'
import { useSuspenseQuery, useQuery, useQueryClient } from '@tanstack/react-query'
import { browser } from 'wxt/browser'
import { ActivityGraph } from '@/features/stats'
import { getCurrentUser } from '../../lib/current-user'
import { getActivityData } from '@/features/stats/storage'
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
			icon:
				slug.includes('off-topic')
					? '☕'
					: slug.includes('juegos')
						? '🎮'
						: slug.includes('cine')
							? '🎬'
							: slug.includes('tecnologia')
								? '💻'
								: 'msg',
		}))
		.sort((a, b) => b.timeMs - a.timeMs)

	const maxVal = sortedSubforums[0]?.timeMs || 1
	const topSubforums = sortedSubforums.slice(0, 5).map(s => ({
		...s,
		percent: Math.round((s.timeMs / maxVal) * 100),
	}))

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
			/>
		)
	}

	return (
		<>
			{/* Main Stats Grid */}
			<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
				{/* Posts Card */}
				<StatCard icon={Send} label="Posts" value={totalPosts} subtext={`en ${currentYear}`} />

				{/* Threads Card */}
				<StatCard icon={MessageSquare} label="Hilos" value={threadsCreated} subtext="creados" />

				{/* Active Time Card */}
				<StatCard
					icon={Clock}
					label="Más Activo"
					value={formatPreciseTime(activeSubforum.timeMs)}
					subtext={`en ${activeSubforum.name}`}
				/>
			</div>

			{/* Full Width Heatmap */}
			<div className="w-full">
				<ActivityGraph activityData={activityData} username={username} />
			</div>

			{/* Secondary Grid: Top Subforums + Storage */}
			<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
				<TopSubforumsCard topSubforums={topSubforums} />
				<StorageCard storageStats={storageStats} />
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
}

const StatCard = memo(function StatCard({ icon: Icon, label, value, subtext }: StatCardProps) {
	// Format numeric values with locale-aware thousands separators
	const displayValue = typeof value === 'number' ? value.toLocaleString('es-ES') : value

	return (
		<div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary/25 via-primary/5 to-transparent border border-primary/40 p-5 shadow-lg shadow-primary/5 transition-all duration-300 hover:shadow-primary/10 hover:bg-primary/10 hover:border-primary/50 group">
			<div className="flex flex-col gap-1 relative z-10">
				<span className="text-xs font-bold text-primary/80 uppercase tracking-widest">{label}</span>
				<span className="text-4xl font-black text-primary tabular-nums tracking-tight">{displayValue}</span>
				<span className="text-[10px] uppercase font-bold text-muted-foreground/60 tracking-wider line-clamp-1">
					{subtext}
				</span>
			</div>
			<Icon className="absolute -right-3 -bottom-3 h-24 w-24 text-foreground opacity-5 transition-transform duration-700 group-hover:scale-110 group-hover:rotate-12 group-hover:opacity-10" />
		</div>
	)
})

interface TopSubforumsCardProps {
	topSubforums: Array<{ slug: string; name: string; timeMs: number; percent: number }>
}

const TopSubforumsCard = memo(function TopSubforumsCard({ topSubforums }: TopSubforumsCardProps) {
	return (
		<div className="bg-card border border-border rounded-xl p-5 backdrop-blur-sm h-full shadow-sm">
			<h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
				<Clock className="h-4 w-4" />
				Tiempo por Subforo
			</h3>

			<div className="space-y-4">
				{topSubforums.length > 0 ? (
					topSubforums.map((sub, index) => (
						<div key={sub.slug} className="group">
							<div className="flex items-center justify-between text-sm mb-1.5">
								<div className="flex items-center gap-2">
									<span className="text-muted-foreground w-4 text-center text-xs opacity-50">#{index + 1}</span>
									<span className="font-medium text-foreground">{sub.name}</span>
								</div>
								<span className="text-xs text-muted-foreground tabular-nums font-mono">
									{formatPreciseTime(sub.timeMs)}
								</span>
							</div>
							<div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
								<div
									className="h-full bg-gradient-to-r from-primary to-primary/80 rounded-full transition-all duration-500 ease-out group-hover:brightness-125"
									style={{ width: `${sub.percent}%` }}
								/>
							</div>
						</div>
					))
				) : (
					<div className="text-center py-8 text-muted-foreground text-sm italic">Aún no hay datos de actividad</div>
				)}
			</div>
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
	return (
		<div className="bg-card border border-border rounded-xl p-5 backdrop-blur-sm h-full flex flex-col shadow-sm">
			<h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
				<Database className="h-4 w-4" />
				Almacenamiento Local
			</h3>

			<div className="flex-1 flex flex-col justify-center gap-6">
				{/* Usage Bar */}
				<div className="space-y-2">
					<div className="flex justify-between text-sm">
						<span className="text-muted-foreground">Uso del disco</span>
						<span className="font-mono font-medium">
							{formatBytes(storageStats.used)} / {formatBytes(storageStats.quota)}
						</span>
					</div>
					<div className="h-3 w-full bg-secondary rounded-full overflow-hidden border border-border/50">
						<div
							className={cn(
								'h-full rounded-full transition-all duration-1000 ease-out',
								storageStats.percentage > 90
									? 'bg-destructive'
									: storageStats.percentage > 75
										? 'bg-amber-500'
										: 'bg-primary'
							)}
							style={{ width: `${storageStats.percentage}%` }}
						/>
					</div>
					<p className="text-xs text-muted-foreground text-right pt-1">{storageStats.percentage.toFixed(1)}% utilizado</p>
				</div>

				<div className="grid grid-cols-2 gap-3 text-xs">
					<div className="bg-muted/50 rounded-lg p-3 border border-border/50">
						<span className="block text-muted-foreground mb-1">Items Totales</span>
						<span className="text-lg font-mono font-medium text-foreground">{storageStats.items}</span>
					</div>
					<div className="bg-muted/50 rounded-lg p-3 border border-border/50">
						<span className="block text-muted-foreground mb-1">Estado</span>
						<span
							className={cn(
								'font-medium flex items-center gap-1.5',
								storageStats.percentage > 90 ? 'text-destructive' : 'text-primary'
							)}
						>
							<div
								className={cn(
									'w-1.5 h-1.5 rounded-full animate-pulse',
									storageStats.percentage > 90 ? 'bg-destructive' : 'bg-primary'
								)}
							/>
							{storageStats.percentage > 90 ? 'Crítico' : 'Saludable'}
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
}

function DisabledActivityView({
	activeSubforum,
	topSubforums,
	storageStats,
	username,
	navigate,
}: DisabledActivityViewProps) {
	return (
		<>
			{/* Main Stats Grid */}
			<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
				{/* Posts Card - Disabled */}
				<div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-muted/25 via-muted/5 to-transparent border border-muted/40 p-5 opacity-50 blur-[1.5px]">
					<div className="flex flex-col gap-1 relative z-10">
						<span className="text-xs font-bold text-muted-foreground/80 uppercase tracking-widest">Posts</span>
						<span className="text-4xl font-black text-muted-foreground tabular-nums tracking-tight">-</span>
						<span className="text-[10px] uppercase font-bold text-muted-foreground/60 tracking-wider">
							en {currentYear}
						</span>
					</div>
					<Send className="absolute -right-3 -bottom-3 h-24 w-24 text-foreground opacity-5" />
				</div>

				{/* Threads Card - Disabled */}
				<div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-muted/25 via-muted/5 to-transparent border border-muted/40 p-5 opacity-50 blur-[1.5px]">
					<div className="flex flex-col gap-1 relative z-10">
						<span className="text-xs font-bold text-muted-foreground/80 uppercase tracking-widest">Hilos</span>
						<span className="text-4xl font-black text-muted-foreground tabular-nums tracking-tight">-</span>
						<span className="text-[10px] uppercase font-bold text-muted-foreground/60 tracking-wider">creados</span>
					</div>
					<MessageSquare className="absolute -right-3 -bottom-3 h-24 w-24 text-foreground opacity-5" />
				</div>

				{/* Active Time Card - STAYS VISIBLE (uses timeStats, not activityData) */}
				<StatCard
					icon={Clock}
					label="Más Activo"
					value={formatPreciseTime(activeSubforum.timeMs)}
					subtext={`en ${activeSubforum.name}`}
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
				<TopSubforumsCard topSubforums={topSubforums} />
				<StorageCard storageStats={storageStats} />
			</div>
		</>
	)
}
