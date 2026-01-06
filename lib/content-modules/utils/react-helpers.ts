/**
 * React Root Manager - Centralized management of React roots for content scripts
 *
 * Features:
 * - Singleton registry to prevent duplicate roots
 * - Automatic cleanup when DOM elements are removed
 * - Feature-based identification for easy debugging
 * - Memory leak prevention
 */
import { createRoot, Root } from 'react-dom/client'
import { ReactNode, createElement } from 'react'
import { FeatureErrorBoundary } from '@/components/feature-error-boundary'
import { LiteAppProvider } from '@/providers/lite-app-provider'

// =============================================================================
// TYPES
// =============================================================================

interface MountedRoot {
	root: Root
	container: Element
	featureId: string
	mountedAt: number
}

// =============================================================================
// ROOT REGISTRY
// =============================================================================

/**
 * Global registry of all mounted React roots
 * Key: featureId (unique identifier per mount point)
 */
const rootRegistry = new Map<string, MountedRoot>()

/**
 * WeakMap for quick container -> featureId lookup
 */
const containerToFeature = new WeakMap<Element, string>()

/**
 * Set of elements being observed for removal
 */
const observedContainers = new Set<Element>()

/**
 * MutationObserver for automatic cleanup when containers are removed from DOM
 */
let cleanupObserver: MutationObserver | null = null

function ensureCleanupObserver(): void {
	if (cleanupObserver) return

	cleanupObserver = new MutationObserver(mutations => {
		for (const mutation of mutations) {
			for (const removedNode of mutation.removedNodes) {
				if (removedNode instanceof Element) {
					// Check if the removed node or any of its children is a mounted container
					checkAndCleanupRemovedElements(removedNode)
				}
			}
		}
	})

	cleanupObserver.observe(document.body, {
		childList: true,
		subtree: true,
	})
}

