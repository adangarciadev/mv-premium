import { useCallback, useEffect, useRef, useState } from 'react'
import EyeOff from 'lucide-react/dist/esm/icons/eye-off'
import Eye from 'lucide-react/dist/esm/icons/eye'
import { logger } from '@/lib/logger'
import { toast } from '@/lib/lazy-toast'
import { cn } from '@/lib/utils'
import { isSubforumFavorite } from '@/features/favorite-subforums/logic/storage'
import { subscribeFavoriteSubforumsChanges } from '@/features/favorite-subforums/logic/listeners'
import {
	HIDDEN_SUBFORUM_ERROR_CODES,
	isSubforumHidden,
	toggleHiddenSubforum,
} from '@/features/hidden-subforums/logic/storage'
import { subscribeHiddenSubforumsChanges } from '@/features/hidden-subforums/logic/listeners'
import type { HiddenSubforum } from '@/types/storage'

interface HiddenSubforumButtonProps {
	subforum: Omit<HiddenSubforum, 'hiddenAt'>
	size?: number
	className?: string
}

export function HiddenSubforumButton({ subforum, size = 16, className = '' }: HiddenSubforumButtonProps) {
	const [isHidden, setIsHidden] = useState(false)
	const [isFavorite, setIsFavorite] = useState(false)
	const [isInitializing, setIsInitializing] = useState(true)
	const isTogglingRef = useRef(false)

	useEffect(() => {
		let cancelled = false

		const loadState = async () => {
			try {
				const [hiddenResult, favoriteResult] = await Promise.all([
					isSubforumHidden(subforum.id),
					isSubforumFavorite(subforum.id),
				])
				if (!cancelled) {
					setIsHidden(hiddenResult)
					setIsFavorite(favoriteResult)
					setIsInitializing(false)
				}
			} catch (error) {
				logger.error('Error loading hidden subforum state:', error)
				if (!cancelled) {
					setIsInitializing(false)
				}
			}
		}

		void loadState()

		const unsubscribe = subscribeHiddenSubforumsChanges(() => {
			if (!isTogglingRef.current) {
				void loadState()
			}
		})
		const unsubscribeFavorites = subscribeFavoriteSubforumsChanges(() => {
			if (!isTogglingRef.current) {
				void loadState()
			}
		})

		return () => {
			cancelled = true
			unsubscribe()
			unsubscribeFavorites()
		}
	}, [subforum.id])

	const handleClick = useCallback(
		async (event: React.MouseEvent) => {
			event.preventDefault()
			event.stopPropagation()

			if (isTogglingRef.current || isInitializing) return
			if (isFavorite && !isHidden) {
				toast.info('Quita el subforo de favoritos antes de ocultarlo')
				return
			}

			const previousState = isHidden
			setIsHidden(!previousState)
			isTogglingRef.current = true

			try {
				const result = await toggleHiddenSubforum(subforum)
				setIsHidden(result.isHidden)

				if (result.isHidden) {
					toast.success(`${subforum.name} oculto`)
				} else {
					toast.success(`${subforum.name} visible de nuevo`)
				}
			} catch (error) {
				setIsHidden(previousState)
				logger.error('Error toggling hidden subforum:', error)
				if (error instanceof Error && error.message === HIDDEN_SUBFORUM_ERROR_CODES.FAVORITE_CONFLICT) {
					toast.info('Quita el subforo de favoritos antes de ocultarlo')
				} else {
					toast.error('Error al actualizar subforos ocultos')
				}
			} finally {
				isTogglingRef.current = false
			}
		},
		[subforum, isFavorite, isHidden, isInitializing]
	)

	return (
		<button
			type="button"
			onClick={handleClick}
			disabled={isInitializing}
			className={cn(
				'flex items-center justify-center h-8 w-8 rounded-lg',
				'bg-transparent text-muted-foreground cursor-pointer transition-all duration-150 relative',
				'hover:bg-muted hover:border hover:border-border hover:text-destructive',
				'disabled:cursor-not-allowed disabled:opacity-50',
				isHidden && 'text-destructive hover:text-destructive/80',
				isFavorite && !isHidden && 'text-muted-foreground/50 hover:text-muted-foreground/50',
				className
			)}
			title={isFavorite && !isHidden ? 'Quita este subforo de favoritos antes de ocultarlo' : isHidden ? 'Mostrar subforo' : 'Ocultar subforo'}
			aria-label={isFavorite && !isHidden ? 'Quita este subforo de favoritos antes de ocultarlo' : isHidden ? 'Mostrar subforo' : 'Ocultar subforo'}
		>
			{isHidden ? <Eye size={size} /> : <EyeOff size={size} />}
		</button>
	)
}
