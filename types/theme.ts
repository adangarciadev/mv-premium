/**
 * Theme Types - Definiciones de tipos para el sistema de personalización de temas
 */

/** Colores base de Shadcn UI */
export interface ThemeColors {
	// Core
	background: string
	foreground: string
	card: string
	cardForeground: string
	popover: string
	popoverForeground: string
	primary: string
	primaryForeground: string
	secondary: string
	secondaryForeground: string
	muted: string
	mutedForeground: string
	accent: string
	accentForeground: string
	destructive: string
	destructiveForeground: string
	border: string
	input: string
	ring: string

	// Sidebar
	sidebar: string
	sidebarForeground: string
	sidebarPrimary: string
	sidebarPrimaryForeground: string
	sidebarAccent: string
	sidebarAccentForeground: string
	sidebarBorder: string
	sidebarRing: string

	// Charts
	chart1: string
	chart2: string
	chart3: string
	chart4: string
	chart5: string

	// Tables
	tableHeader: string
	tableHeaderForeground: string
	tableRow: string
	tableRowAlt: string
	tableRowForeground: string
	tableBorder: string
}

/** Preset de tema completo con variantes light/dark */
export interface ThemePreset {
	id: string
	name: string
	author?: string
	description?: string
	colors: {
		light: ThemeColors
		dark: ThemeColors
	}
	radius?: string
}

/** Estado del tema personalizado */
export interface CustomThemeState {
	/** ID del preset activo o 'custom' si hay modificaciones */
	activePresetId: string
	/** Colores personalizados que sobrescriben el preset (light mode) */
	customColorsLight: Partial<ThemeColors>
	/** Colores personalizados que sobrescriben el preset (dark mode) */
	customColorsDark: Partial<ThemeColors>
	/** Radio de bordes personalizado */
	customRadius?: string
}

/** Theme export format */
export interface ThemeExport {
	version: 1
	name: string
	exportedAt: string
	preset: ThemePreset
}

/** Mapa de nombres de variables CSS a propiedades de ThemeColors */
export const CSS_VAR_MAP: Record<keyof ThemeColors, string> = {
	background: '--background',
	foreground: '--foreground',
	card: '--card',
	cardForeground: '--card-foreground',
	popover: '--popover',
	popoverForeground: '--popover-foreground',
	primary: '--primary',
	primaryForeground: '--primary-foreground',
	secondary: '--secondary',
	secondaryForeground: '--secondary-foreground',
	muted: '--muted',
	mutedForeground: '--muted-foreground',
	accent: '--accent',
	accentForeground: '--accent-foreground',
	destructive: '--destructive',
	destructiveForeground: '--destructive-foreground',
	border: '--border',
	input: '--input',
	ring: '--ring',
	sidebar: '--sidebar',
	sidebarForeground: '--sidebar-foreground',
	sidebarPrimary: '--sidebar-primary',
	sidebarPrimaryForeground: '--sidebar-primary-foreground',
	sidebarAccent: '--sidebar-accent',
	sidebarAccentForeground: '--sidebar-accent-foreground',
	sidebarBorder: '--sidebar-border',
	sidebarRing: '--sidebar-ring',
	chart1: '--chart-1',
	chart2: '--chart-2',
	chart3: '--chart-3',
	chart4: '--chart-4',
	chart5: '--chart-5',
	tableHeader: '--table-header',
	tableHeaderForeground: '--table-header-foreground',
	tableRow: '--table-row',
	tableRowAlt: '--table-row-alt',
	tableRowForeground: '--table-row-foreground',
	tableBorder: '--table-border',
}

/** Grupos de colores para el editor */
export const COLOR_GROUPS = {
	core: {
		label: 'Colores Base',
		keys: [
			'background',
			'foreground',
			'primary',
			'primaryForeground',
			'secondary',
			'secondaryForeground',
		] as (keyof ThemeColors)[],
	},
	surfaces: {
		label: 'Superficies',
		keys: [
			'card',
			'cardForeground',
			'popover',
			'popoverForeground',
			'muted',
			'mutedForeground',
		] as (keyof ThemeColors)[],
	},
	interactive: {
		label: 'Interactivos',
		keys: ['accent', 'accentForeground', 'destructive', 'destructiveForeground'] as (keyof ThemeColors)[],
	},
	borders: {
		label: 'Bordes',
		keys: ['border', 'input', 'ring'] as (keyof ThemeColors)[],
	},
	sidebar: {
		label: 'Sidebar',
		keys: [
			'sidebar',
			'sidebarForeground',
			'sidebarPrimary',
			'sidebarPrimaryForeground',
			'sidebarAccent',
			'sidebarAccentForeground',
			'sidebarBorder',
			'sidebarRing',
		] as (keyof ThemeColors)[],
	},
	charts: {
		label: 'Gráficos',
		keys: ['chart1', 'chart2', 'chart3', 'chart4', 'chart5'] as (keyof ThemeColors)[],
	},
	tables: {
		label: 'Tablas',
		keys: [
			'tableHeader',
			'tableHeaderForeground',
			'tableRow',
			'tableRowAlt',
			'tableRowForeground',
			'tableBorder',
		] as (keyof ThemeColors)[],
	},
} as const

/** Labels legibles para cada variable de color */
export const COLOR_LABELS: Record<keyof ThemeColors, string> = {
	background: 'Fondo',
	foreground: 'Texto principal',
	card: 'Tarjeta',
	cardForeground: 'Texto tarjeta',
	popover: 'Popover',
	popoverForeground: 'Texto popover',
	primary: 'Primario',
	primaryForeground: 'Texto primario',
	secondary: 'Secundario',
	secondaryForeground: 'Texto secundario',
	muted: 'Atenuado',
	mutedForeground: 'Texto atenuado',
	accent: 'Acento',
	accentForeground: 'Texto acento',
	destructive: 'Destructivo',
	destructiveForeground: 'Texto destructivo',
	border: 'Borde',
	input: 'Input',
	ring: 'Anillo focus',
	sidebar: 'Sidebar fondo',
	sidebarForeground: 'Sidebar texto',
	sidebarPrimary: 'Sidebar primario',
	sidebarPrimaryForeground: 'Sidebar texto prim.',
	sidebarAccent: 'Sidebar acento',
	sidebarAccentForeground: 'Sidebar texto acento',
	sidebarBorder: 'Sidebar borde',
	sidebarRing: 'Sidebar anillo',
	chart1: 'Gráfico 1',
	chart2: 'Gráfico 2',
	chart3: 'Gráfico 3',
	chart4: 'Gráfico 4',
	chart5: 'Gráfico 5',
	tableHeader: 'Cabecera Tabla',
	tableHeaderForeground: 'Texto Cabecera',
	tableRow: 'Fila Tabla',
	tableRowAlt: 'Hover Fila',
	tableRowForeground: 'Texto Fila',
	tableBorder: 'Borde Tabla',
}
