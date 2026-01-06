/**
 * Home View - Dashboard principal (Minimalista)
 * Header + Stats esenciales + Heatmap como protagonista
 */
import { Suspense, useEffect } from 'react'
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

			<Suspense fallback={<WidgetsSkeleton />}>
				<HomeWidgets />
			</Suspense>
		</div>
	)
}
