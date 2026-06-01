import type { ContentRule, ContentRuleMatchInput, ContentRuleMatchResult } from './types'

function normalize(value: string | null | undefined): string {
	return (value ?? '').trim().toLowerCase()
}

function normalizeTitleSearchText(value: string | null | undefined): string {
	return normalize(value)
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
}

function matchesTitle(rule: ContentRule, input: ContentRuleMatchInput): boolean {
	const needle = normalizeTitleSearchText(rule.matchTitle)
	if (!needle) return true
	return normalizeTitleSearchText(input.title).includes(needle)
}

function matchesAuthor(rule: ContentRule, input: ContentRuleMatchInput): boolean {
	const author = normalize(rule.matchAuthor)
	if (!author) return true
	return normalize(input.author) === author
}

function matchesSubforum(rule: ContentRule, input: ContentRuleMatchInput): boolean {
	if (rule.subforumIds.length === 0) return true
	const subforumId = normalize(input.subforumId)
	return rule.subforumIds.some(id => normalize(id) === subforumId)
}

export function ruleMatches(rule: ContentRule, input: ContentRuleMatchInput): boolean {
	if (!rule.enabled) return false
	return matchesTitle(rule, input) && matchesAuthor(rule, input) && matchesSubforum(rule, input)
}

export function matchContentRules(rules: ContentRule[], input: ContentRuleMatchInput): ContentRuleMatchResult {
	const matchedRules = rules.filter(rule => ruleMatches(rule, input))
	const action = matchedRules.some(rule => rule.action === 'hide')
		? 'hide'
		: matchedRules.some(rule => rule.action === 'highlight')
			? 'highlight'
			: null

	return { action, matchedRules }
}

export function hasRuleCriteria(rule: Pick<ContentRule, 'matchTitle' | 'matchAuthor' | 'subforumIds'>): boolean {
	return Boolean(rule.matchTitle.trim() || rule.matchAuthor.trim() || rule.subforumIds.length > 0)
}
