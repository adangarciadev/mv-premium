/**
 * Home View - Dashboard principal (Minimalista)
 * Header + Stats esenciales + Heatmap como protagonista
 */
import { Suspense, useEffect } from 'react'
import { Link } from 'react-router-dom'
import Compass from 'lucide-react/dist/esm/icons/compass'
import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right'
import { logger } from '@/lib/logger'
import { HomeHeader } from './home-header'
import { HomeWidgets } from './home-widgets'
import { WidgetsSkeleton } from './skeletons'

export function HomeView() {
	// Trigger cache cleanup on idle to avoid UI freeze
	useEffect(() => {
		const triggerCleanup = async () => {
			// Dynamic import to avoid loading pruneCache on initial bundle
			const { pruneCache } = await import('@/services/media')
			const startTime = performance.now()
			const count = await pruneCache('mv-tmdb-v2')
			const elapsed = (performance.now() - startTime).toFixed(1)
			if (count > 0) {
				logger.debug(`Pruned ${count} expired cache entries in ${elapsed}ms`)
			}
		}

		// Run only when browser is idle to avoid blocking UI
		const run = window.requestIdleCallback || ((cb: () => void) => setTimeout(cb, 1000))
		run(() => {
			logger.debug('Iniciando limpieza de caché en idle...')
			triggerCleanup()
		})
	}, [])

	return (
		<div className="space-y-6 text-foreground pb-10">
			<HomeHeader />
			<Link
				to="/discover"
				className="flex items-center gap-4 rounded-xl bg-secondary px-5 py-4 text-secondary-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
			>
				<Compass className="size-6 shrink-0" aria-hidden="true" />
				<div className="flex min-w-0 flex-1 flex-col gap-1">
					<p className="font-semibold">¿Qué puedo hacer con MV Premium?</p>
					<p className="text-sm">Descubre todas las funciones y dónde usarlas.</p>
				</div>
				<ArrowRight className="size-5 shrink-0" aria-hidden="true" />
			</Link>

			<Suspense fallback={<WidgetsSkeleton />}>
				<HomeWidgets />
			</Suspense>
		</div>
	)
}
