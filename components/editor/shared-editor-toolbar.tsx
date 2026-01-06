/**
 * SharedEditorToolbar - Reusable Toolbar Component
 *
 * A visual toolbar using Shadcn UI components with Lucide icons.
 * Designed for use in Dashboard (React pure) context.
 */
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
	DropdownMenuSeparator,
	DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import Code from 'lucide-react/dist/esm/icons/code'
import Heading from 'lucide-react/dist/esm/icons/heading'
import Wand2 from 'lucide-react/dist/esm/icons/wand-2'
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down'
import FileText from 'lucide-react/dist/esm/icons/file-text'
import List from 'lucide-react/dist/esm/icons/list'
import Play from 'lucide-react/dist/esm/icons/play'
import Clapperboard from 'lucide-react/dist/esm/icons/clapperboard'
import ChartBar from 'lucide-react/dist/esm/icons/chart-bar'
import type { ToolbarButtonConfig, SnippetConfig, ToolbarButtonGroup } from '@/types/editor'
import { DEFAULT_TOOLBAR_BUTTONS, DEFAULT_SNIPPETS } from '@/types/editor'
import {
	ToolbarGroup,
	ToolbarSeparator,
	getToolbarIcon,
	CODE_LANGUAGES,
	LIST_TYPES,
	HEADER_TYPES,
	EmojiPicker,
} from './toolbar'
import type { MvEmoji } from '@/constants/mv-emojis'

import { GifPicker } from '@/features/editor/components/toolbar/gif-picker'
import { useSettingsStore } from '@/store/settings-store'

// ============================================================================
// Types
// ============================================================================

interface SharedEditorToolbarProps {
	/** Execute action by button ID */
	onAction: (buttonId: string) => void
	/** Handle dialog actions */
	onDialog?: (dialogId: string) => void
	/** Custom buttons (merged with defaults) */
	buttons?: ToolbarButtonConfig[]
	/** Custom snippets (merged with defaults) */
	snippets?: SnippetConfig[]
	/** Insert snippet template */
	onInsertSnippet?: (template: string) => void
	/** Wrap selection with prefix/suffix */
	onWrapSelection?: (prefix: string, suffix: string) => void
	/** Insert list with prefix on each line */
	onInsertList?: (prefix: string) => void
	/** Show undo/redo buttons */
	showHistory?: boolean
	/** Can undo */
	canUndo?: boolean
	/** Can redo */
	canRedo?: boolean
	/** Hide specific button groups */
	hideGroups?: ToolbarButtonGroup[]
	/** Additional class names */
	className?: string
	/** Is cursor inside a table (for edit highlight) */
	isTableAtCursor?: boolean
	/** Insert emoji code */
	onInsertEmoji?: (emoji: MvEmoji) => void
	/** Insert GIF BBCode */
	onInsertGif?: (bbcode: string) => void
	/** Open insert template dialog */
	onInsertTemplate?: () => void
	/** Active format IDs at cursor (for toggle highlighting) */
	activeFormats?: string[]
	/** Replace selection with text */
	onReplaceText?: (text: string) => void
	/** Get current selection text */
	onGetSelection?: () => string | Promise<string>
	/** Get full editor content */
	onGetFullContent?: () => string
	/** Replace entire editor content */
	onReplaceAll?: (text: string) => void
	/** Document title for AI context */
	documentTitle?: string
}

// ============================================================================
// Component
// ============================================================================

