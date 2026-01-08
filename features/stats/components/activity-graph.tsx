/**
 * ActivityGraph - GitHub-style Activity Heatmap
 *
 * 5 color levels, interactive day selection with detailed activity list.
 */
import { useState, useMemo, memo } from 'react'
import { getActivityData, formatDateKey, type ActivityData, type ActivityEntry } from '../storage'
import { getCurrentUser } from '@/entrypoints/options/lib/current-user'
import { cn } from '@/lib/utils'
import Calendar from 'lucide-react/dist/esm/icons/calendar'
import Plus from 'lucide-react/dist/esm/icons/plus'
import TrendingUp from 'lucide-react/dist/esm/icons/trending-up'
import Pencil from 'lucide-react/dist/esm/icons/pencil'
import Send from 'lucide-react/dist/esm/icons/send'
import X from 'lucide-react/dist/esm/icons/x'
import Trash2 from 'lucide-react/dist/esm/icons/trash-2'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

// =============================================================================
// Constants
// =============================================================================

const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

const ACTIVITY_LEVELS = [
	'bg-secondary', // Level 0 (Empty)
	'bg-primary opacity-30', // Level 1 - Subtle
	'bg-primary opacity-50', // Level 2 - Medium
	'bg-primary opacity-75', // Level 3 - High
	'bg-primary', // Level 4 - Maximum
]

// =============================================================================
// Types
// =============================================================================

interface DayData {
	date: Date
	dateKey: string
	count: number
	entries: ActivityEntry[]
	isToday: boolean
}

// =============================================================================
// Helpers
// =============================================================================

function getColorClass(count: number): string {
	if (count === 0) return ACTIVITY_LEVELS[0]
	if (count <= 2) return ACTIVITY_LEVELS[1]
	if (count <= 5) return ACTIVITY_LEVELS[2]
	if (count <= 9) return ACTIVITY_LEVELS[3]
	return ACTIVITY_LEVELS[4]
}

/**
 * Filter entries to only include posts (exclude drafts)
 * Posts include: new threads (create), replies (publish), edits (update)
 */
function filterPostsOnly(entries: ActivityEntry[]): ActivityEntry[] {
	return entries.filter(entry => entry.type === 'post')
}

function generateYearData(activityData: ActivityData): DayData[] {
	const days: DayData[] = []
	const today = new Date()
	const currentYear = today.getFullYear()

	// Start from Jan 1st of current year
	const startDate = new Date(currentYear, 0, 1)

	// Adjust to start from Sunday (0)
	const dayOfWeek = startDate.getDay()
	startDate.setDate(startDate.getDate() - dayOfWeek)

	// End at Dec 31st of current year
	const endDate = new Date(currentYear, 11, 31)

	// Pad end to complete the last week
	const endDayOfWeek = endDate.getDay()
	endDate.setDate(endDate.getDate() + (6 - endDayOfWeek))

	// Calculate total days to render
	const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1

	for (let i = 0; i < totalDays; i++) {
		const date = new Date(startDate)
		date.setDate(date.getDate() + i)

		// Only count as "Today" if it's actually today
		const isToday =
			date.getDate() === today.getDate() &&
			date.getMonth() === today.getMonth() &&
			date.getFullYear() === today.getFullYear()

		const dateKey = formatDateKey(date)
		// Filter to only include posts (no drafts)
		const entries = filterPostsOnly(activityData[dateKey] || [])

		days.push({
			date,
			dateKey,
			count: entries.length,
			entries,
			isToday,
		})
	}

	return days
}

function chunkDaysIntoWeeks(days: DayData[]): DayData[][] {
	const weeks: DayData[][] = []
	for (let i = 0; i < days.length; i += 7) {
		weeks.push(days.slice(i, i + 7))
	}
	return weeks
}

