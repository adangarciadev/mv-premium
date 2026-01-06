/**
 * Type declarations for lucide-react direct icon imports
 *
 * This allows importing icons directly from their ESM paths
 * for better tree-shaking without TypeScript errors.
 *
 * Usage: import Settings from 'lucide-react/dist/esm/icons/settings'
 */

declare module 'lucide-react/dist/esm/icons/*' {
	import type { LucideIcon } from 'lucide-react'
	const icon: LucideIcon
	export default icon
}