export function SharedEditorToolbar({
	onAction,
	onDialog,
	buttons = DEFAULT_TOOLBAR_BUTTONS,
	snippets = DEFAULT_SNIPPETS,
	onInsertSnippet,
	onWrapSelection,
	onInsertList,
	showHistory = true,
	canUndo = false,
	canRedo = false,
	hideGroups = [],
	className,
	isTableAtCursor = false,
	onInsertEmoji,
	onInsertGif,
	onInsertTemplate,
	activeFormats = [],
	onReplaceText,
	onGetSelection,
	onGetFullContent,
	onReplaceAll,
	documentTitle,
}: SharedEditorToolbarProps) {
	// Feature toggles from settings
	const gifPickerEnabled = useSettingsStore(state => state.gifPickerEnabled)
	const cinemaButtonEnabled = useSettingsStore(state => state.cinemaButtonEnabled)

	// Filter buttons by group visibility
	const visibleButtons = buttons.filter(btn => !btn.hidden && !hideGroups.includes(btn.group))

	// Group buttons - exclude code (we have custom dropdown)
	const formatButtons = visibleButtons.filter(b => b.group === 'format')
	const inlineButtons = visibleButtons.filter(b => b.group === 'inline')
	const insertButtons = visibleButtons.filter(b => b.group === 'insert' && b.id !== 'code')
	const actionButtons = visibleButtons.filter(b => b.group === 'actions')

	// Handle button click
	const handleButtonClick = (button: ToolbarButtonConfig) => {
		if (button.action.type === 'dialog') {
			onDialog?.(button.action.dialogId)
		} else {
			onAction(button.id)
		}
	}

	// Handle code language selection
	const handleCodeInsert = (langId: string) => {
		const template = langId ? `[code=${langId}]\n{{cursor}}\n[/code]` : `[code]\n{{cursor}}\n[/code]`
		onInsertSnippet?.(template)
	}

	// Handle list selection
	const handleListInsert = (prefix: string) => {
		if (onInsertList) {
			onInsertList(prefix)
		} else {
			onInsertSnippet?.(prefix + '{{cursor}}')
		}
	}

	// Handle header selection
	const handleHeaderInsert = (header: typeof HEADER_TYPES[number]) => {
		if (header.suffix && onWrapSelection) {
			onWrapSelection(header.prefix, header.suffix)
		} else if (onWrapSelection) {
			onWrapSelection(header.prefix, '')
		} else {
			const template = header.suffix ? `${header.prefix}{{cursor}}${header.suffix}` : `${header.prefix}{{cursor}}`
			onInsertSnippet?.(template)
		}
	}

	// Handle media insert
	const handleMediaInsert = () => {
		if (onWrapSelection) {
			onWrapSelection('[media]', '[/media]')
		} else {
			onInsertSnippet?.('[media]{{cursor}}[/media]')
		}
	}

	// Get snippet icon
	const getSnippetIcon = (iconName?: string) => {
		if (!iconName) return <FileText className="h-4 w-4 text-muted-foreground" />
		const IconComponent = getToolbarIcon(iconName)
		return IconComponent ? (
			<IconComponent className="h-4 w-4 text-muted-foreground" />
		) : (
			<FileText className="h-4 w-4 text-muted-foreground" />
		)
	}

	return (
		<TooltipProvider delayDuration={300}>
			<div
				className={cn(
					'flex items-center gap-1 px-2 py-1 bg-muted/50 border-b border-border overflow-x-auto [&::-webkit-scrollbar]:h-[2px] [&::-webkit-scrollbar-thumb]:bg-foreground/5 hover:[&::-webkit-scrollbar-thumb]:bg-foreground/20 [&::-webkit-scrollbar-track]:bg-transparent',
					className
				)}
			>
				<ToolbarGroup
					buttons={formatButtons}
					groupKey="format"
					onButtonClick={handleButtonClick}
					activeButtonIds={activeFormats}
				/>

				<ToolbarSeparator />

				<div className="flex items-center gap-0.5">
					{/* Header Dropdown */}
					<DropdownMenu modal={false}>
						<Tooltip>
							<TooltipTrigger asChild>
								<DropdownMenuTrigger asChild>
									<Button
										type="button"
										variant="ghost"
										size="icon-sm"
										className="text-muted-foreground hover:text-foreground"
									>
										<Heading className="h-4 w-4" />
									</Button>
								</DropdownMenuTrigger>
							</TooltipTrigger>
							<TooltipContent side="bottom" className="text-xs">
								Insertar encabezado
							</TooltipContent>
						</Tooltip>
						<DropdownMenuContent align="start" className="w-52">
							<DropdownMenuLabel>Encabezados</DropdownMenuLabel>
							<DropdownMenuSeparator />
							{HEADER_TYPES.map(header => (
								<DropdownMenuItem key={header.id} onClick={() => handleHeaderInsert(header)} className="gap-2">
									<header.icon className="h-4 w-4" />
									<div className="flex flex-col">
										<span>{header.label}</span>
										<span className="text-xs text-muted-foreground">{header.description}</span>
									</div>
								</DropdownMenuItem>
							))}
						</DropdownMenuContent>
					</DropdownMenu>

					<DropdownMenu modal={false}>
						<Tooltip>
							<TooltipTrigger asChild>
								<DropdownMenuTrigger asChild>
									<Button
										type="button"
										variant="ghost"
										size="icon-sm"
										className="text-muted-foreground hover:text-foreground"
									>
										<List className="h-4 w-4" />
									</Button>
								</DropdownMenuTrigger>
							</TooltipTrigger>
							<TooltipContent side="bottom" className="text-xs">
								Insertar lista
							</TooltipContent>
						</Tooltip>
						<DropdownMenuContent align="start" className="w-48">
							<DropdownMenuLabel>Tipo de lista</DropdownMenuLabel>
							<DropdownMenuSeparator />
							{LIST_TYPES.map(list => (
								<DropdownMenuItem key={list.id} onClick={() => handleListInsert(list.prefix)} className="gap-2">
									<list.icon className="h-4 w-4" />
									<span>{list.label}</span>
								</DropdownMenuItem>
							))}
						</DropdownMenuContent>
					</DropdownMenu>
				</div>

				<ToolbarSeparator />

				<ToolbarGroup
					buttons={inlineButtons}
					groupKey="inline"
					onButtonClick={handleButtonClick}
					activeButtonIds={activeFormats}
				/>

				<ToolbarSeparator />

				<div className="flex items-center gap-0.5">
					<ToolbarGroup
						buttons={insertButtons}
						groupKey="insert"
						onButtonClick={handleButtonClick}
						highlightedButton={isTableAtCursor ? 'table' : undefined}
						highlightTooltip="Editar tabla"
					/>

					<DropdownMenu modal={false}>
						<Tooltip>
							<TooltipTrigger asChild>
								<DropdownMenuTrigger asChild>
									<Button
										type="button"
										variant="ghost"
										size="icon-sm"
										className="text-muted-foreground hover:text-foreground"
									>
										<Code className="h-4 w-4" />
									</Button>
								</DropdownMenuTrigger>
							</TooltipTrigger>
							<TooltipContent side="bottom" className="text-xs">
								Insertar bloque de código
							</TooltipContent>
						</Tooltip>
						<DropdownMenuContent align="start" className="w-48 max-h-80 overflow-y-auto">
							<DropdownMenuLabel>Lenguaje</DropdownMenuLabel>
							<DropdownMenuSeparator />
							{CODE_LANGUAGES.map(lang => (
								<DropdownMenuItem key={lang.id || 'default'} onClick={() => handleCodeInsert(lang.id)}>
									{lang.label}
								</DropdownMenuItem>
							))}
						</DropdownMenuContent>
					</DropdownMenu>

					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								type="button"
								variant="ghost"
								size="icon-sm"
								className="text-muted-foreground hover:text-foreground"
								onClick={handleMediaInsert}
							>
								<Play className="h-4 w-4" />
							</Button>
						</TooltipTrigger>
						<TooltipContent side="bottom" className="text-xs">
							Media (vídeos, tweets, etc.)
						</TooltipContent>
					</Tooltip>

					{onInsertEmoji && <EmojiPicker onSelect={onInsertEmoji} />}

					{onInsertGif && gifPickerEnabled && <GifPicker onInsert={onInsertGif} />}

					{cinemaButtonEnabled && (
						<Tooltip>
							<TooltipTrigger asChild className="hidden md:flex">
								<Button
									type="button"
									variant="ghost"
									size="icon-sm"
									className="text-muted-foreground hover:text-foreground"
									onClick={() => onDialog?.('movie-template')}
								>
									<Clapperboard className="h-4 w-4" />
								</Button>
							</TooltipTrigger>
							<TooltipContent side="bottom" className="text-xs">
								Películas y series (TMDB)
							</TooltipContent>
						</Tooltip>
					)}

					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								type="button"
								variant="ghost"
								size="icon-sm"
								className="text-muted-foreground hover:text-foreground"
								onClick={() => onDialog?.('poll')}
							>
								<ChartBar className="h-4 w-4" />
							</Button>
						</TooltipTrigger>
						<TooltipContent side="bottom" className="text-xs">
							Crear encuesta
						</TooltipContent>
					</Tooltip>

					{onInsertTemplate && (
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									type="button"
									variant="ghost"
									size="icon-sm"
									className="text-muted-foreground hover:text-foreground"
									onClick={onInsertTemplate}
								>
									<Wand2 className="h-4 w-4" />
								</Button>
							</TooltipTrigger>
							<TooltipContent side="bottom" className="text-xs">
								Usar plantilla
							</TooltipContent>
						</Tooltip>
					)}
				</div>

				{snippets.length > 0 && onInsertSnippet && (
					<>
						<ToolbarSeparator />
						<DropdownMenu modal={false}>
							<Tooltip>
								<TooltipTrigger asChild>
									<DropdownMenuTrigger asChild>
										<Button
											type="button"
											variant="ghost"
											size="sm"
											className="text-muted-foreground hover:text-foreground h-7 px-2 gap-1"
										>
											<Wand2 className="h-4 w-4" />
											<span className="text-xs">Snippets</span>
											<ChevronDown className="h-3 w-3 ml-0.5" />
										</Button>
									</DropdownMenuTrigger>
								</TooltipTrigger>
								<TooltipContent side="bottom" className="text-xs">
									Plantillas rápidas
								</TooltipContent>
							</Tooltip>
							<DropdownMenuContent align="start" className="w-56">
								<DropdownMenuLabel>Insertar Plantilla</DropdownMenuLabel>
								<DropdownMenuSeparator />
								{snippets.map(snippet => (
									<DropdownMenuItem
										key={snippet.id}
										onClick={() => onInsertSnippet(snippet.template)}
										className="flex items-center gap-2"
									>
										{getSnippetIcon(snippet.icon)}
										<div className="flex flex-col">
											<span>{snippet.label}</span>
											{snippet.description && (
												<span className="text-xs text-muted-foreground">{snippet.description}</span>
											)}
										</div>
									</DropdownMenuItem>
								))}
							</DropdownMenuContent>
						</DropdownMenu>
					</>
				)}

				<div className="flex-grow" />

				{showHistory && (
					<div className="flex items-center gap-1 mr-2">
						<ToolbarGroup
							buttons={actionButtons}
							groupKey="actions"
							onButtonClick={handleButtonClick}
							disabledButtons={{
								undo: !canUndo,
								redo: !canRedo,
							}}
						/>
					</div>
				)}
			</div>
		</TooltipProvider>
	)
}
