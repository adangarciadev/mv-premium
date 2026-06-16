import type { ReactNode } from 'react'
import CircleAlert from 'lucide-react/dist/esm/icons/circle-alert'
import CircleCheck from 'lucide-react/dist/esm/icons/circle-check'
import { STATUS_ERROR_CLASS, STATUS_SUCCESS_CLASS } from './panel-tokens'

export function PanelToast({ kind, children }: { kind: 'success' | 'error'; children: ReactNode }) {
	const isSuccess = kind === 'success'
	const Icon = isSuccess ? CircleCheck : CircleAlert
	return (
		<div role={isSuccess ? 'status' : 'alert'} className={isSuccess ? STATUS_SUCCESS_CLASS : STATUS_ERROR_CLASS}>
			<Icon className={`h-5 w-5 shrink-0 ${isSuccess ? 'text-[#41d97e]' : 'text-[#ff8585]'}`} aria-hidden="true" />
			<span className="min-w-0 flex-1">{children}</span>
		</div>
	)
}
