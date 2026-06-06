import { useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import Copy from 'lucide-react/dist/esm/icons/copy'
import QrCode from 'lucide-react/dist/esm/icons/qr-code'
import type { UserCustomization, UserCustomizationsData } from '@/features/user-customizations/storage'
import {
	createIgnoredUsersImportUrl,
	summarizeIgnoredUsers,
	type IgnoredUsersSyncSummary,
} from '@/features/ignored-users-mobile-sync'
import { Button } from '@/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { toast } from '@/lib/lazy-toast'
import { logger } from '@/lib/logger'

interface IgnoredUsersMobileExportDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	users: Record<string, UserCustomization>
}

interface ExportState {
	url: string
	qrDataUrl: string | null
	summary: IgnoredUsersSyncSummary
	error: string | null
}

function getEmptySummary(): IgnoredUsersSyncSummary {
	return { total: 0, hide: 0, mute: 0 }
}

export function IgnoredUsersMobileExportDialog({ open, onOpenChange, users }: IgnoredUsersMobileExportDialogProps) {
	const userCustomizationsData = useMemo<UserCustomizationsData>(
		() => ({
			users,
			globalSettings: {
				adminColor: '',
				subadminColor: '',
				modColor: '',
				userColor: '',
			},
		}),
		[users]
	)
	const fallbackSummary = useMemo(() => {
		const ignoredUsers = Object.entries(users)
			.filter(([, customization]) => customization.isIgnored)
			.map(([nick, customization]) => ({
				nick,
				ignoreType: customization.ignoreType === 'mute' ? 'mute' as const : 'hide' as const,
			}))
		return summarizeIgnoredUsers(ignoredUsers)
	}, [users])
	const [state, setState] = useState<ExportState>({
		url: '',
		qrDataUrl: null,
		summary: getEmptySummary(),
		error: null,
	})

	useEffect(() => {
		if (!open) return

		let cancelled = false

		async function buildExport() {
			try {
				const result = createIgnoredUsersImportUrl(userCustomizationsData)
				if (result.summary.total === 0) {
					setState({
						url: '',
						qrDataUrl: null,
						summary: result.summary,
						error: 'No hay usuarios ignorados para exportar.',
					})
					return
				}

				const qrDataUrl = await QRCode.toDataURL(result.url, {
					errorCorrectionLevel: 'M',
					margin: 2,
					scale: 6,
				})
				if (cancelled) return

				setState({
					url: result.url,
					qrDataUrl,
					summary: result.summary,
					error: null,
				})
			} catch (error) {
				if (cancelled) return
				const message = error instanceof Error ? error.message : 'No se pudo generar el enlace de exportación.'
				setState({
					url: '',
					qrDataUrl: null,
					summary: fallbackSummary,
					error: message,
				})
			}
		}

		setState({
			url: '',
			qrDataUrl: null,
			summary: fallbackSummary,
			error: null,
		})
		void buildExport()

		return () => {
			cancelled = true
		}
	}, [fallbackSummary, open, userCustomizationsData])

	const copyLink = async () => {
		if (!state.url) return

		try {
			await navigator.clipboard.writeText(state.url)
			toast.success('Enlace copiado')
		} catch (error) {
			logger.error('Could not copy ignored users mobile import URL:', error)
			toast.error('No se pudo copiar el enlace')
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<QrCode className="h-5 w-5" />
						Exportar ignorados a móvil
					</DialogTitle>
					<DialogDescription>
						Escanea el QR en Firefox Android con Mobile Lite activo o copia el enlace manualmente.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					<div className="grid grid-cols-3 gap-2 text-center">
						<div className="rounded-md border bg-muted/30 px-2 py-3">
							<div className="text-lg font-semibold">{state.summary.total}</div>
							<div className="text-xs text-muted-foreground">Total</div>
						</div>
						<div className="rounded-md border bg-muted/30 px-2 py-3">
							<div className="text-lg font-semibold">{state.summary.hide}</div>
							<div className="text-xs text-muted-foreground">Ocultos</div>
						</div>
						<div className="rounded-md border bg-muted/30 px-2 py-3">
							<div className="text-lg font-semibold">{state.summary.mute}</div>
							<div className="text-xs text-muted-foreground">Silenciados</div>
						</div>
					</div>

					{state.error ? (
						<div role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
							{state.error}
						</div>
					) : (
						<div className="flex justify-center rounded-md border bg-white p-4">
							{state.qrDataUrl ? (
								<img src={state.qrDataUrl} alt="QR para importar usuarios ignorados en móvil" className="h-56 w-56" />
							) : (
								<div className="flex h-56 w-56 items-center justify-center text-sm text-muted-foreground">Generando QR...</div>
							)}
						</div>
					)}
				</div>

				<DialogFooter>
					<Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
						Cerrar
					</Button>
					<Button type="button" disabled={!state.url} onClick={copyLink}>
						<Copy className="h-4 w-4" />
						Copiar enlace
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
