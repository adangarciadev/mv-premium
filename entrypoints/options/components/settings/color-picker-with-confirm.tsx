/**
 * ColorPickerWithConfirm - Color picker with confirm and reset buttons
 */
import { useState, useEffect } from 'react'
import Check from 'lucide-react/dist/esm/icons/check'
import RotateCcw from 'lucide-react/dist/esm/icons/rotate-ccw'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export interface ColorPickerWithConfirmProps {
	value: string
	defaultValue: string
	onConfirm: (color: string) => void
}

export function ColorPickerWithConfirm({ value, defaultValue, onConfirm }: ColorPickerWithConfirmProps) {
	const [localColor, setLocalColor] = useState(value)
	const hasChanges = localColor !== value

	// Sync when external value changes
	useEffect(() => {
		setLocalColor(value)
	}, [value])

	return (
		<div className="flex items-center gap-2">
			<Input
				type="color"
				value={localColor}
				onChange={(e) => setLocalColor(e.target.value)}
				className="w-12 h-9 p-1 cursor-pointer"
			/>
			<Input
				type="text"
				value={localColor}
				onChange={(e) => setLocalColor(e.target.value)}
				className="w-24 font-mono text-xs"
			/>
			<Button
				variant={hasChanges ? "default" : "ghost"}
				size="icon"
				className="h-9 w-9"
				onClick={() => onConfirm(localColor)}
				title="Confirmar color"
				disabled={!hasChanges}
			>
				<Check className="h-4 w-4" />
			</Button>
			<Button
				variant="ghost"
				size="icon"
				className="h-9 w-9"
				onClick={() => {
					setLocalColor(defaultValue)
					onConfirm(defaultValue)
				}}
				title="Resetear a color por defecto"
			>
				<RotateCcw className="h-4 w-4" />
			</Button>
		</div>
	)
}
