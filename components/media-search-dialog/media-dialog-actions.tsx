/**
 * MediaDialogActions - Footer with Back, Copy, and Insert buttons.
 */

import Check from 'lucide-react/dist/esm/icons/check'
import Copy from 'lucide-react/dist/esm/icons/copy'
import { DialogFooter } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface MediaDialogActionsProps {
	onBack: () => void
	backLabel: string
	onCopy: () => void
	copied: boolean
	onInsert: () => void
	secondaryInsertLabel?: string
	onSecondaryInsert?: () => void
	secondaryInsertDisabled?: boolean
	secondaryInsertTitle?: string
	/** Show only the back button (e.g. season-select step) */
	backOnly?: boolean
}

export function MediaDialogActions({
	onBack,
	backLabel,
	onCopy,
	copied,
	onInsert,
	secondaryInsertLabel,
	onSecondaryInsert,
	secondaryInsertDisabled,
	secondaryInsertTitle,
	backOnly,
}: MediaDialogActionsProps) {
	return (
		<DialogFooter className="p-3 px-4 border-t border-border flex gap-2 shrink-0">
			<button
				onClick={onBack}
				className="h-9 px-3.5 bg-transparent border border-border rounded-md text-[13px] text-muted-foreground cursor-pointer hover:bg-muted transition-colors"
			>
				{backLabel}
			</button>
			{!backOnly && (
				<>
					<button
						onClick={onCopy}
						className={cn(
							'h-9 px-3.5 bg-transparent border border-border rounded-md text-[13px] flex items-center justify-center gap-1.5 cursor-pointer hover:bg-muted transition-colors',
							copied ? 'text-green-500 border-green-500/30 bg-green-500/10' : 'text-muted-foreground'
						)}
					>
						{copied ? <Check size={14} /> : <Copy size={14} />}
						{copied ? 'Copiado' : 'Copiar'}
					</button>
					{onSecondaryInsert && secondaryInsertLabel && (
						<button
							onClick={onSecondaryInsert}
							disabled={secondaryInsertDisabled}
							title={secondaryInsertTitle}
							className="h-9 px-3.5 bg-transparent border border-border rounded-md text-[13px] text-muted-foreground cursor-pointer hover:bg-muted transition-colors disabled:cursor-not-allowed disabled:opacity-50"
						>
							{secondaryInsertLabel}
						</button>
					)}
					<button
						onClick={onInsert}
						className="h-9 px-3.5 flex-1 bg-primary text-primary-foreground font-medium border-none rounded-md text-[13px] cursor-pointer hover:opacity-90 transition-opacity"
					>
						Insertar en editor
					</button>
				</>
			)}
		</DialogFooter>
	)
}
