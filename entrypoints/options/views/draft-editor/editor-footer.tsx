/**
 * EditorFooter Component
 * Footer with help menu, save status, and content stats
 */

import Trash2 from 'lucide-react/dist/esm/icons/trash-2'
import HelpCircle from 'lucide-react/dist/esm/icons/help-circle'

import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuTrigger,
	DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import type { EditorFooterProps } from './types'

export function EditorFooter({ content, lastSavedAt, isDirty, onClear }: EditorFooterProps) {
	return (
		<div className="px-4 py-2 border-t text-xs text-muted-foreground flex justify-between items-center bg-muted/30">
			<div className="flex items-center gap-3">
				<DropdownMenu modal={false}>
					<Tooltip>
						<TooltipTrigger asChild>
							<DropdownMenuTrigger asChild>
								<Button
									variant="ghost"
									size="sm"
									className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground gap-1.5"
								>
									<HelpCircle className="h-3.5 w-3.5" />
									Ayuda
								</Button>
							</DropdownMenuTrigger>
						</TooltipTrigger>
						<TooltipContent side="top" align="start" className="text-xs">
							Atajos de teclado
						</TooltipContent>
					</Tooltip>
					<DropdownMenuContent align="start" side="top" className="w-64 p-3 mb-1 pointer-events-auto">
						<h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80 mb-3 ml-1">
							Atajos de Teclado
						</h4>
						<div className="space-y-2">
							<ShortcutRow label="Negrita" shortcut="Ctrl+B" />
							<ShortcutRow label="Cursiva" shortcut="Ctrl+I" />
							<ShortcutRow label="Subrayado" shortcut="Ctrl+U" />
							<ShortcutRow label="Enlace" shortcut="Ctrl+K" />
							<ShortcutRow label="Deshacer" shortcut="Ctrl+Z" />
							<ShortcutRow label="Rehacer" shortcut="Ctrl+Y" />
						</div>
						<DropdownMenuSeparator className="my-3" />
						<div className="px-1">
							<p className="text-[10px] text-muted-foreground leading-relaxed italic">
								Tip: En modo previsualización verás los cambios en tiempo real con el estilo oficial de Mediavida.
							</p>
						</div>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
			<div className="flex items-center gap-3">
				{/* Save Status Feedback */}
				{lastSavedAt ? (
					<div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-green-500/5 text-green-500/60 text-[10px] font-medium border border-green-500/10 uppercase tracking-tight">
						<div className="h-1 w-1 rounded-full bg-green-500 animate-pulse" />
						{isDirty
							? 'Hay cambios sin guardar'
							: `Guardado ${
									new Date().getTime() - lastSavedAt.getTime() < 60000 ? 'recientemente' : 'hace unos minutos'
							  }`}
					</div>
				) : (
					<div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-muted text-muted-foreground/60 text-[10px] font-medium border border-border/50 uppercase tracking-tight">
						<div className="h-1 w-1 rounded-full bg-muted-foreground/30" />
						No guardado aún
					</div>
				)}

				<span className="text-muted-foreground/60">{content.length} caracteres</span>
				<span className="text-muted-foreground/60">{content.split(/\s+/).filter(Boolean).length} palabras</span>
				<Button
					variant="ghost"
					size="sm"
					className="h-5 px-1.5 text-[10px] uppercase font-bold text-muted-foreground hover:text-destructive hover:bg-destructive/10"
					onClick={onClear}
					disabled={!content}
				>
					<Trash2 className="h-3 w-3 mr-1" />
					Limpiar
				</Button>
			</div>
		</div>
	)
}

function ShortcutRow({ label, shortcut }: { label: string; shortcut: string }) {
	return (
		<div className="flex items-center justify-between text-xs px-1">
			<span className="text-muted-foreground">{label}</span>
			<kbd className="px-1.5 py-0.5 rounded bg-muted border border-border/50 font-sans text-[10px] font-bold">
				{shortcut}
			</kbd>
		</div>
	)
}