function getMonthLabels(weeks: DayData[][]) {
	const labels: { month: string; index: number }[] = []
	let currentMonth = -1

	weeks.forEach((week, i) => {
		// Check first day of week for month change logic
		const dayCheck = week[0]
		const month = dayCheck.date.getMonth()

		// Add label if month changes
		if (month !== currentMonth) {
			currentMonth = month
			// Skip December at the beginning (likely previous year overlap)
			if (i === 0 && month === 11) return

			labels.push({ month: MONTH_NAMES[month], index: i })
		}
	})

	return labels
}

function capitalizeWords(str: string): string {
	return str.charAt(0).toUpperCase() + str.slice(1)
}

function formatDateDisplay(date: Date): string {
	const weekday = date.toLocaleDateString('es-ES', { weekday: 'long' })
	const day = date.getDate()
	const month = date.toLocaleDateString('es-ES', { month: 'long' })
	const year = date.getFullYear()
	return `${capitalizeWords(weekday)}, ${day} de ${month} de ${year}`
}

function formatTooltipDate(date: Date): string {
	const day = date.getDate()
	const month = date.toLocaleDateString('es-ES', { month: 'long' })
	return `${day} de ${month}`
}

function getActivityIcon(action: string) {
	switch (action) {
		case 'create':
			// New thread
			return (
				<div className="flex items-center justify-center h-8 w-8 rounded-lg bg-accent/50 border border-border">
					<Plus className="h-4 w-4 text-accent-foreground" />
				</div>
			)
		case 'update':
			// Edit
			return (
				<div className="flex items-center justify-center h-8 w-8 rounded-lg border border-border">
					<Pencil className="h-3.5 w-3.5 text-muted-foreground" />
				</div>
			)
		case 'publish':
		default:
			// Reply - Use Send to match POSTS stat card
			return (
				<div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary/10 border border-primary/20">
					<Send className="h-4 w-4 text-primary" />
				</div>
			)
	}
}

function getSmallIcon(action: string) {
	switch (action) {
		case 'create':
			return <Plus className="h-3.5 w-3.5 text-accent-foreground" />
		case 'update':
			return <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
		case 'publish':
		default:
			return <Send className="h-3.5 w-3.5 text-primary" />
	}
}

function getActionVerb(entry: ActivityEntry, hasContext: boolean): string {
	switch (entry.action) {
		case 'create':
			return 'creó un hilo en'
		case 'update':
			return 'editó un mensaje en'
		case 'publish':
		default:
			return 'respondió en'
	}
}

function groupEntriesByAction(entries: ActivityEntry[]): Record<string, number> {
	return entries.reduce((acc, entry) => {
		acc[entry.action] = (acc[entry.action] || 0) + 1
		return acc
	}, {} as Record<string, number>)
}

function getActionLabel(action: string, count: number): string {
	switch (action) {
		case 'create':
			return count === 1 ? 'hilo creado' : 'hilos creados'
		case 'update':
			return count === 1 ? 'edición' : 'ediciones'
		case 'publish':
		default:
			return count === 1 ? 'respuesta' : 'respuestas'
	}
}

function groupEntriesBySubforum(entries: ActivityEntry[]): Record<string, number> {
	return entries.reduce((acc, entry) => {
		// Only count posts with context (subforum)
		if (entry.type === 'post' && entry.context) {
			acc[entry.context] = (acc[entry.context] || 0) + 1
		}
		return acc
	}, {} as Record<string, number>)
}

function formatTooltipContent(day: DayData): React.ReactNode {
	if (day.count === 0) {
		return <span>Sin actividad el {formatTooltipDate(day.date)}</span>
	}

	const bySubforum = groupEntriesBySubforum(day.entries)
	const subforumEntries = Object.entries(bySubforum)

	// If we have subforum data, show breakdown
	if (subforumEntries.length > 0) {
		return (
			<div className="text-left">
				<div className="font-semibold">
					{day.count} {day.count === 1 ? 'contribución' : 'contribuciones'} · {formatTooltipDate(day.date)}
				</div>
				<div className="mt-1 text-[10px] opacity-80 space-y-0.5">
					{subforumEntries.slice(0, 4).map(([subforum, count]) => (
						<div key={subforum}>
							{subforum}: {count}
						</div>
					))}
					{subforumEntries.length > 4 && (
						<div className="text-muted-foreground">+{subforumEntries.length - 4} más...</div>
					)}
				</div>
			</div>
		)
	}

	// Fallback to simple count
	return (
		<span>
			{day.count} {day.count === 1 ? 'contribución' : 'contribuciones'} el {formatTooltipDate(day.date)}
		</span>
	)
}

