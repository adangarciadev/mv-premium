import Database from 'lucide-react/dist/esm/icons/database'
import { formatBytes } from '@/lib/format-utils'
import type { StorageUsage } from '../hooks/use-storage-usage'
import { GROUP_CLASS, SECTION_LABEL_CLASS } from './panel-tokens'

/**
 * browser.storage.local usage card for the settings tab: a green→amber→red
 * meter (sano/aviso/crítico) plus item count, so users can see how much space
 * the extension takes up. Uses the app-like token system (no semantic Tailwind).
 */
export function StorageCard({ usage }: { usage: StorageUsage }) {
	const isCritical = usage.percentage > 90
	const isWarning = usage.percentage > 75

	const accentColor = isCritical ? '#ff6b6b' : isWarning ? '#f0a020' : '#41d97e'
	const stateLabel = isCritical ? 'Crítico' : isWarning ? 'Aviso' : 'Sano'

	return (
		<>
			<div className={SECTION_LABEL_CLASS}>Almacenamiento</div>
			<section className={GROUP_CLASS}>
				<div className="p-4">
					<div className="flex items-start gap-3">
						<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f0a020]/[0.16] text-[#f0a020]">
							<Database className="h-5 w-5" aria-hidden="true" />
						</div>
						<div className="min-w-0 flex-1">
							<div className="flex items-center justify-between gap-2">
								<div className="text-[15px] font-semibold text-[#eef1f6]">Espacio local</div>
								<span className="text-sm font-bold tabular-nums" style={{ color: accentColor }}>
									{usage.percentage.toFixed(1)}%
								</span>
							</div>
							<p className="mt-0.5 text-xs tabular-nums text-[#9aa5b4]">
								{formatBytes(usage.used)} <span className="text-[#707b8e]">/ {formatBytes(usage.quota)}</span>
							</p>
						</div>
					</div>

					{/* Usage meter */}
					<div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
						<div
							className="h-full rounded-full transition-all duration-1000 ease-out"
							style={{ width: `${usage.percentage}%`, backgroundColor: accentColor }}
						/>
					</div>

					<div className="mt-3 grid grid-cols-2 gap-2">
						<div className="rounded-xl bg-[#14171d] px-3 py-2.5">
							<div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8b95a3]">Items</div>
							<div className="mt-1 text-base font-semibold tabular-nums text-[#eef1f6]">{usage.items}</div>
						</div>
						<div className="rounded-xl bg-[#14171d] px-3 py-2.5">
							<div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8b95a3]">Estado</div>
							<div className="mt-1 flex items-center gap-1.5 text-base font-semibold" style={{ color: isCritical ? accentColor : '#eef1f6' }}>
								<span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: accentColor }} aria-hidden="true" />
								{stateLabel}
							</div>
						</div>
					</div>
				</div>
			</section>
		</>
	)
}
