import { browser } from 'wxt/browser'
import ExternalLink from 'lucide-react/dist/esm/icons/external-link'
import { logger } from '@/lib/logger'
import { sendMessage } from '@/lib/messaging'
import { cn } from '@/lib/utils'

/** The settings tab holding the football-data.org key. */
const FOOTBALL_SETTINGS_VIEW = 'settings?tab=integrations'

/**
 * Opens the extension's settings on the integrations tab.
 *
 * It has to go through the background script: a plain link to the
 * `chrome-extension://` options page is blocked by the browser when it comes
 * from a content script, which is what made the old anchor dead on click.
 */
async function openFootballSettings(): Promise<void> {
	try {
		await sendMessage('openOptionsPage', FOOTBALL_SETTINGS_VIEW)
		return
	} catch (error) {
		logger.error('Football calendar: opening settings via message failed', error)
	}

	try {
		window.open(
			`${browser.runtime.getURL('/options.html')}#/${FOOTBALL_SETTINGS_VIEW}`,
			'_blank',
			'noopener,noreferrer'
		)
	} catch (error) {
		logger.error('Football calendar: settings fallback failed', error)
	}
}

export function SettingsLink({ className }: { className?: string }) {
	return (
		<button
			type="button"
			onClick={() => void openFootballSettings()}
			className={cn(
				'inline-flex shrink-0 items-center gap-1 font-bold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
				className
			)}
		>
			Ajustes
			<ExternalLink className="h-3 w-3" aria-hidden="true" />
		</button>
	)
}
