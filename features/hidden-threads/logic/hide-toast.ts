import { toast } from '@/lib/lazy-toast'
import { TOAST_IDS } from '@/constants'
import type { ThreadPageHideNotifier } from './thread-page-hide'

/**
 * Desktop notifier: a single sonner toast updated in place each second, so the
 * user sees the countdown before being redirected. A generous per-tick duration
 * keeps the toast on screen between updates; the page navigates away (via
 * location.replace) before the final one fades.
 */
export const desktopThreadHideNotifier: ThreadPageHideNotifier = {
	onCountdown: secondsLeft => {
		toast.success(`Hilo oculto · Redirigiendo en ${secondsLeft}s`, {
			id: TOAST_IDS.THREAD_HIDE_ACTION,
			duration: (secondsLeft + 1) * 1000,
		})
	},
	onError: () => {
		toast.error('No se pudo ocultar el hilo', { id: TOAST_IDS.THREAD_HIDE_ACTION })
	},
}
