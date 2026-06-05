import { useCallback, useEffect, useMemo, useState } from 'react'
import ArrowDown from 'lucide-react/dist/esm/icons/arrow-down'
import ArrowUp from 'lucide-react/dist/esm/icons/arrow-up'
import BookmarkPlus from 'lucide-react/dist/esm/icons/bookmark-plus'
import Check from 'lucide-react/dist/esm/icons/check'
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down'
import Settings from 'lucide-react/dist/esm/icons/settings'
import X from 'lucide-react/dist/esm/icons/x'
import { getThreadId, isThreadUrl } from '@/lib/url-helpers'
import { isThreadSaved, saveThread, watchSavedThreads } from '@/features/saved-threads/logic/storage'
import { useSettingsStore } from '@/store/settings-store'

type SaveState = 'idle' | 'saved' | 'unavailable' | 'error'

function scrollToTop(): void {
	window.scrollTo({ top: 0, behavior: 'smooth' })
}

function scrollToBottom(): void {
	const bottom = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)
	window.scrollTo({ top: bottom, behavior: 'smooth' })
}

export function MobileLiteFloatingButton() {
	const [open, setOpen] = useState(false)
	const [saveState, setSaveState] = useState<SaveState>('idle')
	const currentThreadId = useMemo(() => getThreadId(), [])
	const isThread = useMemo(() => isThreadUrl(currentThreadId), [currentThreadId])
	const enabled = useSettingsStore(state => state.mobileLiteEnabled)
	const setSetting = useSettingsStore(state => state.setSetting)

	const refreshSavedState = useCallback(async () => {
		if (!isThread) {
			setSaveState('unavailable')
			return
		}

		try {
			setSaveState((await isThreadSaved(currentThreadId)) ? 'saved' : 'idle')
		} catch {
			setSaveState('error')
		}
	}, [currentThreadId, isThread])

	useEffect(() => {
		if (!isThread) {
			setSaveState('unavailable')
			return
		}

		let cancelled = false
		refreshSavedState().catch(() => {
			if (!cancelled) {
				setSaveState('error')
			}
		})

		const unwatch = watchSavedThreads(threads => {
			if (!cancelled) {
				setSaveState(threads.some(thread => thread.id === currentThreadId) ? 'saved' : 'idle')
			}
		})

		return () => {
			cancelled = true
			unwatch()
		}
	}, [currentThreadId, isThread, refreshSavedState])

	const handleSaveThread = async () => {
		if (!isThread) {
			setSaveState('unavailable')
			return
		}

		if (saveState === 'saved') {
			return
		}

		try {
			await saveThread()
			await refreshSavedState()
		} catch {
			setSaveState('error')
		}
	}

	if (!enabled) return null

	return (
		<div
			className="fixed z-[99999] flex max-w-[calc(100vw-1.5rem)] flex-col items-end gap-2 text-sm"
			style={{
				bottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)',
				right: 'calc(env(safe-area-inset-right, 0px) + 0.75rem)',
			}}
		>
			{open && (
				<section
					className="mb-1 w-[min(19rem,calc(100vw-1.5rem))] overflow-y-auto rounded-md border border-border bg-background p-3 text-foreground shadow-2xl"
					style={{
						maxHeight:
							'calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 5.5rem)',
					}}
				>
					<div className="mb-3 flex items-start justify-between gap-3">
						<div>
							<p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">MV Premium</p>
							<p className="text-sm font-semibold">Mobile Lite experimental</p>
						</div>
						<button
							type="button"
							className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
							aria-label="Cerrar panel Mobile Lite"
							onClick={() => setOpen(false)}
						>
							<X className="h-4 w-4" aria-hidden="true" />
						</button>
					</div>

					<div className="mb-3 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
						<Settings className="mr-2 inline h-3.5 w-3.5 align-[-2px]" aria-hidden="true" />
						Mobile Lite activo solo en Firefox Android.
					</div>

					<div className="grid gap-2">
						<button
							type="button"
							className="flex min-h-11 w-full items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-left text-sm font-medium hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-70"
							onClick={handleSaveThread}
							disabled={!isThread || saveState === 'saved'}
						>
							<span>{saveState === 'saved' ? 'Guardado' : 'Guardar hilo'}</span>
							{saveState === 'saved' ? (
								<Check className="h-4 w-4 shrink-0" aria-hidden="true" />
							) : (
								<BookmarkPlus className="h-4 w-4 shrink-0" aria-hidden="true" />
							)}
						</button>

						<div className="grid grid-cols-2 gap-2">
							<button
								type="button"
								className="flex min-h-11 items-center justify-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
								onClick={scrollToTop}
							>
								<ArrowUp className="h-4 w-4 shrink-0" aria-hidden="true" />
								Arriba
							</button>
							<button
								type="button"
								className="flex min-h-11 items-center justify-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
								onClick={scrollToBottom}
							>
								<ArrowDown className="h-4 w-4 shrink-0" aria-hidden="true" />
								Abajo
							</button>
						</div>

						<button
							type="button"
							className="min-h-10 rounded-md px-3 py-2 text-xs text-muted-foreground hover:bg-muted"
							onClick={() => {
								setOpen(false)
								setSetting('mobileLiteEnabled', false)
							}}
						>
							Desactivar Mobile Lite
						</button>

						{saveState === 'unavailable' && <p className="text-xs text-muted-foreground">El guardado local solo aparece en hilos.</p>}
						{saveState === 'error' && <p className="text-xs text-destructive">No se pudo comprobar o guardar el hilo.</p>}
					</div>
				</section>
			)}

			<button
				type="button"
				className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-background/95 text-foreground opacity-90 shadow-lg hover:bg-accent hover:text-accent-foreground hover:opacity-100"
				aria-label={open ? 'Cerrar Mobile Lite' : 'Abrir Mobile Lite'}
				aria-expanded={open}
				onClick={() => setOpen(value => !value)}
			>
				<ChevronDown className={`h-4 w-4 transition-transform ${open ? '' : 'rotate-180'}`} aria-hidden="true" />
			</button>
		</div>
	)
}
