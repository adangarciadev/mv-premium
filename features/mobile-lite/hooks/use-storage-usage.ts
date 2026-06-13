import { useEffect, useState } from 'react'
import { browser } from 'wxt/browser'

// Mirrors the dashboard's fallback so both surfaces report the same quota.
const DEFAULT_QUOTA_BYTES = 5_242_880

export interface StorageUsage {
	used: number
	quota: number
	percentage: number
	items: number
}

const EMPTY_USAGE: StorageUsage = { used: 0, quota: DEFAULT_QUOTA_BYTES, percentage: 0, items: 0 }

function estimateBytes(items: Record<string, unknown>): number {
	try {
		return new TextEncoder().encode(JSON.stringify(items)).length
	} catch {
		return 0
	}
}

async function readUsedBytes(items: Record<string, unknown>): Promise<number> {
	// Firefox Android only gained storage.local.getBytesInUse recently; fall back
	// to a serialized-size estimate when it is missing or throws.
	const local = browser.storage.local as typeof browser.storage.local & {
		getBytesInUse?: (keys: null) => Promise<number>
	}
	if (typeof local.getBytesInUse === 'function') {
		try {
			return await local.getBytesInUse(null)
		} catch {
			// fall through to the estimate
		}
	}
	return estimateBytes(items)
}

/**
 * browser.storage.local usage for the panel's storage card. Mirrors the
 * dashboard calculation (bytes in use + item count, 5 MB fallback quota) so
 * both surfaces report the same figures. Recomputed each time the panel opens.
 */
export function useStorageUsage(open: boolean): StorageUsage {
	const [usage, setUsage] = useState<StorageUsage>(EMPTY_USAGE)

	useEffect(() => {
		if (!open) return

		let mounted = true
		void browser.storage.local
			.get(null)
			.then(async items => {
				const used = await readUsedBytes(items)
				if (!mounted) return

				const quota = (browser.storage.local as { QUOTA_BYTES?: number }).QUOTA_BYTES || DEFAULT_QUOTA_BYTES
				setUsage({
					used,
					quota,
					items: Object.keys(items).length,
					percentage: Math.min((used / quota) * 100, 100),
				})
			})
			.catch(() => {
				// Storage stats are informational; failing should not affect the panel.
			})

		return () => {
			mounted = false
		}
	}, [open])

	return usage
}
