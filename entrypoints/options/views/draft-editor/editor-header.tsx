/**
 * EditorHeader Component
 * Header section with title input and metadata selectors
 */

import { useState } from 'react'
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right'
import FolderPlus from 'lucide-react/dist/esm/icons/folder-plus'
import Folder from 'lucide-react/dist/esm/icons/folder'

import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SubforumSelector } from '@/components/subforum-selector'
import { CategorySelector } from '@/components/category-selector'
import { getCategoriesForSubforum } from '@/lib/subforum-categories'
import { cn } from '@/lib/utils'
import type { EditorHeaderProps } from './types'

export function EditorHeader({ docType, isEditing, form, folders, onOpenFolderDialog }: EditorHeaderProps) {
	const [autoCategoryOpen, setAutoCategoryOpen] = useState(false)

	const title = form.watch('title')
	const trigger = form.watch('trigger')
	const subforum = form.watch('subforum')
	const category = form.watch('category')
	const folderId = form.watch('folderId')

	return (
		<div className="px-6 pt-6 pb-3 space-y-4 border-b border-border/50">
			{/* Title Input - Large, clean, no label */}
			<div className="relative">
				<input
					type="text"
					value={title}
					onChange={e => {
						form.setValue('title', e.target.value.slice(0, 72), { shouldDirty: true })
					}}
					maxLength={72}
					placeholder="Escribe un título..."
					className="w-full text-3xl font-bold border-none shadow-none focus-visible:ring-0 pl-0 pr-16 bg-transparent placeholder:text-muted-foreground/40 h-auto py-1 focus:outline-none"
				/>
				{title.length > 0 && (
					<span
						className={cn(
							'absolute right-2 bottom-2 text-[10px] tabular-nums',
							title.length >= 65 ? 'text-orange-500' : 'text-muted-foreground/60',
							title.length >= 72 && 'text-destructive'
						)}
					>
						{title.length}/72
					</span>
				)}
			</div>

			{/* Metadata Row - Premium inline selectors */}
			<div className="flex items-center gap-2 flex-wrap">
				{/* Trigger Input - Only for templates */}
				{docType === 'template' && (
					<>
						<div className="flex items-center gap-1 px-3 h-8 rounded-md bg-amber-500/10 hover:bg-amber-500/15 transition-colors cursor-text border border-amber-500/20 hover:border-amber-500/40">
							<span className="text-amber-600 dark:text-amber-400 text-sm font-bold font-mono">/</span>
							<input
								type="text"
								value={trigger}
								onChange={e => {
									const val = e.target.value
										.toLowerCase()
										.replace(/[^a-z0-9-]/g, '')
										.slice(0, 16)
									form.setValue('trigger', val, { shouldDirty: true })
								}}
								maxLength={16}
								placeholder="atajo"
								className="w-24 bg-transparent border-none outline-none text-sm font-mono font-medium text-amber-600 dark:text-amber-400 placeholder:text-muted-foreground/40"
							/>
						</div>
						<ChevronRight className="h-4 w-4 text-muted-foreground/30" />
					</>
				)}

				{/* Subforum Selector */}
				<SubforumSelector
					value={subforum}
					onValueChange={value => {
						form.setValue('subforum', value, { shouldDirty: true })
						form.setValue('category', 'none', { shouldDirty: true })
						if (value !== 'none' && getCategoriesForSubforum(value).length > 0) {
							setAutoCategoryOpen(true)
						}
					}}
				/>

				{/* Category Selector - Only show if subforum has categories */}
				{subforum !== 'none' && getCategoriesForSubforum(subforum).length > 0 && (
					<>
						<ChevronRight className="h-4 w-4 text-muted-foreground/30" />
						<CategorySelector
							subforum={subforum}
							value={category}
							onValueChange={val => {
								form.setValue('category', val, { shouldDirty: true })
							}}
							autoOpen={autoCategoryOpen}
							onAutoOpenConsumed={() => setAutoCategoryOpen(false)}
						/>
					</>
				)}

				{/* Separator */}
				<ChevronRight className="h-4 w-4 text-muted-foreground/30" />

				{/* Folder Select */}
				<Select
					value={folderId}
					onValueChange={val => {
						form.setValue('folderId', val, { shouldDirty: true })
					}}
				>
					<SelectTrigger className="border-none shadow-none bg-transparent hover:bg-accent/50 px-2 h-8 text-sm text-muted-foreground hover:text-foreground w-auto gap-1.5 cursor-pointer focus-visible:ring-0 [&>svg:last-child]:opacity-0 [&>svg:last-child]:w-0">
						<SelectValue placeholder="Carpeta" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="none">Sin carpeta</SelectItem>
						{folders.map(f => (
							<SelectItem key={f.id} value={f.id}>
								<span className="flex items-center gap-2">
									<Folder className="h-4 w-4" />
									{f.name}
								</span>
							</SelectItem>
						))}
					</SelectContent>
				</Select>

				{/* New Folder Button */}
				<Button
					type="button"
					variant="ghost"
					size="icon"
					className="h-8 w-8 text-muted-foreground/50 hover:text-foreground"
					onClick={onOpenFolderDialog}
					title="Nueva carpeta"
				>
					<FolderPlus className="h-3.5 w-3.5" />
				</Button>
			</div>
		</div>
	)
}
