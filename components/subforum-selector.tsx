import { useState, useEffect, useRef, useMemo } from 'react'
import Check from 'lucide-react/dist/esm/icons/check'
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down'
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right'
import Search from 'lucide-react/dist/esm/icons/search'
import Star from 'lucide-react/dist/esm/icons/star'
import X from 'lucide-react/dist/esm/icons/x'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { ALL_SUBFORUMS } from '@/lib/subforums'
import { getSubforumStyle, SUBFORUM_GROUPS } from '@/lib/subforum-icons'
import { getCategoriesForSubforum } from '@/lib/subforum-categories'
import { useFavoriteSubforums } from '@/features/favorite-subforums/hooks/use-favorite-subforums'
import { NativeFidIcon } from '@/components/native-fid-icon'

interface SubforumSelectorProps {
	value: string
	onValueChange: (value: string) => void
	className?: string
}

/**
 * SubforumSelector component - Advanced subforum selector with groups and favorites
 * Includes visual styling (colors/icons) based on the selected subforum.
 * @param value - Selected subforum slug
 * @param onValueChange - Callback when a subforum is selected
 * @param className - Optional CSS classes
 */
export function SubforumSelector({ value, onValueChange, className }: SubforumSelectorProps) {
	const [open, setOpen] = useState(false)
	const [search, setSearch] = useState('')
	const inputRef = useRef<HTMLInputElement>(null)
	const { subforums: favoriteSubforums } = useFavoriteSubforums()

	const selectedSubforum = ALL_SUBFORUMS.find(sf => sf.slug === value)

	useEffect(() => {
		if (!open) {
			setSearch('')
		} else {
			setTimeout(() => inputRef.current?.focus(), 50)
		}
	}, [open])

	const favoriteIds = useMemo(() => new Set(favoriteSubforums.map(f => f.id)), [favoriteSubforums])
	const favoritesList = useMemo(() => ALL_SUBFORUMS.filter(sf => favoriteIds.has(sf.slug)), [favoriteIds])

	const normalizedSearch = search.toLowerCase().trim()

	const filteredFavorites = useMemo(() => {
		if (!normalizedSearch) return favoritesList
		return favoritesList.filter(sf => sf.name.toLowerCase().includes(normalizedSearch))
	}, [favoritesList, normalizedSearch])
	const filteredGroups = useMemo(() => {
		const groups = SUBFORUM_GROUPS.map(group => ({
			...group,
			slugs: group.slugs.filter(slug => {
				if (favoriteIds.has(slug)) return false

				if (!normalizedSearch) return true
				const sf = ALL_SUBFORUMS.find(s => s.slug === slug)
				return sf?.name.toLowerCase().includes(normalizedSearch)
			}),
		})).filter(group => group.slugs.length > 0)

		return groups
	}, [normalizedSearch, favoriteIds])

	const hasResults = filteredGroups.length > 0 || filteredFavorites.length > 0

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					role="combobox"
					aria-expanded={open}
					className={cn(
						'h-8 px-3 gap-2 text-sm font-medium rounded-md transition-all border-dashed',
						'text-muted-foreground hover:text-foreground hover:border-primary/30',
						selectedSubforum && 'bg-secondary text-secondary-foreground border-solid border-border',
						className
					)}
				>
					{selectedSubforum && (
						<NativeFidIcon iconId={selectedSubforum.iconId} className="h-4 w-4 shrink-0" />
					)}
					<span>{selectedSubforum?.name || 'Seleccionar subforo'}</span>
					<ChevronDown className="h-3.5 w-3.5 opacity-60" />
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-[280px] p-2" align="start">
				<div className="relative mb-2">
					<Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
					<Input
						ref={inputRef}
						value={search}
						onChange={e => setSearch(e.target.value)}
						placeholder="Buscar subforo..."
						className="h-8 pl-8 pr-8 text-sm"
					/>
					{search && (
						<button
							type="button"
							onClick={() => setSearch('')}
							className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
						>
							<X className="h-3.5 w-3.5" />
						</button>
					)}
				</div>

				<div className="max-h-[280px] overflow-y-auto pr-1 custom-scroll">
					<div className="space-y-3">
						{!normalizedSearch && (
							<button
								type="button"
								onClick={() => {
									onValueChange('none')
									setOpen(false)
								}}
								className={cn(
									'w-full flex items-center gap-3 px-2 py-2 rounded-md text-left transition-all text-sm',
									value === 'none'
										? 'bg-accent text-foreground'
										: 'hover:bg-accent/50 text-muted-foreground hover:text-foreground'
								)}
							>
								<span>Sin subforo</span>
								{value === 'none' && <Check className="h-4 w-4 ml-auto" />}
							</button>
						)}

						{normalizedSearch && !hasResults && (
							<div className="text-center py-6 text-sm text-muted-foreground">No se encontraron subforos</div>
						)}
						{filteredFavorites.length > 0 && (
							<div>
								<div className="text-[10px] font-bold uppercase tracking-widest text-yellow-500/80 px-2 py-1.5 mt-1 flex items-center gap-1.5">
									<Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
									FAVORITOS
								</div>
								<div className="space-y-0.5">
									{filteredFavorites.map(sf => {
										const sfStyle = getSubforumStyle(sf.slug)
										const isSelected = value === sf.slug
										const categoryCount = getCategoriesForSubforum(sf.slug).length

										return (
											<button
												type="button"
												key={sf.slug}
												onClick={() => {
													onValueChange(sf.slug)
													setOpen(false)
												}}
												className={cn(
													'w-full flex items-center gap-3 px-2 py-2 rounded-md text-left transition-all group',
													isSelected
														? 'bg-gradient-to-r from-yellow-500/10 to-yellow-500/5 border-l-2 border-yellow-500'
														: 'hover:bg-accent/50'
												)}
											>
												<NativeFidIcon iconId={sf.iconId} className="h-4 w-4 shrink-0" />
												<div className="flex-1 min-w-0">
													<div
														className={cn(
															'text-sm truncate',
															isSelected
																? 'font-medium text-foreground'
																: 'text-muted-foreground group-hover:text-foreground'
														)}
													>
														{sf.name}
													</div>
													{categoryCount > 0 && (
														<div className="text-[10px] text-muted-foreground/60">{categoryCount} categorías</div>
													)}
												</div>
												{isSelected && <Check className="h-4 w-4 text-yellow-500 shrink-0" />}
												{!isSelected && categoryCount > 0 && (
													<ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
												)}
											</button>
										)
									})}
								</div>
							</div>
						)}

						{filteredGroups.map(group => (
							<div key={group.name}>
								<div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 px-2 py-1.5 mt-1">
									{group.name}
								</div>
								<div className="space-y-0.5">
									{group.slugs.map(slug => {
										const sf = ALL_SUBFORUMS.find(s => s.slug === slug)
										if (!sf) return null
										const sfStyle = getSubforumStyle(slug)
										const isSelected = value === slug
										const categoryCount = getCategoriesForSubforum(slug).length

										return (
											<button
												type="button"
												key={slug}
												onClick={() => {
													onValueChange(slug)
													setOpen(false)
												}}
												className={cn(
													'w-full flex items-center gap-3 px-2 py-2 rounded-md text-left transition-all group',
													isSelected
														? 'bg-gradient-to-r from-primary/10 to-primary/5 border-l-2 border-primary'
														: 'hover:bg-accent/50'
												)}
											>
												<NativeFidIcon iconId={sf.iconId} className="h-4 w-4 shrink-0" />
												<div className="flex-1 min-w-0">
													<div
														className={cn(
															'text-sm truncate',
															isSelected
																? 'font-medium text-foreground'
																: 'text-muted-foreground group-hover:text-foreground'
														)}
													>
														{sf.name}
													</div>
													{categoryCount > 0 && (
														<div className="text-[10px] text-muted-foreground/60">{categoryCount} categorías</div>
													)}
												</div>
												{isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
												{!isSelected && categoryCount > 0 && (
													<ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
												)}
											</button>
										)
									})}
								</div>
							</div>
						))}
					</div>
				</div>
			</PopoverContent>
		</Popover>
	)
}
