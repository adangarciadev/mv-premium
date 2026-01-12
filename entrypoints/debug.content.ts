import { defineContentScript } from '#imports'
import { logger } from '@/lib/logger'

export default defineContentScript({
	matches: ['*://www.mediavida.com/*'],
	world: 'MAIN',
	main() {
		// Define the global debug helper in the Main World
		// @ts-ignore - Signature differs from Isolated World interface
		window.mvpDebug = () => {
			logger.info('MVP: Dispatching debug request...')
			document.dispatchEvent(new CustomEvent('MVP_DEBUG_REQ'))
			return '🔍 Inspecting... Check the "Console" tab. Take a screenshot!'
		}

		logger.info('MVP: Debug bridge initialized. Type mvpDebug() to inspect storage.')
	},
})
