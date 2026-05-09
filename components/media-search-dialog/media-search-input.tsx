/**
 * MediaSearchInput - Search input with icon and loading spinner.
 */

import Search from 'lucide-react/dist/esm/icons/search'
import Loader2 from 'lucide-react/dist/esm/icons/loader-2'

interface MediaSearchInputProps {
	ref?: React.Ref<HTMLInputElement>
	value: string
	onChange: (value: string) => void
	placeholder: string
	isSearching: boolean
	disabled?: boolean
}

export function MediaSearchInput({ ref, value, onChange, placeholder, isSearching, disabled }: MediaSearchInputProps) {
	return (
		<div className="relative mb-4">
			<Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
			<input
				ref={ref}
				type="text"
				value={value}
				onChange={e => onChange(e.target.value)}
				onKeyDown={e => e.stopPropagation()}
				placeholder={placeholder}
				disabled={disabled}
				className="h-12 w-full rounded-lg border border-border bg-muted/25 pl-11 pr-11 text-[14px] text-foreground shadow-sm outline-none transition-[background-color,border-color,box-shadow] placeholder:text-muted-foreground focus:border-primary/60 focus:bg-background focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
			/>
			{isSearching && (
				<Loader2 className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-primary" />
			)}
		</div>
	)
}
