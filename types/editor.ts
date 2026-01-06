/**
 * Editor Types & Configuration
 *
 * Centralized definitions for toolbar buttons, snippets, and keyboard shortcuts.
 * Designed for reuse across Dashboard (React state) and Content Scripts (DOM refs).
 */

// ============================================================================
// Toolbar Action Types
// ============================================================================

/**
 * Action types supported by toolbar buttons
 */
export type ToolbarActionType =
	| 'wrap' // Wraps selection: [b]texto[/b]
	| 'insert' // Inserts snippet with {{cursor}} support
	| 'dialog' // Opens a dialog (URL, table, color, etc.)
	| 'custom' // Custom callback function

/**
 * Wrap action - wraps selected text with prefix/suffix
 */
export interface WrapAction {
	type: 'wrap'
	prefix: string
	suffix: string
}

/**
 * Insert action - inserts text at cursor, processes {{cursor}} token
 */
export interface InsertAction {
	type: 'insert'
	template: string // Supports {{cursor}} for cursor positioning
}

/**
 * Dialog action - triggers opening a dialog/popover
 */
export interface DialogAction {
	type: 'dialog'
	dialogId: string // 'url' | 'table' | 'code' | 'color' | 'image' | 'movie'
}

/**
 * Custom action - calls a provided callback
 */
export interface CustomAction {
	type: 'custom'
	handler: () => void
}

export type ToolbarAction = WrapAction | InsertAction | DialogAction | CustomAction

// ============================================================================
// Button Groups
// ============================================================================

export type ToolbarButtonGroup =
	| 'format' // Bold, Italic, Underline, Strike
	| 'inline' // Quote, Center, Spoiler
	| 'insert' // Link, Image, Table, Emoji
	| 'snippets' // Quick templates dropdown
	| 'actions' // Undo, Redo, Clear
	| 'help' // Keyboard shortcuts help

// ============================================================================
// Button Configuration
// ============================================================================

export interface ToolbarButtonConfig {
	id: string
	/** FontAwesome class (e.g., 'fa-bold') or Lucide component name */
	icon: string
	label: string
	tooltip: string
	/** Keyboard shortcut display (e.g., "Ctrl+B") */
	shortcut?: string
	group: ToolbarButtonGroup
	action: ToolbarAction
	/** Whether button is hidden by default */
	hidden?: boolean
}

// ============================================================================
// Snippet Configuration
// ============================================================================

export interface SnippetConfig {
	id: string
	label: string
	description?: string
	/** Template with {{cursor}} for cursor positioning */
	template: string
	icon?: string // FontAwesome class
}

// ============================================================================
// Keyboard Shortcut Mapping
// ============================================================================

export interface KeyboardShortcut {
	/** Key combination: "Ctrl+B", "Ctrl+Shift+K", "Alt+T" */
	key: string
	/** Button ID to trigger */
	buttonId: string
}

// ============================================================================
// Editor History Entry (for Undo/Redo)
// ============================================================================

export interface HistoryEntry {
	content: string
	selectionStart: number
	selectionEnd: number
	timestamp: number
}

// ============================================================================
// Default Configuration
// ============================================================================

/**
 * Default toolbar buttons using FontAwesome icons
 */
