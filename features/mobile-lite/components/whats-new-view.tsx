import ArrowLeft from 'lucide-react/dist/esm/icons/arrow-left'
import Check from 'lucide-react/dist/esm/icons/check'
import Gift from 'lucide-react/dist/esm/icons/gift'
import type { MobileLiteChangelogEntry } from '../logic/whats-new'
import { getChangeTypeLabel } from './panel-helpers'
import { GROUP_CLASS, PRIMARY_BUTTON_CLASS, SECTION_LABEL_CLASS } from './panel-tokens'

export function MobileLiteWhatsNewView({
	entries,
	onBack,
	onDone,
}: {
	entries: MobileLiteChangelogEntry[]
	onBack: () => void
	onDone: () => void
}) {
	return (
		<div className="pb-6">
			<div className="sticky top-0 z-20 -mx-4 bg-[#1c1f27] px-4 pb-2 pt-1">
				<div className="flex items-center gap-3">
					<button
						type="button"
						aria-label="Volver"
						className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#8b95a3] transition-colors active:bg-[#2e3543]"
						onClick={onBack}
					>
						<ArrowLeft className="h-5 w-5" aria-hidden="true" />
					</button>
					<div className="min-w-0 flex-1">
						<h3 className="truncate text-base font-bold text-[#eef1f6]">Novedades Mobile Lite</h3>
						<p className="truncate text-xs text-[#8b95a3]">Cambios pensados para Firefox Android</p>
					</div>
				</div>
			</div>

			{entries.map(entry => (
				<section key={entry.version}>
					<div className={SECTION_LABEL_CLASS}>v{entry.version}</div>
					<div className={GROUP_CLASS}>
						<div className="p-4">
							<div className="flex items-start gap-3">
								<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#14171d] text-[#f0a020]">
									<Gift className="h-5 w-5" aria-hidden="true" />
								</div>
								<div className="min-w-0 flex-1">
									<div className="text-[15px] font-semibold text-[#eef1f6]">{entry.title}</div>
									{entry.summary && <p className="mt-1 text-xs leading-relaxed text-[#9aa5b4]">{entry.summary}</p>}
								</div>
							</div>
						</div>
						<div className="divide-y divide-[#2d3442]">
							{entry.changes.map((change, index) => (
								<div key={`${entry.version}-${index}`} className="flex gap-3 px-4 py-3">
									<span className="mt-0.5 inline-flex h-6 shrink-0 items-center rounded-full bg-[#14171d] px-2 text-[10px] font-bold uppercase tracking-[0.08em] text-[#f0a020]">
										{getChangeTypeLabel(change.type)}
									</span>
									<div className="min-w-0 flex-1">
										{change.category && (
											<div className="mb-0.5 truncate text-[11px] font-bold uppercase tracking-[0.14em] text-[#8b95a3]">
												{change.category}
											</div>
										)}
										<p className="text-sm leading-relaxed text-[#cfd5db]">{change.description}</p>
									</div>
								</div>
							))}
						</div>
					</div>
				</section>
			))}

			<button type="button" className={`${PRIMARY_BUTTON_CLASS} mt-5 w-full`} onClick={onDone}>
				<Check className="h-4 w-4" aria-hidden="true" />
				Entendido
			</button>
		</div>
	)
}
