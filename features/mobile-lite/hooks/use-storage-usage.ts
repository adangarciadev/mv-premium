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

type StorageAreaWithUsage = typeof browser.storage.local & {
	getBytesInUse?: (keys?: string | string[] | null) => Promise<number>
	getKeys?: () => Promise<string[]>
	QUOTA_BYTES?: number
}

function estimateBytes(items: Record<string, unknown>): number {
	try {
		return new TextEncoder().encode(JSON.stringify(items)).length
	} catch {
		return 0
	}
}

function buildStorageUsage(used: number, quota: number, items: number): StorageUsage {
	return {
		used,
		quota,
		items,
		percentage: quota > 0 ? Math.min((used / quota) * 100, 100) : 0,
	}
}

async function readItemCount(local: StorageAreaWithUsage): Promise<number> {
	if (typeof local.getKeys === 'function') {
		return (await local.getKeys()).length
	}

	const items = (await local.get(null)) as Record<string, unknown>
	return Object.keys(items).length
}

export async function readMobileLiteStorageUsage(): Promise<StorageUsage> {
	const local = browser.storage.local as StorageAreaWithUsage
	const quota = local.QUOTA_BYTES || DEFAULT_QUOTA_BYTES

	if (typeof local.getBytesInUse === 'function') {
		try {
			const used = await local.getBytesInUse(null)
			const items = await readItemCount(local)
			return buildStorageUsage(used, quota, items)
		} catch {
			// Fall through to the compatibility path below.
		}
	}

	const items = (await local.get(null)) as Record<string, unknown>
	return buildStorageUsage(estimateBytes(items), quota, Object.keys(items).length)
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
		void readMobileLiteStorageUsage()
			.then(nextUsage => {
				if (!mounted) return
				setUsage(nextUsage)
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