export const DEFAULT_TOOLBAR_BUTTONS: ToolbarButtonConfig[] = [
	// ─── Format Group ───
	{
		id: 'bold',
		icon: 'fa-bold',
		label: 'Negrita',
		tooltip: 'Negrita (Ctrl+B)',
		shortcut: 'Ctrl+B',
		group: 'format',
		action: { type: 'wrap', prefix: '[b]', suffix: '[/b]' },
	},
	{
		id: 'italic',
		icon: 'fa-italic',
		label: 'Cursiva',
		tooltip: 'Cursiva (Ctrl+I)',
		shortcut: 'Ctrl+I',
		group: 'format',
		action: { type: 'wrap', prefix: '[i]', suffix: '[/i]' },
	},
	{
		id: 'underline',
		icon: 'fa-underline',
		label: 'Subrayado',
		tooltip: 'Subrayado (Ctrl+U)',
		shortcut: 'Ctrl+U',
		group: 'format',
		action: { type: 'wrap', prefix: '[u]', suffix: '[/u]' },
	},
	{
		id: 'strikethrough',
		icon: 'fa-strikethrough',
		label: 'Tachado',
		tooltip: 'Tachado',
		group: 'format',
		action: { type: 'wrap', prefix: '[s]', suffix: '[/s]' },
	},

	// ─── Structure Group ───
	{
		id: 'link',
		icon: 'fa-link',
		label: 'Enlace',
		tooltip: 'Insertar enlace (Ctrl+K)',
		shortcut: 'Ctrl+K',
		group: 'insert',
		action: { type: 'dialog', dialogId: 'url' },
	},
	{
		id: 'quote',
		icon: 'fa-quote-left',
		label: 'Cita',
		tooltip: 'Insertar cita',
		group: 'inline',
		action: { type: 'wrap', prefix: '[quote]', suffix: '[/quote]' },
	},
	{
		id: 'code',
		icon: 'fa-code',
		label: 'Código',
		tooltip: 'Insertar código',
		group: 'insert',
		action: { type: 'dialog', dialogId: 'code' },
	},
	{
		id: 'center',
		icon: 'fa-align-center',
		label: 'Centrar',
		tooltip: 'Centrar texto',
		group: 'inline',
		action: { type: 'wrap', prefix: '[center]', suffix: '[/center]' },
	},
	{
		id: 'spoiler',
		icon: 'fa-eye-slash',
		label: 'Spoiler',
		tooltip: 'Ocultar como spoiler',
		group: 'inline',
		action: { type: 'wrap', prefix: '[spoiler]', suffix: '[/spoiler]' },
	},
	{
		id: 'nsfw',
		icon: 'fa-ban',
		label: 'NSFW',
		tooltip: 'Contenido sensible (NSFW)',
		group: 'inline',
		action: { type: 'wrap', prefix: '[spoiler=NSFW]', suffix: '[/spoiler]' },
	},

	// ─── Media Group ───
	{
		id: 'image',
		icon: 'fa-image',
		label: 'Imagen',
		tooltip: 'Subir imagen',
		group: 'insert',
		action: { type: 'dialog', dialogId: 'image' },
	},
	{
		id: 'table',
		icon: 'fa-table',
		label: 'Tabla',
		tooltip: 'Insertar/editar tabla',
		group: 'insert',
		action: { type: 'dialog', dialogId: 'table' },
	},
	{
		id: 'index',
		icon: 'fa-list-ol',
		label: 'Índice',
		tooltip: 'Crear índice con anclas',
		group: 'insert',
		action: { type: 'dialog', dialogId: 'index' },
	},

	// ─── Actions Group ───
	{
		id: 'undo',
		icon: 'fa-undo',
		label: 'Deshacer',
		tooltip: 'Deshacer (Ctrl+Z)',
		shortcut: 'Ctrl+Z',
		group: 'actions',
		action: { type: 'custom', handler: () => {} }, // Handler set at runtime
	},
	{
		id: 'redo',
		icon: 'fa-repeat',
		label: 'Rehacer',
		tooltip: 'Rehacer (Ctrl+Y)',
		shortcut: 'Ctrl+Y',
		group: 'actions',
		action: { type: 'custom', handler: () => {} }, // Handler set at runtime
	},
]

/**
 * Default snippets for quick insertion
 */
export const DEFAULT_SNIPPETS: SnippetConfig[] = [
	{
		id: 'table-3x3',
		label: 'Tabla 3x3',
		description: 'Tabla Markdown de 3 columnas',
		icon: 'fa-table',
		template: `| Cabecera 1 | Cabecera 2 | Cabecera 3 |
|:---|:---|:---|
| {{cursor}} |  |  |
|  |  |  |
|  |  |  |`,
	},
	{
		id: 'thread-template',
		label: 'Plantilla de Hilo',
		description: 'Estructura básica para nuevo hilo',
		icon: 'fa-file-text-o',
		template: `[bar]Introducción[/bar]
{{cursor}}

[bar]Desarrollo[/bar]


[bar]Conclusión[/bar]

`,
	},
	{
		id: 'code-block',
		label: 'Bloque de Código',
		description: 'Código con lenguaje',
		icon: 'fa-terminal',
		template: `[code=javascript]
{{cursor}}
[/code]`,
	},
	{
		id: 'spoiler-block',
		label: 'Spoiler con Título',
		description: 'Contenido oculto con título',
		icon: 'fa-eye-slash',
		template: `[spoiler=Título]
{{cursor}}
[/spoiler]`,
	},
	{
		id: 'image-centered',
		label: 'Imagen Centrada',
		description: 'Imagen con centrado',
		icon: 'fa-picture-o',
		template: `[center][img]{{cursor}}[/img][/center]`,
	},
	{
		id: 'quote-author',
		label: 'Cita con Autor',
		description: 'Cita atribuida',
		icon: 'fa-quote-right',
		template: `[quote=Autor]
{{cursor}}
[/quote]`,
	},
]

/**
 * Default keyboard shortcuts
 */
export const DEFAULT_SHORTCUTS: KeyboardShortcut[] = [
	{ key: 'Ctrl+B', buttonId: 'bold' },
	{ key: 'Ctrl+I', buttonId: 'italic' },
	{ key: 'Ctrl+U', buttonId: 'underline' },
	{ key: 'Ctrl+K', buttonId: 'link' },
	{ key: 'Ctrl+Z', buttonId: 'undo' },
	{ key: 'Ctrl+Y', buttonId: 'redo' },
	{ key: 'Ctrl+Shift+Z', buttonId: 'redo' },
]
