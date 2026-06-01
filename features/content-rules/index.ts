export type {
	ContentRule,
	ContentRuleAction,
	ContentRuleCreateInput,
	ContentRuleMatchInput,
	ContentRuleMatchResult,
	ContentRuleUpdateInput,
} from './types'
export { hasRuleCriteria, matchContentRules, ruleMatches } from './matcher'
export {
	applyContentRuleRowState,
	CONTENT_RULE_HIDDEN_CLASS,
	CONTENT_RULE_HIGHLIGHT_CLASS,
	CONTENT_RULE_HIGHLIGHT_TINT_PERCENT,
	CONTENT_RULE_HIGHLIGHT_VAR,
} from './dom'
export {
	clearContentRules,
	contentRulesStorage,
	createContentRule,
	deleteContentRule,
	deleteContentRules,
	duplicateContentRule,
	getContentRules,
	saveContentRules,
	updateContentRule,
	watchContentRules,
} from './storage'
