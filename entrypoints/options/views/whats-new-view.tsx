/**
 * What's New View - Show the news of every version
 *
 * This view is displayed when the user clicks the dashboard button
 * with the news badge, or navigates to the "What's New" section in the sidebar.
 */
import { useEffect, useState } from 'react'
import Gift from 'lucide-react/dist/esm/icons/gift'
import Bug from 'lucide-react/dist/esm/icons/bug'
import Zap from 'lucide-react/dist/esm/icons/zap'
import Sparkles from 'lucide-react/dist/esm/icons/sparkles'
import LayoutDashboard from 'lucide-react/dist/esm/icons/layout-dashboard'
import Palette from 'lucide-react/dist/esm/icons/palette'
import Compass from 'lucide-react/dist/esm/icons/compass'
import Film from 'lucide-react/dist/esm/icons/film'
import Users from 'lucide-react/dist/esm/icons/users'
import Brain from 'lucide-react/dist/esm/icons/brain'
import { CHANGELOG, type ChangelogEntry, type ChangeEntry } from '@/features/dashboard/lib/changelog'
import { markCurrentVersionAsSeen } from '@/features/dashboard/lib/whats-new-storage'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

type ChangeType = ChangeEntry['type']

/** Category icon mapping */
const CATEGORY_ICONS: Record<string, { icon: typeof LayoutDashboard; color: string }> = {
	experiencia: { icon: LayoutDashboard, color: 'text-amber-500' },
	dashboard: { icon: LayoutDashboard, color: 'text-amber-500' },
	productividad: { icon: Zap, color: 'text-orange-500' },
	editor: { icon: Zap, color: 'text-orange-500' },
	diseño: { icon: Palette, color: 'text-pink-500' },
	personalización: { icon: Palette, color: 'text-pink-500' },
	navegación: { icon: Compass, color: 'text-blue-500' },
	multimedia: { icon: Film, color: 'text-purple-500' },
	cine: { icon: Film, color: 'text-purple-500' },
	comunidad: { icon: Users, color: 'text-green-500' },
	usuarios: { icon: Users, color: 'text-green-500' },
	inteligencia: { icon: Brain, color: 'text-pink-600' },
	ia: { icon: Brain, color: 'text-pink-600' },
}

/**
 * Get icon and color for a category
 */
function getCategoryStyle(category?: string): { icon: typeof LayoutDashboard; color: string } {
	if (!category) return { icon: Sparkles, color: 'text-amber-500' }
	const lowerCat = category.toLowerCase()
	for (const [key, value] of Object.entries(CATEGORY_ICONS)) {
		if (lowerCat.includes(key)) return value
	}
	return { icon: Sparkles, color: 'text-amber-500' }
}

/**
 * Groups changes by category
 */
function groupByCategory(changes: ChangeEntry[]): Map<string, ChangeEntry[]> {
	const groups = new Map<string, ChangeEntry[]>()
	changes.forEach(change => {
		const cat = change.category || 'Otros'
		if (!groups.has(cat)) groups.set(cat, [])
		groups.get(cat)!.push(change)
	})
	return groups
}

/**
 * Category section within a version card
 */
function CategorySection({ category, changes }: { category: string; changes: ChangeEntry[] }) {
	const { icon: Icon, color } = getCategoryStyle(category)

	return (
		<div className="space-y-2">
			<div className="flex items-center gap-2 pb-1 border-b border-border/50">
				<Icon className={cn('h-4 w-4', color)} />
				<span className="text-sm font-medium text-foreground">{category}</span>
				<Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-auto">
					{changes.length}
				</Badge>
			</div>
			<ul className="space-y-1.5 pl-6">
				{changes.map((change, index) => (
					<li key={index} className="flex items-start gap-2 text-sm text-muted-foreground leading-relaxed">
						<span className="text-muted-foreground/60 select-none">•</span>
						<span className="flex-1">{change.description}</span>
					</li>
				))}
			</ul>
		</div>
	)
}

/**
 * Version card with changes grouped by category
 */
