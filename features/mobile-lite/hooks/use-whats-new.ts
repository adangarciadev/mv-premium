import { useCallback, useEffect, useMemo, useState } from 'react'
import {
	getLatestMobileLiteEntry,
	getMobileLiteChangelog,
	hasUnseenMobileLiteChanges,
	markCurrentMobileLiteVersionAsSeen,
} from '../logic/whats-new'

/**
 * "What's new" state: the unseen badge plus the (static) changelog data. The
 * unseen flag is re-checked each time the panel opens.
 */
export function useWhatsNew(open: boolean) {
	const [hasUnseenWhatsNew, setHasUnseenWhatsNew] = useState(false)
	const latestMobileLiteEntry = useMemo(() => getLatestMobileLiteEntry(), [])
	const mobileLiteChangelog = useMemo(() => getMobileLiteChangelog(), [])
	const latestMobileLiteChangeCount = latestMobileLiteEntry?.changes.length ?? 0

	useEffect(() => {
		if (!open) return

		let mounted = true
		hasUnseenMobileLiteChanges()
			.then(hasUnseen => {
				if (mounted) setHasUnseenWhatsNew(hasUnseen)
			})
			.catch(() => {
				if (mounted) setHasUnseenWhatsNew(false)
			})

		return () => {
			mounted = false
		}
	}, [open])

	const markWhatsNewAsSeen = useCallback(async () => {
		await markCurrentMobileLiteVersionAsSeen()
		setHasUnseenWhatsNew(false)
	}, [])

	return {
		hasUnseenWhatsNew,
		latestMobileLiteEntry,
		mobileLiteChangelog,
		latestMobileLiteChangeCount,
		markWhatsNewAsSeen,
	}
}
