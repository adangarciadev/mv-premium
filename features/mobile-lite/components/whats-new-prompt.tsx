import Check from 'lucide-react/dist/esm/icons/check'
import Gift from 'lucide-react/dist/esm/icons/gift'
import type { MobileLiteChangelogEntry } from '../logic/whats-new'
import { GROUP_CLASS, PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS, SECTION_LABEL_CLASS } from './panel-tokens'

export function MobileLiteWhatsNewPrompt({
	entry,
	changeCount,
	onOpen,
	onDismiss,
}: {
	entry: MobileLiteChangelogEntry
	changeCount: number
	onOpen: () => void
	onDismiss: () => void
}) {
	const previewChanges = entry.changes.slice(0, 3)

	return (
		<div className="pb-1">
			<div className={SECTION_LABEL_CLASS}>Novedades</div>
			<section className={GROUP_CLASS}>
				<div className="p-4">
					<div className="flex items-start gap-3">
						<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#14171d] text-[#f0a020]">
							<Gift className="h-5 w-5" aria-hidden="true" />
						</div>
						<div className="min-w-0 flex-1">
							<div className="flex flex-wrap items-center gap-2">
								<div className="text-[15px] font-semibold">Nuevo en v{entry.version}</div>
								<span className="inline-flex items-center rounded-full bg-[#f0a020] px-2 py-0.5 text-[11px] font-black text-[#221604]">
									{changeCount}
								</span>
							</div>
							<p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[#9aa5b4]">{entry.title}</p>
						</div>
					</div>

					<ul className="mt-3 space-y-1.5">
						{previewChanges.map((change, index) => (
							<li key={`${entry.version}-${index}`} className="flex gap-2 text-xs leading-relaxed text-[#cfd5db]">
								<span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#f0a020]" aria-hidden="true" />
								<span className="line-clamp-2">{change.description}</span>
							</li>
						))}
					</ul>

					<div className="mt-4 grid grid-cols-2 gap-2">
						<button type="button" className={SECONDARY_BUTTON_CLASS} onClick={onOpen}>
							Ver novedades
						</button>
						<button type="button" className={PRIMARY_BUTTON_CLASS} onClick={onDismiss}>
							<Check className="h-4 w-4" aria-hidden="true" />
							Entendido
						</button>
					</div>
				</div>
			</section>
		</div>
	)
}
