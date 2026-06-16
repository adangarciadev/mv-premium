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

const STATUS_CARD_CLASS = 'rounded-md border border-[#4b545d] bg-[#333b46] px-2 py-2.5 text-center'
const STATUS_VALUE_CLASS = 'flex items-center justify-center gap-1 text-lg font-semibold leading-none text-[#eef1f3]'
const STATUS_LABEL_CLASS = 'mt-1.5 text-[11px] font-medium text-[#b7bec6]'
const ALERT_ERROR_CLASS = 'rounded-md border border-[#8f3f3f] bg-[#4a2528] px-3 py-2 text-sm text-[#ffd7d7]'

interface IgnoredUsersImportPanelProps {
	payload: MobileLiteTransferPayload | null
	errorMessage?: string | null
	onCancel: () => void
	onImport: () => Promise<void>
}

function getEmptySummary(): MobileLiteTransferSummary {
	return { total: 0, hide: 0, mute: 0, hasImgbbApiKey: false, hasGeminiApiKey: false }
}

function getApiKeyNames(summary: MobileLiteTransferSummary): string[] {
	return [
		summary.hasImgbbApiKey ? 'ImgBB' : null,
		summary.hasGeminiApiKey ? 'Gemini' : null,
	].filter((name): name is string => Boolean(name))
}

function formatApiKeyNames(summary: MobileLiteTransferSummary): string {
	const names = getApiKeyNames(summary)
	if (names.length === 0) return ''
	if (names.length === 1) return `API key de ${names[0]}`
	return `API keys de ${names.join(' y ')}`
}

function getImportMessage(summary: MobileLiteTransferSummary): string {
	const apiKeyCount = getApiKeyNames(summary).length
	const apiKeyNames = formatApiKeyNames(summary)
	if (summary.total > 0 && apiKeyNames) {
		return apiKeyCount === 1
			? `Se fusionarán los usuarios con los existentes y se guardará la ${apiKeyNames}.`
			: `Se fusionarán los usuarios con los existentes y se guardarán las ${apiKeyNames}.`
	}
	if (apiKeyNames) {
		return apiKeyCount === 1
			? `Se guardará la ${apiKeyNames} en este dispositivo.`
			: `Se guardarán las ${apiKeyNames} en este dispositivo.`
	}
	return 'Se fusionarán con los usuarios existentes. No se borrará ningún filtro actual.'
}

function getSuccessMessage(summary: MobileLiteTransferSummary): string {
	const apiKeyCount = getApiKeyNames(summary).length
	const apiKeyNames = formatApiKeyNames(summary)
	if (summary.total > 0 && apiKeyNames) {
		return apiKeyCount === 1
			? `Se han importado ${summary.total} usuarios y la ${apiKeyNames}. Ya puedes cerrar este panel.`
			: `Se han importado ${summary.total} usuarios y las ${apiKeyNames}. Ya puedes cerrar este panel.`
	}
	if (apiKeyNames) {
		return apiKeyCount === 1
			? `Se ha importado la ${apiKeyNames}. Ya puedes cerrar este panel.`
			: `Se han importado las ${apiKeyNames}. Ya puedes cerrar este panel.`
	}
	return `Se han importado ${summary.total} usuarios. Ya puedes cerrar este panel.`
}

