import { defineContentScript } from '#imports'
import { TAVERN_ORIGIN } from '@/features/tavern/location'
import { prefillTavernLobby, joinPanelRoom } from '@/features/tavern/prefill'

export default defineContentScript({
	matches: [`${TAVERN_ORIGIN}/`],
	allFrames: true,
	runAt: 'document_start',
	main(ctx) {
		if (window.parent !== window && document.referrer === 'https://www.mediavida.com/' &&
			joinPanelRoom(new URL(location.href), path => location.replace(path))) return
		const fill = () => {
			const cleanup = prefillTavernLobby()
			if (cleanup) ctx.onInvalidated(cleanup)
		}
		if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fill, { once: true })
		else fill()
	},
})
