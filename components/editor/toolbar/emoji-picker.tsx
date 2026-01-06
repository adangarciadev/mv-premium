import { useState, useMemo, useCallback, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import Smile from 'lucide-react/dist/esm/icons/smile'
import Zap from 'lucide-react/dist/esm/icons/zap'
import Hash from 'lucide-react/dist/esm/icons/hash'
import Trophy from 'lucide-react/dist/esm/icons/trophy'
import Map from 'lucide-react/dist/esm/icons/map'
import Lightbulb from 'lucide-react/dist/esm/icons/lightbulb'
import Coffee from 'lucide-react/dist/esm/icons/coffee'
import Cat from 'lucide-react/dist/esm/icons/cat'
import Flag from 'lucide-react/dist/esm/icons/flag'
import Loader2 from 'lucide-react/dist/esm/icons/loader-2'
import { loadEmojis, type MvEmoji, type MvEmojiCategory } from '@/constants/mv-emojis'

// ============================================================================
// Icon Mapping
// ============================================================================

const CATEGORY_ICONS: Record<string, React.FC<{ className?: string }>> = {
	Zap,
	Smile,
	Hash,
	Trophy,
	Map,
	Lightbulb,
	Coffee,
	Cat,
	Flag,
}

// ============================================================================
// Types
// ============================================================================

interface EmojiPickerProps {
	onSelect: (emoji: MvEmoji) => void
	className?: string
	disabled?: boolean
}

// ============================================================================
// Constants
// ============================================================================

const MEDIAVIDA_BASE_URL = 'https://www.mediavida.com'

// ============================================================================
// Component
// ============================================================================

export function EmojiPicker({ onSelect, className, disabled = false }: EmojiPickerProps) {
	const [open, setOpen] = useState(false)
	const [search, setSearch] = useState('')
	const [emojis, setEmojis] = useState<MvEmojiCategory[]>([])
	const [isLoading, setIsLoading] = useState(false)
	const [activeTab, setActiveTab] = useState('')

	// Load emojis when popover opens
	useEffect(() => {
		if (open && emojis.length === 0) {
			setIsLoading(true)
			loadEmojis().then(data => {
				setEmojis(data)
				if (data.length > 0 && !activeTab) {
					setActiveTab(data[0].category)
				}
				setIsLoading(false)
			})
		}
	}, [open, emojis.length, activeTab])

	// Filter emojis based on search
	const filteredCategories = useMemo(() => {
		if (!search.trim()) return emojis

		const query = search.toLowerCase()
		return emojis
			.map(category => ({
				...category,
				items: category.items.filter(emoji => emoji.code.toLowerCase().includes(query)),
			}))
			.filter(category => category.items.length > 0)
	}, [search, emojis])

	// Handle emoji selection
	const handleSelect = useCallback(
		(emoji: MvEmoji) => {
			onSelect(emoji)
			setOpen(false)
			setSearch('')
		},
		[onSelect]
	)

	// Get icon component for category
	const getCategoryIcon = (iconName: string) => {
		return CATEGORY_ICONS[iconName] || Smile
	}

	return (
		<Popover open={open} onOpenChange={setOpen} modal={false}>
			<Tooltip>
				<TooltipTrigger asChild>
					<PopoverTrigger asChild>
						<Button
							type="button"
							variant="ghost"
							size="icon-sm"
							className={cn('text-muted-foreground hover:text-foreground', className)}
							disabled={disabled}
						>
							<Smile className="h-4 w-4" />
						</Button>
					</PopoverTrigger>
				</TooltipTrigger>
				<TooltipContent side="bottom" className="text-xs">
					Insertar emoji
				</TooltipContent>
			</Tooltip>

			<PopoverContent align="start" className="w-[320px] p-0" onOpenAutoFocus={e => e.preventDefault()}>
				{isLoading ? (
					<div className="flex items-center justify-center py-12">
						<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
					</div>
				) : (
					<>
						<div className="p-2 border-b border-border">
							<div className="relative">
								<Smile className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
								<Input
									type="text"
									placeholder="Buscar emoji..."
									value={search}
									onChange={e => setSearch(e.target.value)}
									className="pl-8 h-8 text-sm"
								/>
							</div>
						</div>

						<Tabs value={search ? 'search' : activeTab} onValueChange={val => !search && setActiveTab(val)}>
							{!search && emojis.length > 0 && (
								<TabsList className="w-full h-9 justify-start gap-0.5 p-1 bg-muted/50 rounded-none border-b">
									{emojis.map(category => {
										const IconComponent = getCategoryIcon(category.icon)
										return (
											<TabsTrigger
												key={category.category}
												value={category.category}
												className="flex-1 h-7 px-1.5 data-[state=active]:bg-background"
												title={category.category}
											>
												<IconComponent className="h-4 w-4" />
											</TabsTrigger>
										)
									})}
								</TabsList>
							)}

							<ScrollArea className="h-[280px]">
								{search && (
									<div className="p-2">
										{filteredCategories.length === 0 ? (
											<div className="text-center text-muted-foreground text-sm py-8">No se encontraron emojis</div>
										) : (
											filteredCategories.map(category => (
												<div key={category.category} className="mb-3">
													<h4 className="text-xs font-medium text-muted-foreground mb-2 px-1">{category.category}</h4>
													<EmojiGrid emojis={category.items} onSelect={handleSelect} />
												</div>
											))
										)}
									</div>
								)}

								{!search &&
									emojis.map(category => (
										<TabsContent
											key={category.category}
											value={category.category}
											className="p-2 mt-0 focus-visible:outline-none"
										>
											<EmojiGrid emojis={category.items} onSelect={handleSelect} />
										</TabsContent>
									))}
							</ScrollArea>
						</Tabs>
					</>
				)}
			</PopoverContent>
		</Popover>
	)
}

// ============================================================================
// EmojiGrid Sub-component
// ============================================================================

interface EmojiGridProps {
	emojis: MvEmoji[]
	onSelect: (emoji: MvEmoji) => void
}

function EmojiGrid({ emojis, onSelect }: EmojiGridProps) {
	return (
		<div className="grid grid-cols-8 gap-0.5">
			{emojis.map(emoji => (
				<Tooltip key={emoji.code}>
					<TooltipTrigger asChild>
						<button
							type="button"
							onClick={() => onSelect(emoji)}
							className="h-8 w-8 flex items-center justify-center rounded hover:bg-accent transition-colors"
						>
							<img
								src={`${MEDIAVIDA_BASE_URL}${emoji.url}`}
								alt={emoji.code}
								loading="lazy"
								width={20}
								height={20}
								className="h-5 w-5 object-contain"
							/>
						</button>
					</TooltipTrigger>
					<TooltipContent side="top" className="text-xs z-[60]">
						{emoji.code}
					</TooltipContent>
				</Tooltip>
			))}
		</div>
	)
}
