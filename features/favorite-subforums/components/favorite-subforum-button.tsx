/**
 * FavoriteSubforumButton - Star button to mark/unmark a subforum as favorite
 */
import { useState, useCallback, useEffect } from 'react'
import { logger } from '@/lib/logger'
import Star from 'lucide-react/dist/esm/icons/star'
import { toast } from '@/lib/lazy-toast'
import { toggleFavoriteSubforum, isSubforumFavorite } from '@/features/favorite-subforums/logic/storage'
import { subscribeFavoriteSubforumsChanges } from '@/features/favorite-subforums/logic/listeners'
import { cn } from '@/lib/utils'
import type { FavoriteSubforum } from '@/types/storage'

interface FavoriteSubforumButtonProps {
	/** Subforum data (without addedAt) */
	subforum: Omit<FavoriteSubforum, 'addedAt'>
	/** Size of the star icon */
	size?: number
	/** Additional CSS classes */
	className?: string
}

/**
 * FavoriteSubforumButton component - A star icon that toggles a subforum's favorite status.
 * Integrates with a centralized listener system to stay in sync across different contexts.
 * @param props - Component properties including subforum data and visual options
 */
export function FavoriteSubforumButton({ subforum, size = 16, className = '' }: FavoriteSubforumButtonProps) {
	const [isFavorite, setIsFavorite] = useState(false)
	const [isLoading, setIsLoading] = useState(true)

	// Load initial state from storage
	useEffect(() => {
		let cancelled = false

		const loadState = async () => {
			try {
				const favoriteResult = await isSubforumFavorite(subforum.id)
				if (!cancelled) {
					setIsFavorite(favoriteResult)
					setIsLoading(false)
				}
			} catch (err) {
				logger.error('Error loading favorite state:', err)
				if (!cancelled) {
					setIsLoading(false)
				}
			}
		}

		void loadState()

		// Subscribe to changes using centralized listener system
		// This handles both window events and storage.onChanged
		const unsubscribe = subscribeFavoriteSubforumsChanges(() => {
			void loadState()
		})

		return () => {
			cancelled = true
			unsubscribe()
		}
	}, [subforum.id])

	/**
	 * Handles the click event to add or remove the subforum from favorites
	 */
	const handleClick = useCallback(
		async (e: React.MouseEvent) => {
			e.preventDefault()
			e.stopPropagation()

			if (isLoading) return

			setIsLoading(true)
			try {
				const result = await toggleFavoriteSubforum(subforum)
				setIsFavorite(result.isFavorite)

				if (result.isFavorite) {
					toast.success(`${subforum.name} añadido a favoritos`)
				} else {
					toast.success(`${subforum.name} eliminado de favoritos`)
				}
			} catch (err) {
				logger.error('Error toggling favorite:', err)
				toast.error('Error al actualizar favoritos')
			} finally {
				setIsLoading(false)
			}
		},
		[subforum, isLoading]
	)

	return (
		<button
			type="button"
			onClick={handleClick}
			disabled={isLoading}
			className={cn(
				'flex items-center justify-center h-8 w-8 rounded-lg',
				'bg-transparent text-muted-foreground cursor-pointer transition-all duration-150 relative',
				'hover:bg-muted hover:border hover:border-border hover:text-yellow-500',
				'disabled:cursor-not-allowed disabled:opacity-50',
				isFavorite && 'text-yellow-500 hover:text-yellow-400',
				className
			)}
			title={isFavorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}
			aria-label={isFavorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}
		>
			<Star size={size} className={isLoading ? 'animate-pulse' : ''} fill={isFavorite ? 'currentColor' : 'none'} />
		</button>
	)
}
