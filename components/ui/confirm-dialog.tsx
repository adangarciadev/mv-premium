/**
 * ConfirmDialog - Componente reutilizable para diálogos de confirmación
 * Envuelve AlertDialog con una API simplificada
 */
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'

export interface ConfirmDialogProps {
	/** Controls if the dialog is open */
	open: boolean
	/** Callback cuando cambia el estado de apertura */
	onOpenChange: (open: boolean) => void
	/** Dialog title */
	title: string
	/** Dialog description or content (can be string or ReactNode) */
	description: React.ReactNode
	/** Cancel button text */
	cancelText?: string
	/** Confirm button text */
	confirmText?: string
	/** Variante visual: 'default' o 'destructive' */
	variant?: 'default' | 'destructive'
	/** Callback al confirmar */
	onConfirm: () => void
	/** Callback al cancelar (opcional) */
	onCancel?: () => void
}

export function ConfirmDialog({
	open,
	onOpenChange,
	title,
	description,
	cancelText = 'Cancelar',
	confirmText = 'Confirmar',
	variant = 'default',
	onConfirm,
	onCancel,
}: ConfirmDialogProps) {
	const handleCancel = () => {
		onCancel?.()
		onOpenChange(false)
	}

	const handleConfirm = () => {
		onConfirm()
		// Don't close here, let the caller control the close
	}

	return (
		<AlertDialog open={open} onOpenChange={onOpenChange}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle className={cn(variant === 'destructive' && 'text-destructive')}>{title}</AlertDialogTitle>
					<AlertDialogDescription asChild={typeof description !== 'string'}>
						{typeof description === 'string' ? description : <div>{description}</div>}
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel onClick={handleCancel}>{cancelText}</AlertDialogCancel>
					<AlertDialogAction
						onClick={handleConfirm}
						className={cn(
							variant === 'destructive' && 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
						)}
					>
						{confirmText}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	)
}
