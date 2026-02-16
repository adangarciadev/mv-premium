import { toast } from '@/lib/lazy-toast'
import { TOAST_IDS, TOAST_TIMINGS } from '@/constants'

let lastToast: { key: string; at: number } | null = null

function showThreadSaveToast(type: 'success' | 'error', message: string): void {
	const now = Date.now()
	const key = `${type}:${message}`
	if (lastToast && lastToast.key === key && now - lastToast.at < TOAST_TIMINGS.DEDUP_MS) {
		return
	}
	lastToast = { key, at: now }

	if (type === 'success') {
		toast.success(message, { id: TOAST_IDS.THREAD_SAVE_ACTION })
		return
	}

	toast.error(message, { id: TOAST_IDS.THREAD_SAVE_ACTION })
}

export function showSavedThreadToggledToast(isSaved: boolean): void {
	showThreadSaveToast('success', isSaved ? 'Hilo guardado' : 'Hilo eliminado de guardados')
}

export function showSaveThreadErrorToast(message = 'Error al guardar el hilo'): void {
	showThreadSaveToast('error', message)
}