function checkAndCleanupRemovedElements(element: Element): void {
	// Check the element itself
	const featureId = containerToFeature.get(element)
	if (featureId) {
		unmountFeature(featureId)
	}

	// Check all descendants
	observedContainers.forEach(container => {
		if (element.contains(container) || element === container) {
			const id = containerToFeature.get(container)
			if (id) {
				unmountFeature(id)
			}
		}
	})
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Mount a React component to a container with a unique feature ID.
 * If already mounted with the same featureId, re-renders the component.
 *
 * IMPORTANT: All components are automatically wrapped with LiteAppProvider,
 * giving access to ThemeProvider and ThemeColorsProvider.
 *
 * NOTE: LiteAppProvider does NOT include TanStack Query or Toaster to keep bundle size small.
 * For features that need React Query, pass withProviders: false and wrap manually.
 * For toasts in content scripts, use @/lib/lazy-toast (no-op stub).
 *
 * @param featureId - Unique identifier for this mount (e.g., 'thread-search')
 * @param container - DOM element to mount into
 * @param component - React component to render
 * @param options - Optional configuration
 * @returns The Root instance
 *
 * @example
 * ```tsx
 * const container = document.createElement('div');
 * document.body.appendChild(container);
 * mountFeature('my-feature', container, <MyComponent />);
 * ```
 */
export function mountFeature(
	featureId: string,
	container: Element,
	component: ReactNode,
	options: { withProviders?: boolean } = {}
): Root {
	const { withProviders = true } = options

	ensureCleanupObserver()

	let mounted = rootRegistry.get(featureId)

	// Wrap component with LiteAppProvider if enabled (default: true)
	// NOTE: Uses LiteAppProvider (no TanStack Query, no Toaster) to keep content script bundle small
	const wrappedComponent = withProviders ? createElement(LiteAppProvider, { darkMode: true }, component) : component

	if (mounted) {
		// Already mounted - just re-render
		mounted.root.render(wrappedComponent)
		return mounted.root
	}

	// Create new root
	const root = createRoot(container)
	root.render(wrappedComponent)

	// Register
	mounted = {
		root,
		container,
		featureId,
		mountedAt: Date.now(),
	}

	rootRegistry.set(featureId, mounted)
	containerToFeature.set(container, featureId)
	observedContainers.add(container)

	return root
}

/**
 * Re-render a component for an existing feature mount.
 * Does nothing if the feature is not mounted.
 * Components are automatically wrapped with LiteAppProvider.
 *
 * @param featureId - The feature ID used when mounting
 * @param component - The new component to render
 * @param options - Optional configuration (should match original mount options)
 */
export function updateFeature(
	featureId: string,
	component: ReactNode,
	options: { withProviders?: boolean } = {}
): void {
	const mounted = rootRegistry.get(featureId)
	if (!mounted) return

	const { withProviders = true } = options

	const wrappedComponent = withProviders ? createElement(LiteAppProvider, { darkMode: true }, component) : component

	mounted.root.render(wrappedComponent)
}

/**
 * Unmount a feature and cleanup its root.
 *
 * @param featureId - The feature ID to unmount
 */
export function unmountFeature(featureId: string): void {
	const mounted = rootRegistry.get(featureId)
	if (!mounted) return

	try {
		mounted.root.unmount()
	} catch (e) {
		// Ignore unmount errors (element may already be removed)
	}

	containerToFeature.delete(mounted.container)
	observedContainers.delete(mounted.container)
	rootRegistry.delete(featureId)
}

/**
 * Check if a feature is currently mounted.
 *
 * @param featureId - The feature ID to check
 */
export function isFeatureMounted(featureId: string): boolean {
	return rootRegistry.has(featureId)
}

/**
 * Get the root for a feature (if mounted).
 * Useful for manual re-renders.
 */
export function getFeatureRoot(featureId: string): Root | null {
	return rootRegistry.get(featureId)?.root ?? null
}

/**
 * Get debug info about all mounted features.
 */
export function getMountedFeatures(): string[] {
	return Array.from(rootRegistry.keys())
}

// =============================================================================
// ERROR BOUNDARY HELPERS
// =============================================================================

/**
 * Mount a React component with automatic error boundary wrapping.
 * If the component throws, it will be caught and logged without crashing other features.
 *
 * @param featureId - Unique identifier for this mount
 * @param container - DOM element to mount into
 * @param component - React component to render
 * @param featureDisplayName - Human-readable name for error messages (defaults to featureId)
 * @returns The Root instance
 *
 * @example
 * ```tsx
 * mountFeatureWithBoundary(
 *   'thread-search',
 *   container,
 *   <ThreadSearchDialog />,
 *   'Buscador de Hilo'
 * );
 * ```
 */
export function mountFeatureWithBoundary(
	featureId: string,
	container: Element,
	component: ReactNode,
	featureDisplayName?: string
): Root {
	// Use createElement to wrap the component with an error boundary
	const wrappedComponent = createElement(
		FeatureErrorBoundary,
		{ featureName: featureDisplayName || featureId },
		component
	)

	return mountFeature(featureId, container, wrappedComponent)
}

// Legacy APIs removed - use mountFeature/unmountFeature instead

// =============================================================================
// INJECTION HELPERS
// =============================================================================

/**
 * Check if an element already has our injection marker
 */
export function isAlreadyInjected(element: Element, marker: string): boolean {
	return element.getAttribute(marker) === 'true'
}

/**
 * Mark an element as injected
 */
export function markAsInjected(element: Element, marker: string): void {
	element.setAttribute(marker, 'true')
}

/**
 * Create a container element and append it to a parent
 */
export function createContainer(options: {
	className?: string
	id?: string
	style?: Partial<CSSStyleDeclaration>
	parent: Element
	insertPosition?: 'prepend' | 'append' | 'before' | 'after'
	referenceNode?: Node | null
}): HTMLDivElement {
	const container = document.createElement('div')

	if (options.id) {
		container.id = options.id
	}

	if (options.className) {
		container.className = options.className
	}

	if (options.style) {
		Object.assign(container.style, options.style)
	}

	switch (options.insertPosition) {
		case 'prepend':
			options.parent.insertBefore(container, options.parent.firstChild)
			break
		case 'before':
			options.parent.parentNode?.insertBefore(container, options.parent)
			break
		case 'after':
			options.parent.parentNode?.insertBefore(container, options.parent.nextSibling)
			break
		case 'append':
		default:
			options.parent.appendChild(container)
			break
	}

	return container
}