// =============================================================================
// Helper Component: Skeleton
// =============================================================================

export function ActivityGraphSkeleton() {
	return (
		<Card className="border-border/50 bg-card/50 dark:bg-muted/20">
			<CardHeader className="pb-4">
				<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between animate-pulse">
					<div className="flex items-center gap-2">
						<div className="h-5 w-5 rounded bg-muted" />
						<div className="h-6 w-40 rounded-md bg-muted" />
					</div>
					<div className="flex items-center gap-2">
						<div className="h-6 w-32 rounded-md bg-muted" />
					</div>
				</div>
			</CardHeader>
			<CardContent>
				<div className="pb-2 animate-pulse">
					{/* Month labels strip */}
					<div className="mb-2 pl-8 h-4 w-full rounded bg-muted/40" />

					<div className="flex gap-2">
						{/* Day labels column */}
						<div className="hidden sm:flex flex-col justify-between h-[150px] w-6 py-2 opacity-60">
							<div className="h-3 w-full rounded bg-muted" />
							<div className="h-3 w-full rounded bg-muted" />
							<div className="h-3 w-full rounded bg-muted" />
						</div>

						{/* Single Block Heatmap */}
						<div className="flex-1 h-[150px] rounded-md bg-secondary" />
					</div>

					{/* Legend Placeholder */}
					<div className="mt-4 flex items-center justify-end gap-3 opacity-80">
						<div className="h-3 w-8 rounded bg-muted" />
						<div className="h-4 w-28 rounded bg-muted" />
						<div className="h-3 w-8 rounded bg-muted" />
					</div>
				</div>
			</CardContent>
		</Card>
	)
}
// =============================================================================
// Component
// =============================================================================