function VersionCard({
	entry,
	isLatest,
	filter,
}: {
	entry: ChangelogEntry
	isLatest: boolean
	filter: ChangeType | null
}) {
	const filteredChanges = filter ? entry.changes.filter(c => c.type === filter) : entry.changes

	// Don't render if no changes match the filter
	if (filteredChanges.length === 0) return null

	// Group by category for organized display
	const groupedChanges = groupByCategory(filteredChanges)

	return (
		<Card className={cn('transition-all', isLatest && 'border-primary/50 bg-primary/5 shadow-sm')}>
			<CardHeader className="pb-4">
				<div className="flex items-start justify-between gap-4">
					<div className="space-y-1">
						<CardTitle className="text-lg flex items-center gap-2 flex-wrap">
							<span className="font-mono">v{entry.version}</span>
							{isLatest && (
								<Badge className="text-[10px] bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-500 hover:to-orange-500 text-black font-bold">
									Actual
								</Badge>
							)}
						</CardTitle>
						<CardDescription className="text-sm">
							{new Date(entry.date).toLocaleDateString('es-ES', {
								year: 'numeric',
								month: 'long',
								day: 'numeric',
							})}
						</CardDescription>
					</div>
					<Badge variant="outline" className="text-xs shrink-0">
						{filteredChanges.length} cambios
					</Badge>
				</div>

				<h3 className="text-base font-semibold text-foreground mt-3">{entry.title}</h3>

				{entry.summary && <p className="text-sm text-muted-foreground leading-relaxed">{entry.summary}</p>}
			</CardHeader>

			<CardContent className="pt-0 space-y-4">
				{Array.from(groupedChanges.entries()).map(([category, changes]) => (
					<CategorySection key={category} category={category} changes={changes} />
				))}
			</CardContent>
		</Card>
	)
}

export function WhatsNewView() {
	const [marked, setMarked] = useState(false)
	const [filter, setFilter] = useState<ChangeType | null>(null)

	// Mark as seen when mounting the view
	useEffect(() => {
		if (!marked) {
			void markCurrentVersionAsSeen()
			setMarked(true)
		}
	}, [marked])

	// Stats
	const totalVersions = CHANGELOG.length
	const totalChanges = CHANGELOG.reduce((acc, entry) => acc + entry.changes.length, 0)

	// Count by type
	const countByType = CHANGELOG.reduce((acc, entry) => {
		entry.changes.forEach(c => {
			acc[c.type] = (acc[c.type] || 0) + 1
		})
		return acc
	}, {} as Record<ChangeType, number>)

	return (
		<div className="flex-1 flex flex-col h-full">
			{/* Header */}
			<div className="flex items-center justify-between mb-6">
				<div>
					<h1 className="text-2xl font-bold flex items-center gap-3">
						<div className="p-2 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20">
							<Gift className="h-6 w-6 text-amber-500" />
						</div>
						Novedades
					</h1>
					<p className="text-muted-foreground mt-1">Historial de cambios y mejoras de la extensión</p>
				</div>

				<div className="flex items-center gap-4 text-sm text-muted-foreground">
					<span>
						{totalVersions} {totalVersions === 1 ? 'versión' : 'versiones'}
					</span>
					<span className="text-border">•</span>
					<span>{totalChanges} cambios</span>
				</div>
			</div>

			{/* Filter Buttons */}
			<div className="flex items-center gap-2 mb-4 flex-wrap">
				<span className="text-sm text-muted-foreground mr-1">Filtrar:</span>
				<Button
					variant={filter === null ? 'secondary' : 'ghost'}
					size="sm"
					className="h-7 text-xs"
					onClick={() => setFilter(null)}
				>
					Todos
				</Button>
				<Button
					variant={filter === 'feature' ? 'secondary' : 'ghost'}
					size="sm"
					className={cn(
						'h-7 text-xs gap-1.5',
						filter === 'feature' && 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
					)}
					onClick={() => setFilter(filter === 'feature' ? null : 'feature')}
				>
					<Sparkles className="h-3 w-3" />
					Novedades
					<Badge variant="outline" className="h-4 px-1 text-[10px] ml-0.5">
						{countByType.feature || 0}
					</Badge>
				</Button>
				<Button
					variant={filter === 'improvement' ? 'secondary' : 'ghost'}
					size="sm"
					className={cn(
						'h-7 text-xs gap-1.5',
						filter === 'improvement' && 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
					)}
					onClick={() => setFilter(filter === 'improvement' ? null : 'improvement')}
				>
					<Zap className="h-3 w-3" />
					Mejoras
					<Badge variant="outline" className="h-4 px-1 text-[10px] ml-0.5">
						{countByType.improvement || 0}
					</Badge>
				</Button>
				<Button
					variant={filter === 'fix' ? 'secondary' : 'ghost'}
					size="sm"
					className={cn('h-7 text-xs gap-1.5', filter === 'fix' && 'bg-red-500/10 text-red-600 dark:text-red-400')}
					onClick={() => setFilter(filter === 'fix' ? null : 'fix')}
				>
					<Bug className="h-3 w-3" />
					Correcciones
					<Badge variant="outline" className="h-4 px-1 text-[10px] ml-0.5">
						{countByType.fix || 0}
					</Badge>
				</Button>
			</div>

			{/* Changelog List */}
			<ScrollArea className="flex-1">
				<div className="space-y-4 pr-4 pb-8">
					{CHANGELOG.map((entry, index) => (
						<VersionCard key={entry.version} entry={entry} isLatest={index === 0} filter={filter} />
					))}

					{/* Footer hint */}
					<p className="text-center text-sm text-muted-foreground pt-4">🎉 Gracias por usar MVPremium</p>
				</div>
			</ScrollArea>
		</div>
	)
}
