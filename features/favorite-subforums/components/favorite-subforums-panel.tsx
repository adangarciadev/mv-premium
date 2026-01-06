/**
 * FavoriteSubforumsPanel - Display and manage favorite subforums in Profile UI
 * Uses CSS classes from profile-styles.ts
 */
import ExternalLink from 'lucide-react/dist/esm/icons/external-link'
import Trash2 from 'lucide-react/dist/esm/icons/trash-2'
import Star from 'lucide-react/dist/esm/icons/star'
import RefreshCw from 'lucide-react/dist/esm/icons/refresh-cw'
import { useState, useEffect, useCallback } from 'react'
import { logger } from '@/lib/logger'
import { getFavoriteSubforums, removeFavoriteSubforum } from '@/features/favorite-subforums/logic/storage'
import { subscribeFavoriteSubforumsChanges } from '@/features/favorite-subforums/logic/listeners'
import type { FavoriteSubforum } from '@/types/storage'
import { MV_BASE_URL } from '@/constants'

interface FavoriteSubforumsPanelProps {
	onRefresh?: () => Promise<void>
}

/**
 * FavoriteSubforumsPanel component - Dashboard list for managing favorite subforums
 * @param onRefresh - Optional callback triggered after successful removal
 */
export function FavoriteSubforumsPanel({ onRefresh }: FavoriteSubforumsPanelProps) {
	const [subforums, setSubforums] = useState<FavoriteSubforum[]>([])
	const [isLoading, setIsLoading] = useState(true)
	const [removing, setRemoving] = useState<string | null>(null)

	/**
	 * Fetches the latest favorite subforums from storage
	 */
	const fetchSubforums = useCallback(async () => {
		try {
			setIsLoading(true)
			const data = await getFavoriteSubforums()
			// Sort alphabetically
			data.sort((a, b) => a.name.localeCompare(b.name, 'es'))
			setSubforums(data)
		} catch (err) {
			logger.error('Error fetching favorite subforums:', err)
		} finally {
			setIsLoading(false)
		}
	}, [])

	useEffect(() => {
		void fetchSubforums()

		// Subscribe to changes using centralized listener system
		const unsubscribe = subscribeFavoriteSubforumsChanges(() => void fetchSubforums())

		return unsubscribe
	}, [fetchSubforums])

	/**
	 * Removes a subforum and triggers UI refresh
	 */
	const handleRemove = async (subforumId: string) => {
		setRemoving(subforumId)
		try {
			await removeFavoriteSubforum(subforumId)
			await fetchSubforums()
			if (onRefresh) {
				await onRefresh()
			}
		} finally {
			setRemoving(null)
		}
	}

	if (isLoading) {
		return (
			<div className="loading">
				<RefreshCw size={28} className="animate-spin" />
				<p className="loading-text">Cargando...</p>
			</div>
		)
	}

	if (subforums.length === 0) {
		return (
			<div className="empty-state">
				<Star size={36} className="empty-icon" />
				<p className="empty-title">No tienes subforos favoritos</p>
				<span className="empty-subtitle">Marca subforos como favoritos usando la estrella ★ junto a cada foro</span>
			</div>
		)
	}

	return (
		<div className="profile-panel">
			<div className="panel-header">
				<h3 className="panel-title">Subforos Favoritos</h3>
				<span className="panel-badge">{subforums.length}</span>
			</div>

			<div className="subforum-list">
				{subforums.map(subforum => (
					<div key={subforum.id} className="list-item subforum-item">
						<div className="list-item-header">
							<div className="subforum-info">
								{subforum.iconClass && <i className={subforum.iconClass} aria-hidden="true" />}
								<div className="subforum-details">
									<a
										href={`${MV_BASE_URL}${subforum.url}`}
										target="_blank"
										rel="noopener noreferrer"
										className="list-item-title"
									>
										{subforum.name}
										<ExternalLink size={12} />
									</a>
									{subforum.description && <span className="subforum-description">{subforum.description}</span>}
								</div>
							</div>
							<button
								onClick={() => handleRemove(subforum.id)}
								disabled={removing === subforum.id}
								className="btn-danger"
								title="Quitar de favoritos"
							>
								<Trash2 size={15} />
							</button>
						</div>
					</div>
				))}
			</div>
		</div>
	)
}
