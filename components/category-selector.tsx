import { useState, useEffect } from "react"
import Check from 'lucide-react/dist/esm/icons/check'
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down'

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover"
import { getCategoriesForSubforum } from "@/lib/subforum-categories"

interface CategorySelectorProps {
	subforum: string
	value: string
	onValueChange: (value: string) => void
	className?: string
	autoOpen?: boolean
	onAutoOpenConsumed?: () => void
}

/**
 * CategorySelector component - Dropdown to select a category within a subforum
 * @param subforum - Subforum slug to filter categories
 * @param value - Currently selected category value
 * @param onValueChange - callback when a category is selected
 * @param className - Optional CSS classes
 * @param autoOpen - If true, the popover opens automatically on mount
 * @param onAutoOpenConsumed - Callback called once autoOpen has been handled
 */
export function CategorySelector({ subforum, value, onValueChange, className, autoOpen, onAutoOpenConsumed }: CategorySelectorProps) {
	const [open, setOpen] = useState(false)

	useEffect(() => {
		if (autoOpen) {
			const timer = setTimeout(() => {
				setOpen(true)
				onAutoOpenConsumed?.()
			}, 150)
			return () => clearTimeout(timer)
		}
	}, [autoOpen, onAutoOpenConsumed])

	const categories = getCategoriesForSubforum(subforum)
	const selectedCategory = categories.find((c) => c.value === value)
	
	if (categories.length === 0) {
		return null
	}

	const hasValue = value && value !== 'none' && selectedCategory

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					role="combobox"
					aria-expanded={open}
					className={cn(
						"h-8 px-3 gap-2 text-sm font-medium rounded-md transition-all border-dashed",
						"text-muted-foreground hover:text-foreground hover:border-primary/30",
						hasValue && "bg-secondary text-secondary-foreground border-solid border-border",
						className
					)}
				>
					<span>{selectedCategory?.label || "Seleccionar categoría"}</span>
					<ChevronDown className="h-3.5 w-3.5 opacity-60" />
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-[240px] p-2" align="start">
				<div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 px-2 py-1.5 mb-1">
					Categorías de {subforum.replace(/-/g, ' ')}
				</div>
				<div className="max-h-[280px] overflow-y-auto pr-1 custom-scroll">
					<div className="space-y-0.5 pr-2">
						{/* Option: Sin categoría */}
						<button
							type="button"
							onClick={() => {
								onValueChange('none')
								setOpen(false)
							}}
							className={cn(
								"w-full flex items-center gap-3 px-2 py-2 rounded-md text-left transition-all text-sm",
								value === 'none' 
									? "bg-accent text-foreground" 
									: "hover:bg-accent/50 text-muted-foreground hover:text-foreground"
							)}
						>
							<span>Sin categoría</span>
							{value === 'none' && <Check className="h-4 w-4 ml-auto" />}
						</button>

						{/* Categories */}
						{categories.map((cat) => {
							const isSelected = value === cat.value

							return (
								<button
									type="button"
									key={cat.value}
									onClick={() => {
										onValueChange(cat.value)
										setOpen(false)
									}}
									className={cn(
										"w-full flex items-center gap-3 px-2 py-2 rounded-md text-left transition-all group",
										isSelected 
											? "bg-primary/10 border-l-2 border-primary font-medium text-foreground" 
											: "hover:bg-accent/50 text-muted-foreground hover:text-foreground"
									)}
								>
									<span className="flex-1">{cat.label}</span>
									{isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
								</button>
							)
						})}
					</div>
				</div>
			</PopoverContent>
		</Popover>
	)
}
