import { useState } from 'react'
import ArrowLeft from 'lucide-react/dist/esm/icons/arrow-left'
import Eye from 'lucide-react/dist/esm/icons/eye'
import EyeOff from 'lucide-react/dist/esm/icons/eye-off'
import ShieldAlert from 'lucide-react/dist/esm/icons/shield-alert'
import { Button } from '@/components/ui/button'
import { Z_INDEXES } from '@/constants'

interface HiddenSubforumBlockerProps {
	subforumName: string
	isThreadAccess?: boolean
	onUnhide: () => Promise<void>
	onBackToForums: () => void
}

export function HiddenSubforumBlocker({
	subforumName,
	isThreadAccess = false,
	onUnhide,
	onBackToForums,
}: HiddenSubforumBlockerProps) {
	const [isSubmitting, setIsSubmitting] = useState(false)
	const headingId = 'mvp-hidden-subforum-blocker-title'
	const descriptionId = 'mvp-hidden-subforum-blocker-description'

	const handleUnhide = async () => {
		if (isSubmitting) return

		setIsSubmitting(true)
		try {
			await onUnhide()
		} finally {
			setIsSubmitting(false)
		}
	}

	return (
		<div
			className="fixed inset-0 flex items-center justify-center bg-black/92 px-4 py-8 backdrop-blur-md"
			style={{ zIndex: Z_INDEXES.MAX }}
		>
			<div
				role="dialog"
				aria-modal="true"
				aria-labelledby={headingId}
				aria-describedby={descriptionId}
				className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-white/12 bg-[#090b10] shadow-[0_30px_90px_rgba(0,0,0,0.72)]"
			>
				<div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(239,68,68,0.18),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.12),transparent_28%)]" />
				<div className="absolute inset-0 bg-[#090b10]/88" />
				<div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

				<div className="relative p-7 sm:p-8">
					<div className="mb-5 inline-flex rounded-2xl border border-red-500/25 bg-red-500/10 p-3 text-red-400 shadow-[0_0_0_1px_rgba(239,68,68,0.08)]">
						<ShieldAlert size={24} />
					</div>

					<div className="space-y-3">
						<div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
							Bloqueo activo
						</div>
						<h2 id={headingId} className="text-2xl font-semibold text-white sm:text-3xl">
							{isThreadAccess ? 'Este hilo pertenece a un subforo oculto' : 'Subforo oculto'}
						</h2>
						<p id={descriptionId} className="max-w-xl text-sm leading-7 text-white/72 sm:text-[15px]">
							{isThreadAccess ? (
								<>
									Has intentado entrar en un hilo del subforo{' '}
									<span className="font-semibold text-white">{subforumName}</span>, pero lo tienes oculto para no acabar
									cayendo por inercia. Mientras siga así, Mediavida Premium bloqueará también el acceso a sus hilos
									directos.
								</>
							) : (
								<>
									Has marcado <span className="font-semibold text-white">{subforumName}</span> como subforo oculto.
									Mientras siga así, Mediavida Premium bloqueará el acceso a sus listados e hilos para quitar esa
									tentación.
								</>
							)}
						</p>
					</div>

					<div className="mt-7 flex flex-col gap-3 sm:flex-row">
						<Button
							type="button"
							variant="destructive"
							onClick={handleUnhide}
							disabled={isSubmitting}
							className="h-11 border-0 bg-red-600 text-white shadow-lg shadow-red-950/30 hover:bg-red-500 sm:flex-1"
						>
							<Eye className="h-4 w-4" />
							Desocultar y continuar
						</Button>
						<Button
							type="button"
							variant="outline"
							onClick={onBackToForums}
							disabled={isSubmitting}
							className="h-11 border-white/12 bg-white/5 text-white hover:bg-white/10 hover:text-white sm:flex-1"
						>
							<ArrowLeft className="h-4 w-4" />
							Volver a /foro
						</Button>
					</div>

					<div className="mt-5 flex items-start gap-2 text-xs leading-6 text-white/55">
						<EyeOff className="mt-0.5 h-4 w-4 shrink-0" />
						<span>
							También puedes mantenerlo oculto y salir de aquí. La idea es ponértelo un poco más difícil cuando entres
							en automático.
						</span>
					</div>
				</div>
			</div>
		</div>
	)
}
