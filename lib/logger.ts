/**
 * Simple logger utility for standardized logging across the extension.
 * Helps with filtering and identifying extension logs.
 */

const PREFIX = '[MVP]'

class Logger {
	/**
	 * Debug logs - Only visible in development
	 */
	debug(message: string, ...args: unknown[]) {
		// @ts-ignore - import.meta.env is provided by WXT/Vite
		if (import.meta.env.DEV) {
			console.debug(`%c${PREFIX} 🐛 ${message}`, 'color: #8b5cf6', ...args)
		}
	}

	/**
	 * Info logs - General information
	 */
	info(message: string, ...args: unknown[]) {
		console.info(`%c${PREFIX} ℹ️ ${message}`, 'color: #3b82f6', ...args)
	}

	/**
	 * Warning logs - Potential issues
	 */
	warn(message: string, ...args: unknown[]) {
		console.warn(`%c${PREFIX} ⚠️ ${message}`, 'color: #f59e0b', ...args)
	}

	/**
	 * Error logs - Critical failures
	 */
	error(message: string, ...args: unknown[]) {
		console.error(`%c${PREFIX} ❌ ${message}`, 'color: #ef4444', ...args)
	}
}

export const logger = new Logger()
