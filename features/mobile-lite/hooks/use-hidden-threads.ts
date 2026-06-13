import { useEffect, useMemo, useState, type RefObject } from 'react'
import {
	clearHiddenThreads,
	getHiddenThreads,
	unhideThread,
	watchHiddenThreads,
	type HiddenThread,
} from '@/features/hidden-threads/logic/storage'
import { getSubforumSlugFromId } from '../components/panel-helpers'
import { useAutoDismiss } from './use-auto-dismiss'

/**
 * Hidden-threads management: the live list, search query, and the
 * restore-one / restore-all flows (both optimistic, with scroll preservation).
 */
export function useHiddenThreads({
	open,
	panelBodyRef,
}: {
	open: boolean
	panelBodyRef: RefObject<HTMLDivElement | null>
}) {
	const [hiddenThreads, setHiddenThreads] = useState<HiddenThread[]>([])
	const [hiddenThreadQuery, setHiddenThreadQuery] = useState('')
	const [restoringThread, setRestoringThread] = useState<string | null>(null)
	const [clearingHiddenThreads, setClearingHiddenThreads] = useState(false)
	const [confirmClearHiddenThreads, setConfirmClearHiddenThreads] = useState(false)
	const [statusMessage, setStatusMessage] = useState<string | null>(null)
	const [errorMessage, setErrorMessage] = useState<string | null>(null)

	useAutoDismiss(statusMessage, setStatusMessage)

	useEffect(() => {
		let unwatchHiddenThreads: (() => void) | null = null
		try {
			unwatchHiddenThreads = watchHiddenThreads(nextThreads => {
				setHiddenThreads(nextThreads)
			})
		} catch {
			// Hidden-thread management should not prevent the panel from opening.
		}

		return () => {
			unwatchHiddenThreads?.()
		}
	}, [])

	useEffect(() => {
		if (!open) return

		let mounted = true
		getHiddenThreads()
			.then(nextThreads => {
				if (mounted) setHiddenThreads(nextThreads)
			})
			.catch(() => {
				if (mounted) setErrorMessage('No se pudieron cargar los hilos ocultos.')
			})

		return () => {
			mounted = false
		}
	}, [open])

	const filteredHiddenThreads = useMemo(() => {
		const normalizedQuery = hiddenThreadQuery.trim().toLowerCase()
		if (!normalizedQuery) return hiddenThreads

		return hiddenThreads.filter(thread => {
			return (
				thread.title.toLowerCase().includes(normalizedQuery) ||
				thread.subforum.toLowerCase().includes(normalizedQuery) ||
				getSubforumSlugFromId(thread.subforumId).toLowerCase().includes(normalizedQuery)
			)
		})
	}, [hiddenThreadQuery, hiddenThreads])

	const restoreHiddenThread = async (thread: HiddenThread) => {
		const previousThreads = hiddenThreads
		const previousScrollTop = panelBodyRef.current?.scrollTop
		setRestoringThread(thread.id)
		setStatusMessage(null)
		setErrorMessage(null)
		setHiddenThreads(currentThreads => currentThreads.filter(currentThread => currentThread.id !== thread.id))
		try {
			await unhideThread(thread.id)
			const nextThreads = await getHiddenThreads()
			setHiddenThreads(nextThreads)
			if (previousScrollTop !== undefined) {
				window.requestAnimationFrame(() => {
					if (panelBodyRef.current) panelBodyRef.current.scrollTop = previousScrollTop
				})
			}
		} catch {
			setHiddenThreads(previousThreads)
			setErrorMessage('No se pudo restaurar el hilo. Inténtalo de nuevo.')
		} finally {
			setRestoringThread(null)
		}
	}

	const restoreAllHiddenThreads = async () => {
		setClearingHiddenThreads(true)
		setStatusMessage(null)
		setErrorMessage(null)
		try {
			await clearHiddenThreads()
			setHiddenThreads([])
			setHiddenThreadQuery('')
			setConfirmClearHiddenThreads(false)
		} catch {
			setErrorMessage('No se pudieron restaurar todos los hilos. Inténtalo de nuevo.')
		} finally {
			setClearingHiddenThreads(false)
		}
	}

	return {
		hiddenThreads,
		hiddenThreadQuery,
		setHiddenThreadQuery,
		filteredHiddenThreads,
		restoringThread,
		clearingHiddenThreads,
		confirmClearHiddenThreads,
		setConfirmClearHiddenThreads,
		statusMessage,
		errorMessage,
		restoreHiddenThread,
		restoreAllHiddenThreads,
	}
}
