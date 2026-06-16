import EyeOff from 'lucide-react/dist/esm/icons/eye-off'
import RotateCcw from 'lucide-react/dist/esm/icons/rotate-ccw'
import Search from 'lucide-react/dist/esm/icons/search'
import { NativeFidIcon } from '@/components/native-fid-icon'
import { getSubforumIconId } from '@/lib/subforums'
import type { HiddenThread } from '@/features/hidden-threads/logic/storage'
import { formatHiddenThreadDate, getSubforumSlugFromId } from '../panel-helpers'
import { GROUP_CLASS, INPUT_CLASS, ROW_ICON_BASE_CLASS } from '../panel-tokens'

export function ThreadsTab({
	hiddenThreads,
	hiddenThreadQuery,
	filteredHiddenThreads,
	restoringThread,
	clearingHiddenThreads,
	onHiddenThreadQueryChange,
	onRequestClearAll,
	onRestoreThread,
}: {
	hiddenThreads: HiddenThread[]
	hiddenThreadQuery: string
	filteredHiddenThreads: HiddenThread[]
	restoringThread: string | null
	clearingHiddenThreads: boolean
	onHiddenThreadQueryChange: (value: string) => void
	onRequestClearAll: () => void
	onRestoreThread: (thread: HiddenThread) => void
}) {
	if (hiddenThreads.length === 0) {
		return (
			<div className="px-6 py-12 text-center">
				<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#242a36]">
					<EyeOff className="h-5 w-5 text-[#8b95a3]" aria-hidden="true" />
				</div>
				<p className="text-sm font-semibold text-[#eef1f6]">No hay hilos ocultos.</p>
				<p className="mx-auto mt-1.5 max-w-[20rem] text-xs leading-relaxed text-[#8b95a3]">
					Los hilos que ocultes desde los listados aparecerán aquí.
				</p>
			</div>
		)
	}

	return (
		<>
			<div className="sticky top-0 z-20 -mx-4 bg-[#1c1f27] px-4 pb-2 pt-1">
				<label className="relative block min-w-0">
					<Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#707b8e]" aria-hidden="true" />
					<input
						type="search"
						value={hiddenThreadQuery}
						autoCapitalize="none"
						spellCheck={false}
						onChange={event => onHiddenThreadQueryChange(event.target.value)}
						placeholder="Buscar hilo o subforo"
						className={`${INPUT_CLASS} pl-10 pr-3`}
					/>
				</label>
			</div>

			<div className="mt-1 flex items-center justify-between gap-3 pl-2">
				<span className="text-xs font-semibold text-[#8b95a3]">
					{hiddenThreads.length === 1 ? '1 hilo oculto' : `${hiddenThreads.length} hilos ocultos`}
				</span>
				<button
					type="button"
					aria-label="Mostrar todos"
					className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-bold text-[#f0a020] transition-colors active:bg-[#f0a020]/10 disabled:opacity-50"
					disabled={clearingHiddenThreads}
					onClick={onRequestClearAll}
				>
					<RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
					<span>Mostrar todos</span>
				</button>
			</div>

			{filteredHiddenThreads.length === 0 ? (
				<div className="px-6 py-12 text-center">
					<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#242a36]">
						<Search className="h-5 w-5 text-[#8b95a3]" aria-hidden="true" />
					</div>
					<p className="text-sm font-semibold text-[#eef1f6]">No hay resultados.</p>
				</div>
			) : (
				<div className={`mt-2 ${GROUP_CLASS} divide-y divide-[#2d3442]`}>
					{filteredHiddenThreads.map(thread => {
						const isRestoring = restoringThread === thread.id
						const subforumSlug = getSubforumSlugFromId(thread.subforumId)
						const subforumIconId = getSubforumIconId(subforumSlug)
						const hiddenAtLabel = formatHiddenThreadDate(thread.hiddenAt)

						return (
							<article key={thread.id} className="flex items-center gap-3 py-2.5 pl-3 pr-2">
								{subforumIconId !== null && (
									<div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#14171d]">
										<NativeFidIcon iconId={subforumIconId} className="h-5 w-5 shrink-0" />
									</div>
								)}
								<div className="min-w-0 flex-1">
									<div className="line-clamp-2 text-sm font-semibold leading-snug text-[#eef1f6]">{thread.title}</div>
									<div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11px] font-medium text-[#8b95a3]">
										<span className="min-w-0 truncate">{thread.subforum}</span>
										{hiddenAtLabel && (
											<>
												<span aria-hidden="true">·</span>
												<span className="shrink-0 tabular-nums">{hiddenAtLabel}</span>
											</>
										)}
									</div>
								</div>
								<button
									type="button"
									className={`${ROW_ICON_BASE_CLASS} text-[#f0a020] active:bg-[#f0a020]/15`}
									aria-label="Mostrar"
									title="Mostrar"
									disabled={isRestoring}
									onClick={() => onRestoreThread(thread)}
								>
									<RotateCcw className="h-5 w-5" aria-hidden="true" />
								</button>
							</article>
						)
					})}
				</div>
			)}
		</>
	)
}
