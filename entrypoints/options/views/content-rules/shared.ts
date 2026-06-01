import { ALL_SUBFORUMS } from '@/lib/subforums'
import type { ContentRule, ContentRuleAction } from '@/features/content-rules'

export interface RuleFormState {
	name: string
	action: ContentRuleAction
	matchTitle: string
	matchAuthor: string
	subforumIds: string[]
	highlightColor: string
}

export const DEFAULT_HIGHLIGHT_COLOR = '#f7be58'
export const QUICK_COLORS = ['#f7be58', '#6f8cff', '#62c15b', '#a855f7', '#ef6f6c', '#2b1e08']
export const RULE_TITLE_MAX_LENGTH = 100
export const RULE_AUTHOR_MIN_LENGTH = 3
export const RULE_AUTHOR_MAX_LENGTH = 12

export const EMPTY_FORM: RuleFormState = {
	name: '',
	action: 'highlight',
	matchTitle: '',
	matchAuthor: '',
	subforumIds: [],
	highlightColor: DEFAULT_HIGHLIGHT_COLOR,
}

export function getSubforumId(slug: string): string {
	return `/foro/${slug}`
}

export const ALL_SUBFORUM_IDS = ALL_SUBFORUMS.map(subforum => getSubforumId(subforum.slug))

export function getSubforumName(id: string): string {
	const slug = id.replace(/^\/foro\//, '')
	return ALL_SUBFORUMS.find(subforum => subforum.slug === slug)?.name ?? slug
}

export function getSubforumScopeLabel(subforumIds: string[]): string {
	if (subforumIds.length === 0) return 'Cualquier subforo'
	if (subforumIds.length === ALL_SUBFORUMS.length) return 'Todos los subforos'
	if (subforumIds.length === 1) return getSubforumName(subforumIds[0])
	return `${subforumIds.length} subforos`
}

export function buildRuleName(form: RuleFormState): string {
	if (form.name.trim()) return form.name.trim()
	if (form.matchTitle.trim()) return `Título: ${form.matchTitle.trim()}`
	if (form.matchAuthor.trim()) return `Autor: ${form.matchAuthor.trim()}`
	if (form.subforumIds.length > 0) return `Subforos: ${getSubforumScopeLabel(form.subforumIds)}`
	return 'Regla sin nombre'
}

export function hasRuleFormCriteria(form: RuleFormState): boolean {
	const title = form.matchTitle.trim()
	const author = form.matchAuthor.trim()
	const hasValidTitle = title.length > 0 && title.length <= RULE_TITLE_MAX_LENGTH
	const hasValidAuthor =
		author.length === 0 || (author.length >= RULE_AUTHOR_MIN_LENGTH && author.length <= RULE_AUTHOR_MAX_LENGTH)
	return Boolean((hasValidTitle || author) && hasValidAuthor && form.subforumIds.length > 0)
}

export function getRuleConditionLabel(rule: ContentRule): string {
	const parts: string[] = []
	if (rule.matchTitle) parts.push(`título contiene "${rule.matchTitle}"`)
	if (rule.matchAuthor) parts.push(`autor es ${rule.matchAuthor}`)
	if (parts.length === 0) return 'cualquier hilo'
	return parts.join(' y ')
}
