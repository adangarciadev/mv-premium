/**
 * FavoriteSubforumsSidebar - Quick access sidebar for favorite subforums
 * Shows only icons with tooltips for fast navigation between subforums
 */
import { useState, useEffect, useCallback } from 'react'
import { logger } from '@/lib/logger'
import { getFavoriteSubforums } from '@/features/favorite-subforums/logic/storage'
import { subscribeFavoriteSubforumsChanges } from '@/features/favorite-subforums/logic/listeners'
import { ALL_SUBFORUMS } from '@/lib/subforums'
import { cn } from '@/lib/utils'
import type { FavoriteSubforum } from '@/types/storage'

interface FavoriteSubforumsSidebarProps {
	/** Current subforum slug to highlight */
	currentSlug?: string
}

/**
 * Get the icon ID for a subforum slug from the constants
 */
/**
 * Resolves the numeric icon ID for a given subforum slug
 * @param slug - Subforum identifier
 * @param iconClass - Optional element class to fallback to extraction
 * @returns Primary icon ID or null if unresolved
 */
function getIconIdForSlug(slug: string, iconClass?: string): number | null {
	// First try to find in ALL_SUBFORUMS
	const subforum = ALL_SUBFORUMS.find(s => s.slug === slug)
	if (subforum) return subforum.iconId

	// Fallback: try to extract from iconClass (e.g., "fid fid-6" -> 6)
	if (iconClass) {
		const match = iconClass.match(/fid-(\d+)/)
		if (match) return parseInt(match[1], 10)
	}

	return null
}

/**
 * FavoriteSubforumsSidebar component - Quick-access vertical icon bar
 * Injected into the right sidebar of forum and thread pages.
 * @param currentSlug - The slug of the currently viewed subforum for highlighting
 */
export function FavoriteSubforumsSidebar({ currentSlug }: FavoriteSubforumsSidebarProps) {
	const [subforums, setSubforums] = useState<FavoriteSubforum[]>([])
	const [isLoading, setIsLoading] = useState(true)

	const fetchSubforums = useCallback(async () => {
		try {
			const data = await getFavoriteSubforums()
			// Keep insertion order (most recent last)
			setSubforums(data)
		} catch (err) {
			logger.error('Error fetching favorite subforums for sidebar:', err)
		} finally {
			setIsLoading(false)
		}
	}, [])

	useEffect(() => {
		void fetchSubforums()

		// Subscribe to changes using centralized listener system
		// This handles both window events and storage.onChanged
		const unsubscribe = subscribeFavoriteSubforumsChanges(() => void fetchSubforums())

		return unsubscribe
	}, [fetchSubforums])

	// Don't render anything if loading or no favorites
	if (isLoading || subforums.length === 0) {
		return null
	}

	return (
		<div style={{ marginBottom: '15px' }}>
			<h3
				style={{
					display: 'flex',
					alignItems: 'center',
					gap: '8px',
					margin: '0 0 12px 0',
					fontSize: '14px',
					fontWeight: 600,
					color: 'var(--mv-text, #e8eaed)',
				}}
			>
				<i className="fa fa-star" style={{ color: '#f1c40f', fontSize: '14px' }}></i> SUBFOROS FAVORITOS
			</h3>

			<div
				style={{
					display: 'flex',
					flexWrap: 'wrap',
					gap: '8px',
					padding: 0,
					margin: 0,
				}}
			>
				{subforums.map(subforum => {
					const iconId = getIconIdForSlug(subforum.id, subforum.iconClass)
					const isCurrent = subforum.id === currentSlug

					// Base styles for the button
					const baseStyle: React.CSSProperties = {
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						height: '40px',
						width: '40px',
						borderRadius: 'var(--radius, 8px)',
						transition: 'all 0.15s ease',
						textDecoration: 'none',
						backgroundColor: isCurrent ? 'rgba(138,180,248,0.15)' : 'rgba(255,255,255,0.05)',
						border: isCurrent ? '1px solid rgba(138,180,248,0.3)' : '1px solid transparent',
						boxShadow: isCurrent ? '0 0 0 2px rgba(138,180,248,0.1)' : 'none',
					}

					return (
						<div key={subforum.id} style={{ margin: 0, padding: 0 }}>
							<a
								href={subforum.url}
								title={subforum.name}
								style={baseStyle}
								onMouseEnter={e => {
									if (!isCurrent) {
										e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'
										e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'
									}
								}}
								onMouseLeave={e => {
									if (!isCurrent) {
										e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'
										e.currentTarget.style.borderColor = 'transparent'
									}
								}}
							>
								{iconId ? (
									<i className={`fid fid-${iconId}`} style={{ fontSize: '24px' }}></i>
								) : (
									<span
										style={{
											display: 'flex',
											alignItems: 'center',
											justifyContent: 'center',
											height: '24px',
											width: '24px',
											borderRadius: '50%',
											fontSize: '12px',
											fontWeight: 'bold',
											textTransform: 'uppercase',
											background: 'linear-gradient(to bottom right, #667eea, #764ba2)',
											color: 'white',
										}}
									>
										{subforum.name.charAt(0)}
									</span>
								)}
							</a>
						</div>
					)
				})}
			</div>
		</div>
	)
}
