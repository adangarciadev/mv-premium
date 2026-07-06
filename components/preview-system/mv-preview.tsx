// ^ Shadow DOM manipulation (shadow.innerHTML) is a legitimate pattern, not a hooks violation
import { useRef, useEffect, forwardRef } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { parseBBCode } from './parser'
import { MV_STYLES } from './mv-styles' // Import the constant string
import { SteamGameCard } from './steam-game-card'
import { GogGameCard } from './gog-game-card'
import { logger } from '@/lib/logger'

interface MVPreviewProps {
	content: string
	className?: string
	useDirectFetch?: boolean
	boldColor?: string
	theme?: 'light' | 'dark'
	fontSize?: number
}

export const MVPreview = forwardRef<HTMLDivElement, MVPreviewProps>(
	({ content, className, useDirectFetch = true, boldColor = '#c9a227', theme = 'dark', fontSize }, ref) => {
		const internalRef = useRef<HTMLDivElement>(null)
		const steamRootsRef = useRef<Map<string, Root>>(new Map())
		const gogRootsRef = useRef<Map<string, Root>>(new Map())

		// Apply theme class to host
		useEffect(() => {
			if (internalRef.current) {
				if (theme === 'light') {
					internalRef.current.classList.add('light')
					internalRef.current.classList.remove('dark')
				} else {
					internalRef.current.classList.add('dark')
					internalRef.current.classList.remove('light')
				}
			}
		}, [theme])

		// Forward ref handler
		useEffect(() => {
			if (!ref) return
			if (typeof ref === 'function') {
				ref(internalRef.current)
			} else {
				ref.current = internalRef.current
			}
		}, [ref])


		// Shadow DOM Logic
		useEffect(() => {
			const container = internalRef.current
			if (!container) return

			// 1. Initialize Shadow DOM (One-time setup)
			// We check if shadowRoot already exists to strictly avoid re-attaching or overwriting if React re-mounts the node but keeps the instance
			let shadow = container.shadowRoot
			if (!shadow) {
				shadow = container.attachShadow({ mode: 'open' })
				shadow.innerHTML = `
					<style id="static-styles">${MV_STYLES}</style>
					<style id="dynamic-styles"></style>
					<div class="post-contents" id="content-container"></div>
				`
			} else {
				// If shadow exists but is empty/broken (edge case), repair it
				if (!shadow.getElementById('content-container')) {
					shadow.innerHTML = `
						<style id="static-styles">${MV_STYLES}</style>
						<style id="dynamic-styles"></style>
						<div class="post-contents" id="content-container"></div>
					`
				}
			}
		}, [])

		// 2. Handle Dynamic Styles (Theme, Bold Color, Font Size)
		useEffect(() => {
			const container = internalRef.current
			if (!container || !container.shadowRoot) return

			const dynamicStyleSheet = container.shadowRoot.getElementById('dynamic-styles')
			if (dynamicStyleSheet) {
				const fontSizeStyle = fontSize ? `--mv-font-size: ${fontSize}px;` : ''
				dynamicStyleSheet.textContent = `
					:host { --mv-bold-color: ${boldColor}; ${fontSizeStyle} }
				`
			}
		}, [boldColor, fontSize])

		// 3. Handle Content Updates (Async parsing without clearing old content)
		useEffect(() => {
			const container = internalRef.current
			if (!container || !container.shadowRoot) return
			const shadow = container.shadowRoot
			const contentContainer = shadow.getElementById('content-container')
			if (!contentContainer) return

			// Handle empty state
			if (!content.trim()) {
				steamRootsRef.current.forEach(root => {
					try {
						root.unmount()
					} catch {}
				})
				steamRootsRef.current.clear()
				gogRootsRef.current.forEach(root => {
					try {
						root.unmount()
					} catch {}
				})
				gogRootsRef.current.clear()

				// Only update if not already in empty state
				if (!contentContainer.querySelector('.empty-state')) {
					contentContainer.innerHTML = `
						<div class="empty-state">
							<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 48px; height: 48px; opacity: 0.4;"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>
							<p style="font-size: 14px; opacity: 0.8; margin: 0;">Empieza a escribir en el editor para ver aquí la previsualización al estilo Mediavida.</p>
						</div>
					`
					// Ensure specific empty state styles exist
					const styleEl = shadow.getElementById('static-styles')
					if (styleEl && !styleEl.textContent?.includes('.empty-state')) {
						styleEl.textContent += `
							.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 300px; color: #888; text-align: center; gap: 12px; user-select: none; }
						`
					}
				}
				return
			}

			// Parse and Render
			let isMounted = true
			const parseAndRender = async () => {
				try {
					const htmlContent = await parseBBCode(content)
					if (!isMounted) return

					// Unmount hydrated cards before replacing their host elements.
					steamRootsRef.current.forEach(root => {
						try {
							root.unmount()
						} catch {}
					})
					steamRootsRef.current.clear()
					gogRootsRef.current.forEach(root => {
						try {
							root.unmount()
						} catch {}
					})
					gogRootsRef.current.clear()

					contentContainer.innerHTML = htmlContent

					// Re-bind Spoiler Events
					const triggers = contentContainer.querySelectorAll('a.spoiler')
					triggers.forEach(trigger => {
						trigger.addEventListener('click', e => {
							e.preventDefault()
							e.stopPropagation()

							const isOpen = trigger.classList.contains('open')
							const body = trigger.nextElementSibling

							if (isOpen) {
								trigger.classList.remove('open')
								if (body) body.classList.remove('visible')
							} else {
								trigger.classList.add('open')
								if (body) body.classList.add('visible')
							}
						})
					})

					// Hydrate Steam Embeds
					const steamPlaceholders = contentContainer.querySelectorAll('.steam-embed-placeholder[data-steam-appid]')
					steamPlaceholders.forEach(placeholder => {
						const appIdStr = placeholder.getAttribute('data-steam-appid')
						if (!appIdStr) return

						const appId = parseInt(appIdStr, 10)
						if (isNaN(appId)) return

						const key = `steam-${appId}-${Date.now()}-${Math.random()}`

						try {
							const root = createRoot(placeholder)
							root.render(<SteamGameCard appId={appId} useDirectFetch={useDirectFetch} />)
							steamRootsRef.current.set(key, root)
						} catch (e) {
							logger.error('Failed to hydrate Steam embed:', e)
						}
					})

					// Hydrate GOG Embeds
					const gogPlaceholders = contentContainer.querySelectorAll('.gog-embed-placeholder[data-gog-slug]')
					gogPlaceholders.forEach(placeholder => {
						const slug = placeholder.getAttribute('data-gog-slug')
						if (!slug) return

						const key = `gog-${slug}-${Date.now()}-${Math.random()}`
						try {
							const root = createRoot(placeholder)
							root.render(<GogGameCard slug={slug} useDirectFetch={useDirectFetch} />)
							gogRootsRef.current.set(key, root)
						} catch (error) {
							logger.error('Failed to hydrate GOG embed:', error)
						}
					})
				} catch (error) {
					logger.error('Error parsing BBCode:', error)
				}
			}

			void parseAndRender()

			return () => {
				isMounted = false
			}
		}, [content, useDirectFetch]) // Re-run when content changes

		// Cleanup on unmount
		useEffect(() => {
			return () => {
				steamRootsRef.current.forEach(root => {
					try {
						root.unmount()
					} catch {}
				})
				steamRootsRef.current.clear()
				gogRootsRef.current.forEach(root => {
					try {
						root.unmount()
					} catch {}
				})
				gogRootsRef.current.clear()
			}
		}, [])

		return <div ref={internalRef} className={className} style={{ display: 'block', overflow: 'hidden' }} />
	}
)

MVPreview.displayName = 'MVPreview'