export function IgnoredUsersImportPanel({ payload, errorMessage, onCancel, onImport }: IgnoredUsersImportPanelProps) {
	const [isImporting, setIsImporting] = useState(false)
	const [imported, setImported] = useState(false)
	const [importError, setImportError] = useState<string | null>(null)
	const summary = useMemo(() => (payload ? summarizeMobileLiteTransfer(payload) : getEmptySummary()), [payload])
	const hasApiKey = summary.hasImgbbApiKey || summary.hasGeminiApiKey
	const canImport = Boolean(payload && !errorMessage && (summary.total > 0 || hasApiKey) && !imported)

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
		<div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/65 px-4 py-6 text-[#e5e8eb]">
			<section className="w-full max-w-sm overflow-hidden rounded-lg border border-[#4b545d] bg-[#343b41] shadow-2xl">
				<header className="flex items-center justify-between border-b border-[#46505a] bg-[#30363d] px-4 py-3">
					<div className="min-w-0">
						<h2 className="text-base font-bold leading-tight">Importar Mobile Lite</h2>
						<p className="mt-0.5 text-xs text-[#b7bec6]">Mobile Lite</p>
					</div>
					<button
						type="button"
						className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-[#56606a] bg-[#4a525d] text-[#eef1f3] transition-colors active:bg-[#59626d]"
						aria-label="Cancelar importación"
						onClick={onCancel}
					>
						<X className="h-4 w-4" aria-hidden="true" />
					</button>
				</header>

				<div className="space-y-3 bg-[#384149] px-4 py-4">
					{errorMessage ? (
						<div role="alert" className={ALERT_ERROR_CLASS}>
							{errorMessage}
						</div>
					) : (
						<>
							<div className="grid grid-cols-3 gap-2 text-center">
								<div className={STATUS_CARD_CLASS}>
									<div className={STATUS_VALUE_CLASS}>{summary.total}</div>
									<div className={STATUS_LABEL_CLASS}>Total</div>
								</div>
								<div className={STATUS_CARD_CLASS}>
									<div className={STATUS_VALUE_CLASS}>
										<EyeOff className="h-4 w-4 text-[#d8dde2]" aria-hidden="true" />
										{summary.hide}
									</div>
									<div className={STATUS_LABEL_CLASS}>Ocultos</div>
								</div>
								<div className={STATUS_CARD_CLASS}>
									<div className={STATUS_VALUE_CLASS}>
										<VolumeX className="h-4 w-4 text-[#d8dde2]" aria-hidden="true" />
										{summary.mute}
									</div>
									<div className={STATUS_LABEL_CLASS}>Silenciados</div>
								</div>
							</div>

							<ApiKeyImportRow label="API key de ImgBB" included={summary.hasImgbbApiKey} />
							<ApiKeyImportRow label="API key de Gemini" included={summary.hasGeminiApiKey} />

							<p className="rounded-md border border-[#4b545d] bg-[#323a44] px-3 py-2.5 text-sm leading-relaxed text-[#d8dde2]">
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
						<div role="alert" className={ALERT_ERROR_CLASS}>
							{importError}
						</div>
					)}
				</div>

				<footer className="flex justify-end gap-2 border-t border-[#46505a] bg-[#30363d] px-4 py-3">
					<button
						type="button"
						className="inline-flex h-11 min-w-[104px] items-center justify-center rounded-md border border-[#626b74] bg-[#5b646e] px-4 text-sm font-semibold text-[#eef1f3] transition-colors active:bg-[#66717c] disabled:opacity-60"
						disabled={isImporting}
						onClick={onCancel}
					>
						{imported ? 'Cerrar' : 'Cancelar'}
					</button>
					{!imported && (
						<button
							type="button"
							className="inline-flex h-11 min-w-[108px] items-center justify-center rounded-md border border-[#d06d00] bg-[#8a5b00] px-4 text-sm font-semibold text-white transition-colors active:bg-[#9a6500] disabled:opacity-50"
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

function ApiKeyImportRow({ label, included }: { label: string; included: boolean }) {
	return (
		<div className="flex items-center gap-3 rounded-md border border-[#4b545d] bg-[#333b46] px-3 py-3">
			<div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#252b31] text-[#d8b36a]">
				<KeyRound className="h-4 w-4" aria-hidden="true" />
			</div>
			<div className="min-w-0">
				<div className="text-sm font-semibold">{label}</div>
				<div className="text-xs text-[#b7bec6]">{included ? 'Incluida en este QR' : 'No incluida'}</div>
			</div>
		</div>
	)
}