export const ActivityGraph = memo(function ActivityGraph({
	className,
	activityData,
	username,
	onClearData,
}: {
	className?: string
	activityData: ActivityData
	username: string
	onClearData?: () => void
}) {
	const [selectedDay, setSelectedDay] = useState<DayData | null>(null)

	// Memoize data processing
	const { weeks, monthLabels, totalActivity } = useMemo(() => {
		const days = generateYearData(activityData)
		const weeks = chunkDaysIntoWeeks(days)
		const monthLabels = getMonthLabels(weeks)
		// Count only posts (filter out drafts)
		const totalActivity = Object.values(activityData)
			.flat()
			.filter(entry => entry.type === 'post').length
		return { weeks, monthLabels, totalActivity }
	}, [activityData])

	const currentYear = new Date().getFullYear()

	return (
		<div className={className}>
			<Card className="border-border/50 bg-card/50 dark:bg-muted/20">
				<CardHeader className="pb-4">
					<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
						<div className="flex items-center gap-2">
							<Calendar className="h-5 w-5 text-primary" />
							<CardTitle className="text-lg font-semibold text-foreground">Actividad del año {currentYear}</CardTitle>
						</div>
					<div className="flex items-center gap-2 text-sm tracking-tight">
						<TrendingUp className="h-4 w-4 text-primary" />
						<span className="font-black text-primary text-base">{totalActivity}</span>
						<span className="text-muted-foreground font-medium">
							{totalActivity === 1 ? 'contribución total' : 'contribuciones totales'}
						</span>
												{/* Clear button */}
								{onClearData && (
									<AlertDialog>
										<AlertDialogTrigger asChild>
											<button 
												className="ml-2 p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
												aria-label="Borrar historial"
												title="Borrar historial de actividad"
											>
												<Trash2 className="h-4 w-4" />
											</button>
										</AlertDialogTrigger>
										<AlertDialogContent>
											<AlertDialogHeader>
												<AlertDialogTitle>¿Borrar historial de actividad?</AlertDialogTitle>
												<AlertDialogDescription>
													Esta acción eliminará permanentemente todo tu historial de actividad.
													Los datos del gráfico de contribuciones se perderán y no se pueden recuperar.
												</AlertDialogDescription>
											</AlertDialogHeader>
											<AlertDialogFooter>
												<AlertDialogCancel>Cancelar</AlertDialogCancel>
												<AlertDialogAction
													onClick={() => onClearData?.()}
													className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
												>
													Borrar todo
												</AlertDialogAction>
											</AlertDialogFooter>
										</AlertDialogContent>
									</AlertDialog>
								)}
					</div>
					</div>
				</CardHeader>
				<CardContent>
					<div className="w-fit max-w-full pb-2">
						<div>
							{/* Month labels */}
							<div className="mb-2 flex pl-8">
								<div className="relative w-full h-4">
									{monthLabels.map((label, i) => (
										<div
											key={i}
											className="absolute text-xs text-muted-foreground"
											style={{ left: `${(label.index / weeks.length) * 100}%` }}
										>
											{label.month}
										</div>
									))}
								</div>
							</div>

							{/* Heatmap grid */}
							<div className="flex gap-2">
								{/* Day labels column - Aligned with grid rows */}
								<div className="flex w-6 flex-col gap-0.5 pr-1 text-[10px] text-muted-foreground">
									{/* Row 0 (Sun) */}
									<div className="h-5" />
									{/* Row 1 (Mon) */}
									<div className="h-5 flex items-center leading-none">Lun</div>
									{/* Row 2 (Tue) */}
									<div className="h-5" />
									{/* Row 3 (Wed) */}
									<div className="h-5 flex items-center leading-none">Mié</div>
									{/* Row 4 (Thu) */}
									<div className="h-5" />
									{/* Row 5 (Fri) */}
									<div className="h-5 flex items-center leading-none">Vie</div>
									{/* Row 6 (Sat) */}
									<div className="h-5" />
								</div>

								{/* Grid */}
								<div className="flex gap-0.5">
									{weeks.map((week, weekIndex) => (
										<div key={weekIndex} className="flex flex-col gap-0.5">
											{week.map((day, dayIndex) => {
												// Semantic colors for empty cells
												const colorClass = day.count === 0 ? 'bg-secondary' : getColorClass(day.count)
												const isSelected = selectedDay?.dateKey === day.dateKey
												const inCurrentYear = day.date.getFullYear() === currentYear

												// Placeholders for padding - translucent to keep grid shape
												if (!inCurrentYear) return <div key={dayIndex} className="h-5 w-5" />

												return (
													<TooltipPrimitive.Provider key={day.dateKey} delayDuration={0} skipDelayDuration={0}>
														<TooltipPrimitive.Root disableHoverableContent>
															<TooltipPrimitive.Trigger asChild>
																<div
																	onClick={() => day.count > 0 && setSelectedDay(isSelected ? null : day)}
																	className={cn(
																		'h-5 w-5 rounded-sm transition-all',
																		colorClass,
																		day.count > 0 && 'cursor-pointer hover:ring-1 hover:ring-primary/50',
																		isSelected && 'ring-2 ring-primary z-20',
																		day.isToday && !isSelected && 'ring-1 ring-foreground/60 z-10'
																	)}
																/>
															</TooltipPrimitive.Trigger>
															<TooltipPrimitive.Portal>
																<TooltipPrimitive.Content
																	side="top"
																	sideOffset={5}
																	className="bg-popover border border-border text-popover-foreground text-xs px-2.5 py-1.5 rounded-md z-50 pointer-events-none shadow-md max-w-xs"
																>
																	{formatTooltipContent(day)}
																</TooltipPrimitive.Content>
															</TooltipPrimitive.Portal>
														</TooltipPrimitive.Root>
													</TooltipPrimitive.Provider>
												)
											})}
										</div>
									))}
								</div>
							</div>

							{/* Simple Legend with Opacity Strategy */}
							<div className="mt-4 flex items-center justify-end gap-2 text-xs text-muted-foreground">
								<span className="font-medium">Menos</span>
								<div className="flex gap-1">
									{ACTIVITY_LEVELS.map((level, i) => (
										<div
											key={i}
											className={cn(
												'h-5 w-5 rounded-sm border border-transparent',
												level,
												// Compensate opacity for border visibility if needed, or add specific overrides
												i > 0 && i < 4 && 'shadow-sm ring-1 ring-inset ring-black/5 dark:ring-white/10'
											)}
										/>
									))}
								</div>
								<span className="font-medium text-primary">Más</span>
							</div>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Selected Day Details */}
			{selectedDay && selectedDay.entries.length > 0 && (
				<div className="border border-border/50 rounded-xl bg-card/40 overflow-hidden animate-in fade-in-0 slide-in-from-bottom-2 duration-150 ease-out shadow-lg mt-6">
					{/* Header */}
					<div className="px-5 py-4 flex items-start justify-between border-b border-border/50 bg-muted/10">
						<div>
							<h4 className="font-semibold text-foreground text-[15px]">{formatDateDisplay(selectedDay.date)}</h4>
							<p className="text-sm font-medium text-primary mt-0.5">
								{selectedDay.count} {selectedDay.count === 1 ? 'contribución' : 'contribuciones'}
							</p>
						</div>
						<button
							onClick={() => setSelectedDay(null)}
							className="text-muted-foreground hover:text-foreground transition-all p-2 hover:bg-muted/30 rounded-lg hover:scale-110"
							aria-label="Cerrar"
						>
							<X className="h-5 w-5" />
						</button>
					</div>

					{/* Activity list */}
					<div className="divide-y divide-border/50 max-h-75 overflow-y-auto scrollbar-thin">
						{selectedDay.entries.map((entry, index) => (
							<div 
								key={entry.id} 
								className={cn(
									"px-5 py-4 flex gap-4 hover:bg-muted/10 transition-all group animate-in fade-in-0 slide-in-from-left-1 duration-150 fill-mode-backwards",
									index === 1 && "delay-75",
									index === 2 && "delay-100",
									index > 2 && "delay-150"
								)}
							>
								<div className="mt-0.5 shrink-0">{getActivityIcon(entry.action)}</div>
								<div className="flex-1 min-w-0 flex flex-col justify-center">
									<div className="flex items-baseline justify-between mb-0.5">
										<p className="text-sm text-foreground/90">
											<span className="font-semibold text-foreground">{username}</span>
											<span className="text-muted-foreground"> {getActionVerb(entry, !!entry.context)} </span>
											{entry.context && <span className="text-foreground font-medium">{entry.context}</span>}
										</p>
										<span className="text-xs text-muted-foreground font-mono ml-4">
											{new Date(entry.timestamp).toLocaleTimeString('es-ES', {
												hour: '2-digit',
												minute: '2-digit',
											})}
										</span>
									</div>

									{entry.title && (
										<div className="text-sm text-muted-foreground truncate mt-0.5">
											{entry.url ? (
												<a
													href={entry.url}
													target="_blank"
													rel="noopener noreferrer"
													className="hover:text-primary hover:underline"
												>
													{entry.title.replace(' - Responder', '')}
												</a>
											) : (
												entry.title.replace(' - Responder', '')
											)}
										</div>
									)}
								</div>
							</div>
						))}
					</div>

					{/* Footer Summary */}
					<div className="px-5 py-3 bg-muted/20 border-t border-border/50 flex gap-5 text-xs text-muted-foreground">
						{Object.entries(groupEntriesByAction(selectedDay.entries)).map(([action, count]) => (
							<div key={action} className="flex items-center gap-1.5 font-medium">
								{getSmallIcon(action)}
								<span>
									{count} {getActionLabel(action, count)}
								</span>
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	)
})
