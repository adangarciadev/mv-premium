import RotateCcw from 'lucide-react/dist/esm/icons/rotate-ccw'
import { PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS } from './panel-tokens'

export function ConfirmClearHiddenThreadsDialog({
	clearing,
	onCancel,
	onConfirm,
}: {
	clearing: boolean
	onCancel: () => void
	onConfirm: () => void
}) {
	return (
		<div className="absolute inset-0 z-30 flex items-end justify-center bg-black/60 px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-[max(12px,env(safe-area-inset-top))] animate-in fade-in-0 duration-150">
			<button
				type="button"
				className="absolute inset-0 h-full w-full cursor-default"
				aria-label="Cancelar restauración de hilos"
				onClick={onCancel}
			/>
			<div
				role="alertdialog"
				aria-modal="true"
				aria-labelledby="mvp-mobile-lite-clear-hidden-threads-title"
				aria-describedby="mvp-mobile-lite-clear-hidden-threads-description"
				className="relative w-full max-w-[32rem] rounded-3xl bg-[#242a36] p-5 text-sm text-[#e5e8eb] shadow-[0_12px_48px_rgba(0,0,0,0.6)] animate-in slide-in-from-bottom-4 duration-200"
			>
				<p id="mvp-mobile-lite-clear-hidden-threads-title" className="text-base font-bold text-[#f2f4f7]">
					Se mostrarán todos los hilos ocultos.
				</p>
				<p id="mvp-mobile-lite-clear-hidden-threads-description" className="mt-1 text-sm leading-relaxed text-[#9aa5b4]">
					Esto vaciará tu lista de hilos ocultos en este dispositivo.
				</p>
				<div className="mt-5 grid grid-cols-2 gap-2">
					<button type="button" className={SECONDARY_BUTTON_CLASS} onClick={onCancel}>
						Cancelar
					</button>
					<button type="button" className={PRIMARY_BUTTON_CLASS} disabled={clearing} onClick={onConfirm}>
						<RotateCcw className="h-4 w-4" aria-hidden="true" />
						{clearing ? 'Restaurando' : 'Continuar'}
					</button>
				</div>
			</div>
		</div>
	)
}
