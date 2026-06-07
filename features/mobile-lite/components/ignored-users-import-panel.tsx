import { useMemo, useState } from 'react'
import CircleCheck from 'lucide-react/dist/esm/icons/circle-check'
import EyeOff from 'lucide-react/dist/esm/icons/eye-off'
import KeyRound from 'lucide-react/dist/esm/icons/key-round'
import VolumeX from 'lucide-react/dist/esm/icons/volume-x'
import X from 'lucide-react/dist/esm/icons/x'
import {
	summarizeMobileLiteTransfer,
	type MobileLiteTransferPayload,
	type MobileLiteTransferSummary,
} from '@/features/ignored-users-mobile-sync'

interface IgnoredUsersImportPanelProps {
	payload: MobileLiteTransferPayload | null
	errorMessage?: string | null
	onCancel: () => void
	onImport: () => Promise<void>
}

function getEmptySummary(): MobileLiteTransferSummary {
	return { total: 0, hide: 0, mute: 0, hasImgbbApiKey: false }
}

function getImportMessage(summary: MobileLiteTransferSummary): string {
	if (summary.total > 0 && summary.hasImgbbApiKey) {
		return 'Se fusionarán los usuarios con los existentes y se guardará la API key de ImgBB.'
	}
	if (summary.hasImgbbApiKey) {
		return 'Se guardará la API key de ImgBB en este dispositivo.'
	}
	return 'Se fusionarán con los usuarios existentes. No se borrará ningún filtro actual.'
}

function getSuccessMessage(summary: MobileLiteTransferSummary): string {
	if (summary.total > 0 && summary.hasImgbbApiKey) {
		return `Se han importado ${summary.total} usuarios y la API key de ImgBB. Ya puedes cerrar este panel.`
	}
	if (summary.hasImgbbApiKey) {
		return 'Se ha importado la API key de ImgBB. Ya puedes cerrar este panel.'
	}
	return `Se han importado ${summary.total} usuarios. Ya puedes cerrar este panel.`
}

export function IgnoredUsersImportPanel({ payload, errorMessage, onCancel, onImport }: IgnoredUsersImportPanelProps) {
	const [isImporting, setIsImporting] = useState(false)
	const [imported, setImported] = useState(false)
	const [importError, setImportError] = useState<string | null>(null)
	const summary = useMemo(() => (payload ? summarizeMobileLiteTransfer(payload) : getEmptySummary()), [payload])
	const canImport = Boolean(payload && !errorMessage && (summary.total > 0 || summary.hasImgbbApiKey) && !imported)

	const handleImport = async () => {
		if (!canImport) return

		setIsImporting(true)
		setImportError(null)
		try {
			await onImport()
			setImported(true)
			setIsImporting(false)
		} catch {
			setImportError('No se pudo importar. Inténtalo de nuevo.')
			setIsImporting(false)
		}
	}

	return (
		<div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 px-4 py-6 text-[#e5e8eb]">
			<section className="w-full max-w-sm overflow-hidden rounded-lg border border-[#4b545d] bg-[#343b41] shadow-2xl">
				<header className="flex items-center justify-between border-b border-[#46505a] bg-[#30363d] px-4 py-3">
					<div className="min-w-0">
						<h2 className="text-base font-semibold leading-tight">Importar Mobile Lite</h2>
						<p className="mt-0.5 text-xs text-[#b7bec6]">Mobile Lite</p>
					</div>
					<button
						type="button"
						className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#56606a] bg-[#444b54] text-[#eef1f3]"
						aria-label="Cancelar importación"
						onClick={onCancel}
					>
						<X className="h-4 w-4" aria-hidden="true" />
					</button>
				</header>

				<div className="space-y-4 bg-[#384149] px-4 py-4">
					{errorMessage ? (
						<div role="alert" className="rounded-md border border-[#8f3f3f] bg-[#4a2528] px-3 py-2 text-sm text-[#ffd7d7]">
							{errorMessage}
						</div>
					) : (
						<>
							<div className="grid grid-cols-3 gap-2 text-center">
								<div className="rounded-md border border-[#4b545d] bg-[#303840] px-2 py-3">
									<div className="text-lg font-semibold">{summary.total}</div>
									<div className="text-[11px] text-[#b7bec6]">Total</div>
								</div>
								<div className="rounded-md border border-[#4b545d] bg-[#303840] px-2 py-3">
									<div className="flex items-center justify-center gap-1 text-lg font-semibold">
										<EyeOff className="h-4 w-4" aria-hidden="true" />
										{summary.hide}
									</div>
									<div className="text-[11px] text-[#b7bec6]">Ocultos</div>
								</div>
								<div className="rounded-md border border-[#4b545d] bg-[#303840] px-2 py-3">
									<div className="flex items-center justify-center gap-1 text-lg font-semibold">
										<VolumeX className="h-4 w-4" aria-hidden="true" />
										{summary.mute}
									</div>
									<div className="text-[11px] text-[#b7bec6]">Silenciados</div>
								</div>
							</div>

							<div className="flex items-center gap-3 rounded-md border border-[#4b545d] bg-[#303840] px-3 py-3">
								<KeyRound className="h-4 w-4 text-[#d8dde2]" aria-hidden="true" />
								<div className="min-w-0">
									<div className="text-sm font-semibold">API key de ImgBB</div>
									<div className="text-xs text-[#b7bec6]">
										{summary.hasImgbbApiKey ? 'Incluida en este QR' : 'No incluida'}
									</div>
								</div>
							</div>

							<p className="rounded-md border border-[#56616b] bg-[#303840] px-3 py-2 text-sm text-[#d8dde2]">
								{getImportMessage(summary)}
							</p>

							{imported && (
								<div role="status" className="rounded-md border border-[#5f7d55] bg-[#2f3f31] px-3 py-3 text-sm text-[#d9f0d0]">
									<div className="flex items-start gap-2">
										<CircleCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
										<div>
											<p className="font-semibold">Importación completada</p>
											<p className="mt-1 text-[#c6dfbd]">{getSuccessMessage(summary)}</p>
										</div>
									</div>
								</div>
							)}
						</>
					)}

					{importError && (
						<div role="alert" className="rounded-md border border-[#8f3f3f] bg-[#4a2528] px-3 py-2 text-sm text-[#ffd7d7]">
							{importError}
						</div>
					)}
				</div>

				<footer className="flex justify-end gap-2 border-t border-[#46505a] bg-[#30363d] px-4 py-3">
					<button
						type="button"
						className="inline-flex h-10 items-center justify-center rounded-md border border-[#626b74] bg-[#545d66] px-4 text-sm font-semibold"
						disabled={isImporting}
						onClick={onCancel}
					>
						{imported ? 'Cerrar' : 'Cancelar'}
					</button>
					{!imported && (
						<button
							type="button"
							className="inline-flex h-10 items-center justify-center rounded-md border border-[#d06d00] bg-[#7b4b08] px-4 text-sm font-semibold text-white disabled:opacity-50"
							disabled={!canImport || isImporting}
							onClick={handleImport}
						>
							{isImporting ? 'Importando...' : 'Importar'}
						</button>
					)}
				</footer>
			</section>
		</div>
	)
}
