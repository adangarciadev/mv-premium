export interface Draft {
	id: string
	title: string
	content: string
	/** Tipo de documento: borrador o plantilla */
	type: 'draft' | 'template'
	subforum?: string
	/** Category value from the subforum's tag select (e.g., "156" for "Debate") */
	category?: string
	/** Human-readable category label (e.g., "Debate", "Off-Topic") */
	categoryLabel?: string
	folderId?: string
	/** Trigger/shortcut for template expansion (e.g., "/saludo"). Only for templates. */
	trigger?: string
	createdAt: number
	updatedAt: number
}

export interface DraftFolder {
	id: string
	name: string
	icon: string
	color?: string
	/** Folder type: 'draft' or 'template' */
	type?: 'draft' | 'template'
	createdAt: number
}

export interface DraftsData {
	drafts: Draft[]
	folders: DraftFolder[]
}
