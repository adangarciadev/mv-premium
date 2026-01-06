/**
 * Steam Game Card Component
 * Renders an embedded Steam game card with polished design
 */
import { useState, useEffect } from 'react'
import { logger } from '@/lib/logger'
import type { SteamGameDetails } from '@/services/api/steam'
import { fetchSteamGameDetails, fetchSteamGameDetailsViaBackground } from '@/services/api/steam'

interface SteamGameCardProps {
	appId: number
	/** If true, fetch directly (extension pages). If false, use background proxy (content scripts) */
	useDirectFetch?: boolean
}

// Steam SVG Logo (simplified, subtle)
const SteamLogo = () => (
	<svg className="steam-card-logo" viewBox="0 0 256 259" xmlns="http://www.w3.org/2000/svg">
		<path
			d="M127.779 0C60.42 0 5.24 52.412.436 119.036l68.48 28.281c5.803-3.97 12.81-6.291 20.366-6.291.677 0 1.345.028 2.012.06l30.465-44.116v-.618c0-26.342 21.456-47.77 47.834-47.77 26.378 0 47.833 21.445 47.833 47.82 0 26.375-21.472 47.834-47.85 47.834-.395 0-.78-.017-1.168-.025l-43.42 30.967c.017.556.042 1.11.042 1.674 0 19.771-16.07 35.833-35.849 35.833-17.39 0-31.909-12.397-35.228-28.844l-49.02-20.262C28.353 224.848 73.298 259 127.78 259c70.697 0 128.003-57.288 128.003-127.952C255.782 57.305 198.476 0 127.779 0zm-54.82 194.602-15.453-6.372c2.74 5.678 7.242 10.527 13.139 13.445 12.805 6.337 28.36 1.135 34.713-11.636 3.074-6.198 3.36-13.03.801-19.238-2.553-6.2-7.525-10.983-14.007-13.47-6.424-2.462-13.19-2.352-19.164.085l15.973 6.603c9.447 3.9 13.927 14.704 10.01 24.126-3.909 9.414-14.73 13.869-24.143 9.93l.13.527zm100.635-93.18c0-17.574-14.306-31.856-31.908-31.856-17.602 0-31.908 14.29-31.908 31.873 0 17.575 14.306 31.857 31.908 31.857 17.602 0 31.908-14.282 31.908-31.874zm-55.822.05c0-13.227 10.727-23.938 23.964-23.938 13.244 0 23.971 10.71 23.971 23.937 0 13.228-10.727 23.946-23.971 23.946-13.237 0-23.964-10.71-23.964-23.946z"
			fill="currentColor"
		/>
	</svg>
)

// Windows Platform Icon
const WindowsIcon = () => (
	<svg className="steam-card-platform" viewBox="0 0 24 24" fill="currentColor">
		<path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801" />
	</svg>
)

/**
 * SteamGameCard component - Renders a stylized card for a Steam app
 * @param appId - The Steam Application ID
 * @param useDirectFetch - Whether to fetch data directly or via background proxy
 */
export function SteamGameCard({ appId, useDirectFetch = true }: SteamGameCardProps) {
	const [game, setGame] = useState<SteamGameDetails | null>(null)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState(false)

	useEffect(() => {
		let cancelled = false

		async function loadGame() {
			setLoading(true)
			setError(false)

			try {
				const data = useDirectFetch
					? await fetchSteamGameDetails(appId)
					: await fetchSteamGameDetailsViaBackground(appId)

				if (!cancelled) {
					if (data) {
						setGame(data)
					} else {
						setError(true)
					}
					setLoading(false)
				}
			} catch (e) {
				logger.error('Error loading Steam game:', e)
				if (!cancelled) {
					setError(true)
					setLoading(false)
				}
			}
		}

		loadGame()

		return () => {
			cancelled = true
		}
	}, [appId, useDirectFetch])

	const storeUrl = `https://store.steampowered.com/app/${appId}`

	// Loading state
	if (loading) {
		return (
			<div className="steam-card-loading">
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
					<circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
					<path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round">
						<animateTransform
							attributeName="transform"
							type="rotate"
							from="0 12 12"
							to="360 12 12"
							dur="1s"
							repeatCount="indefinite"
						/>
					</path>
				</svg>
				<span>Cargando juego de Steam...</span>
			</div>
		)
	}

	// Error state
	if (error || !game) {
		return (
			<a href={storeUrl} target="_blank" rel="noopener noreferrer" className="steam-card steam-card-error">
				<div className="steam-card-error-content">
					<span className="steam-card-error-icon">⚠️</span>
					<span>No se pudo cargar el juego</span>
				</div>
				<span className="steam-card-btn steam-card-btn-link">Ver en Steam →</span>
				<SteamLogo />
			</a>
		)
	}

	// Format price display
	const getPriceText = () => {
		if (game.isFree) return 'Gratis'
		if (!game.price) return 'Ver precio'
		return game.price
	}

	// Determine button class based on state
	const getBtnClass = () => {
		if (game.isFree) return 'steam-card-btn steam-card-btn-free'
		if (!game.price) return 'steam-card-btn steam-card-btn-unavailable'
		if (game.discountPercent > 0) return 'steam-card-btn steam-card-btn-discount'
		return 'steam-card-btn'
	}

	// Success state - render polished card
	return (
		<a href={storeUrl} target="_blank" rel="noopener noreferrer" className="steam-card">
			{/* Header Image */}
			<div className="steam-card-image">
				<img src={game.headerImage} alt={game.name} loading="lazy" />
			</div>

			{/* Info Section */}
			<div className="steam-card-info">
				{/* Title */}
				<h1 className="steam-card-title">{game.name}</h1>

				{/* Release Date */}
				<p className="steam-card-date">{game.releaseDate}</p>

				{/* Genres/Tags */}
				<p className="steam-card-genres">
					{game.genres.length > 0 ? game.genres.slice(0, 3).join(' · ') : game.developers.join(' · ')}
				</p>

				{/* Platform icon */}
				<WindowsIcon />
			</div>

			{/* Steam Logo (top right) */}
			<SteamLogo />

			{/* Price Section */}
			<div className="steam-card-price-area">
				{/* Discount badge */}
				{game.discountPercent > 0 && <span className="steam-card-discount">-{game.discountPercent}%</span>}

				{/* Price Container */}
				{game.discountPercent > 0 ? (
					// Discounted: Stacked prices in unified container
					<div className="steam-card-price-wrapper is-discounted">
						{game.originalPrice && <div className="steam-card-original-price">{game.originalPrice}</div>}
						<div className="steam-card-btn-text">{getPriceText()}</div>
					</div>
				) : (
					// Normal: Standard button
					<span className={getBtnClass()}>{getPriceText()}</span>
				)}
			</div>
		</a>
	)
}

export default SteamGameCard
