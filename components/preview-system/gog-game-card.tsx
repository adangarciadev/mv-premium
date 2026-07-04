import { useEffect, useState } from 'react'
import { logger } from '@/lib/logger'
import type { GogGameDetails } from '@/services/api/gog'
import { fetchGogGameDetails, fetchGogGameDetailsViaBackground } from '@/services/api/gog'
import { PlatformIcons, StarIcon, UsersIcon } from './store-card-icons'

interface GogGameCardProps {
	slug: string
	/** If true, fetch directly (extension pages). If false, use the background proxy (content scripts). */
	useDirectFetch?: boolean
}

const GogLogo = () => <img className="gog-card-logo" src="https://www.mediavida.com/img/merchant/icon/gog.png" alt="GOG" loading="lazy" />

function formatCount(value: number): string {
	if (value >= 1_000_000) return `${Number((value / 1_000_000).toFixed(1))}M`
	if (value >= 1_000) return `${Number((value / 1_000).toFixed(1))}K`
	return String(value)
}

export function GogGameCard({ slug, useDirectFetch = true }: GogGameCardProps) {
	const [game, setGame] = useState<GogGameDetails | null>(null)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState(false)

	useEffect(() => {
		let cancelled = false

		async function loadGame() {
			setLoading(true)
			setError(false)

			try {
				const data = useDirectFetch ? await fetchGogGameDetails(slug) : await fetchGogGameDetailsViaBackground(slug)

				if (!cancelled) {
					setGame(data)
					setError(!data)
					setLoading(false)
				}
			} catch (loadError) {
				logger.error('[GOG] Error loading preview card:', loadError)
				if (!cancelled) {
					setError(true)
					setLoading(false)
				}
			}
		}

		void loadGame()
		return () => {
			cancelled = true
		}
	}, [slug, useDirectFetch])

	const fallbackUrl = `https://www.gog.com/game/${encodeURIComponent(slug)}`

	if (loading) {
		return (
			<div className="gog-card-loading">
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
					<circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
					<path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round">
						<animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite" />
					</path>
				</svg>
				<span>Cargando juego de GOG...</span>
			</div>
		)
	}

	if (error || !game) {
		return (
			<a href={fallbackUrl} target="_blank" rel="noopener noreferrer" className="gog-card gog-card-error">
				<div>
					<strong>No se pudo cargar el juego</strong>
					<span>Ver la ficha directamente en GOG</span>
				</div>
				<span className="gog-card-button">Ver en GOG</span>
				<GogLogo />
			</a>
		)
	}

	const metadata = game.genres.length > 0 ? game.genres.slice(0, 3).join(', ') : game.developers.slice(0, 2).join(', ')
	const hasDiscount = game.discountPercent > 0 && Boolean(game.originalPrice)

	return (
		<a href={game.storeUrl || fallbackUrl} target="_blank" rel="noopener noreferrer" className="gog-card">
			<div className="gog-card-image">
				<img src={game.coverHorizontal} alt={game.title} loading="lazy" />
			</div>
			<div className="gog-card-info">
				<h1 className="gog-card-title">{game.title}</h1>
				{metadata && <p className="gog-card-metadata">{metadata}</p>}
				{game.developers.length > 0 && game.genres.length > 0 && (
					<p className="gog-card-developer">{game.developers.slice(0, 2).join(' / ')}</p>
				)}
				<div className="gog-card-facts">
					{game.reviewsRating !== null && (
						<span className="gog-card-rating">
							<StarIcon />
							{game.reviewsRating.toFixed(1)}
						</span>
					)}
					{game.reviewsCount > 0 && (
						<span className="gog-card-review-count">
							<UsersIcon />
							{formatCount(game.reviewsCount)}
						</span>
					)}
				</div>
				<PlatformIcons className="gog-card-platforms" operatingSystems={game.operatingSystems} />
			</div>
			<GogLogo />
			<div className="gog-card-price-area">
				{hasDiscount && <span className="gog-card-discount">-{game.discountPercent}%</span>}
				<span className="gog-card-price">
					{hasDiscount && <span className="gog-card-original-price">{game.originalPrice}</span>}
					<strong>{game.price || 'Ver en GOG'}</strong>
				</span>
			</div>
		</a>
	)
}
