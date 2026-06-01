export type ContentRuleAction = 'hide' | 'highlight'

export interface ContentRule {
	id: string
	name: string
	enabled: boolean
	action: ContentRuleAction
	matchTitle: string
	matchAuthor: string
	subforumIds: string[]
	highlightColor?: string
	createdAt: number
	updatedAt: number
}

export interface ContentRuleMatchInput {
	title: string
	author?: string | null
	subforumId?: string | null
}

export interface ContentRuleMatchResult {
	action: ContentRuleAction | null
	matchedRules: ContentRule[]
}

export type ContentRuleCreateInput = Omit<ContentRule, 'id' | 'createdAt' | 'updatedAt'>
export type ContentRuleUpdateInput = Partial<Omit<ContentRule, 'id' | 'createdAt'>>
