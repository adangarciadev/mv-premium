import { useRef, useEffect, forwardRef } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { parseBBCode } from './parser'
import { MV_STYLES } from './mv-styles' // Import the constant string
import { SteamGameCard } from './steam-game-card'
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

			// 1. Create or get Shadow Root
			const shadow = container.shadowRoot || container.attachShadow({ mode: 'open' })

			// 2. Check if content is empty
			const isEmpty = !content.trim()

			// 3. Cleanup previous Steam roots before re-rendering
			steamRootsRef.current.forEach(root => {
				try {
					root.unmount()
				} catch (e) {
					// Ignore unmount errors
				}
			})
			steamRootsRef.current.clear()

			// 4. Handle empty state immediately
			if (isEmpty) {
				shadow.innerHTML = `
            <style>
                ${MV_STYLES}
                .empty-state {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    height: 300px;
                    color: #888;
                    text-align: center;
                    gap: 12px;
                    user-select: none;
                }
                .empty-state svg {
                    width: 48px;
                    height: 48px;
                    opacity: 0.4;
                }
                .empty-state p {
                    font-size: 14px;
                    opacity: 0.8;
                    margin: 0;
                }
            </style>
            <div class="empty-state">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>
                <p>Empieza a escribir en el editor para ver aquí la previsualización al estilo Mediavida.</p>
            </div>
        `
				return
			}

			// 5. Show loading placeholder while parsing (optional - very fast usually)
			const fontSizeStyle = fontSize ? `--mv-font-size: ${fontSize}px;` : ''
			shadow.innerHTML = `
        <style>
            ${MV_STYLES}
            :host { --mv-bold-color: ${boldColor}; ${fontSizeStyle} }
        </style>
        <div class="posts-contents" id="content-container">
            <!-- Content loading... -->
        </div>
    `

			// 6. Parse content async and update when ready
			const parseAndRender = async () => {
				try {
					const htmlContent = await parseBBCode(content)

					// Re-inject with parsed content
					shadow.innerHTML = `
                <style>
                    ${MV_STYLES}
                    :host { --mv-bold-color: ${boldColor}; ${fontSizeStyle} }
                </style>
                <div class="posts-contents" id="content-container">
                    ${htmlContent}
                </div>
            `

					// Re-bind Spoiler Events
					const triggers = shadow.querySelectorAll('a.spoiler')
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
					const steamPlaceholders = shadow.querySelectorAll('.steam-embed-placeholder[data-steam-appid]')
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
				} catch (error) {
					logger.error('Error parsing BBCode:', error)
				}
			}

			void parseAndRender()
		}, [content, useDirectFetch, boldColor, fontSize]) // Re-run whenever content, boldColor or fontSize changes

		// Cleanup on unmount
		useEffect(() => {
			return () => {
				steamRootsRef.current.forEach(root => {
					try {
						root.unmount()
					} catch (e) {
						// Ignore unmount errors
					}
				})
				steamRootsRef.current.clear()
			}
		}, [])

		return <div ref={internalRef} className={className} style={{ display: 'block', overflow: 'hidden' }} />
	}
)

MVPreview.displayName = 'MVPreview'
