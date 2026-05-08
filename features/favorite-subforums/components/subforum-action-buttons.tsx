import { FavoriteSubforumButton } from './favorite-subforum-button'
import { HiddenSubforumButton } from '@/features/hidden-subforums/components/hidden-subforum-button'
import type { FavoriteSubforum } from '@/types/storage'

interface SubforumActionButtonsProps {
	subforum: Omit<FavoriteSubforum, 'addedAt'>
	size?: number
}

export function SubforumActionButtons({ subforum, size = 16 }: SubforumActionButtonsProps) {
	return (
		<div className="flex items-center gap-1">
			<FavoriteSubforumButton subforum={subforum} size={size} />
			<HiddenSubforumButton subforum={subforum} size={size} />
		</div>
	)
}
