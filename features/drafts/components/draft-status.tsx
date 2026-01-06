import { useEffect, useState } from 'react'

export type DraftStatusType = 'saved' | 'saving' | 'restored' | 'idle'

interface DraftStatusProps {
	status: DraftStatusType
	lastSaved?: number
}

export function DraftStatus({ status, lastSaved }: DraftStatusProps) {
	let content = null

	switch (status) {
		case 'saving':
			content = (
				<div
					title="Guardando borrador..."
					className="flex items-center gap-2 text-xs font-medium text-muted-foreground animate-pulse px-2.5 py-1"
				>
					<i className="fa fa-fw fa-circle-o-notch fa-spin"></i>
					<span>Guardando...</span>
				</div>
			)
			break
		case 'saved':
			content = (
				<div
					title={`Guardado a las ${lastSaved ? new Date(lastSaved).toLocaleTimeString() : ''}`}
					className="flex items-center gap-2 text-sm font-medium font-sans text-primary-foreground bg-primary border border-primary px-3 py-1 rounded-full shadow-md"
				>
					<i className="fa fa-fw fa-check"></i>
					<span>Borrador guardado</span>
				</div>
			)
			break
		case 'restored':
			content = (
				<div className="flex items-center gap-2 text-sm font-medium font-sans text-secondary-foreground bg-secondary border border-secondary-foreground/20 px-3 py-1 rounded-full shadow-sm">
					<i className="fa fa-fw fa-folder-open-o"></i>
					<span>Borrador cargado</span>
				</div>
			)
			break
	}

	return <div className="h-full flex items-center">{content}</div>
}
