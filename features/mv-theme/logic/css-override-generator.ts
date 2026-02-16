/**
 * CSS Override Generator
 *
 * Generates CSS override rules from user color choices + the build-time
 * color rules map, including a baseline layer so custom themes remain
 * consistent even if the user has selected a non-dark MV style.
 */
import { hexToOklch, parseHex, wcagContrast } from '@/features/theme-editor/lib/color-utils-lite'
import { MV_THEME_COLOR_RULES } from '../generated/color-map'
import { getGroupHexes, MV_COLOR_GROUPS, type MvColorGroup } from './color-groups'
import { shiftColor } from './color-shift'

const HEX_RE = /#[0-9a-f]{3,8}\b/gi
const IMPORTANT_TAIL_RE = /\s*!important\s*$/i
const PROTECTED_SELECTOR_PATTERNS = [
	/\.thread-live\b/,
	/^\.blocker$/,
]
const HOVER_SELECTOR_RE = /:hover\b|\.hover\b/
const HOVER_GROUP_ID = 'hover-bg'
const UNREAD_OLD_GROUP_ID = 'unread-old'
const UNREAD_NEW_GROUP_ID = 'unread-new'
const SURFACE_GROUP_ID = 'surface-bg'
const MANUAL_ONLY_GROUP_IDS = new Set([HOVER_GROUP_ID, UNREAD_OLD_GROUP_ID, UNREAD_NEW_GROUP_ID])

const TOPBAR_LINK_SELECTOR = '#sections > li > a, #usermenu > li > a, #usermenu > li.avw > a.av'
const TOPBAR_HOVER_SELECTOR = '#foros_spy #tab_for:hover, #sections > li > a:hover, #usermenu > li > a:hover'
const TOPBAR_INACTIVE_SELECTOR = '#foros_spy #tab_for, #top #tab_for'
const TOPBAR_ACTIVE_SELECTOR = [
	'#foros_spy #tab_spy',
	'#foros_spy #tab_spy:hover',
	'#top #tab_top',
	'#top #tab_top:hover',
	'.actualidad #tab_act',
	'.actualidad #tab_act:hover',
	'.clanes #tab_cln',
	'.clanes #tab_cln:hover',
	'.foros #tab_for',
	'.foros #tab_for:hover',
	'.grupos #tab_grp',
	'.grupos #tab_grp:hover',
	'.psn #tab_psn',
	'.psn #tab_psn:hover',
	'.streams #tab_str',
	'.streams #tab_str:hover',
	'.usuarios #tab_usr',
	'.usuarios #tab_usr:hover',
].join(', ')
const TOPBAR_BG_BLOCK_SELECTOR = [
	'#header',
	'#topbar',
	'#topbar .nav-wrapper',
	'#topbar #logo',
	'#topbar #sections',
	'#topbar #sections > li',
	'#topbar #usermenu',
	'#topbar #usermenu > li',
	'#topbar #usermenu > li.avw',
].join(', ')
const TOPBAR_BORDER_RESET_SELECTOR = [
	'#topbar #logo',
	'#topbar #sections',
	'#topbar #sections > li',
	'#topbar #sections > li > a',
	'#topbar #usermenu',
	'#topbar #usermenu > li',
	'#topbar #usermenu > li > a',
	'#topbar #usermenu > li.avw',
	'#topbar #usermenu > li.avw > a.av',
].join(', ')

const THREAD_LIVE_LOCK_RULES = [
	'.thread-live{color:#bb4949 !important;border:1px solid #bb4949 !important}',
	'.thread-live:hover{background-color:#bb4949 !important;border-color:#bb4949 !important;color:#39464c !important}',
]

const HERO_MENU_BG_DEFAULT = '#42484c'
const HERO_MENU_BORDER_DEFAULT = '#131516'

const MODERATED_INFO_BG_DEFAULT = '#272a2b'
const MODERATED_INFO_BORDER_DEFAULT = '#21262b'
const MODERATED_INFO_SELECTOR = '.post.info'
const PRIMARY_BUTTON_SELECTOR = [
	'.btn-primary',
	'.btn-primary:hover',
	'.btn-primary:focus',
	'.btn-primary:active',
	'.btn-primary.active',
	'.open > .btn-primary.dropdown-toggle',
	'.btn-accent',
	'.btn-accent:hover',
	'.btn-accent:focus',
	'.btn-accent:active',
	'.btn-accent.active',
	'.open > .btn-accent.dropdown-toggle',
	'.btn-admin',
	'.btn-admin:hover',
	'.btn-admin:focus',
	'.btn-admin:active',
	'.btn-admin.active',
	'.open > .btn-admin.dropdown-toggle',
].join(', ')
const PRIMARY_BUTTON_BADGE_SELECTOR = '.btn-primary .badge,.btn-accent .badge,.btn-admin .badge'
const NEUTRAL_BUTTON_SELECTOR = [
	'.btn-default',
	'.btn-default:hover',
	'.btn-default:focus',
	'.btn-default:active',
	'.btn-default.active',
	'.open > .btn-default.dropdown-toggle',
	'.btn-ghost',
	'.btn-ghost:hover',
	'.btn-ghost:focus',
	'.btn-ghost:active',
	'.btn-ghost.active',
	'.open > .btn-ghost.dropdown-toggle',
	'.btn.btn-inverse',
	'.btn.btn-inverse:hover',
	'.btn.btn-inverse:focus',
	'.btn.btn-inverse:active',
].join(', ')
const HERO_PRIMARY_BUTTON_SELECTOR = [
	'.hero-controls .btn-primary',
	'.hero-controls .btn-primary i',
	'.hero-controls .btn-primary svg',
	'.hero-controls .btn-accent',
	'.hero-controls .btn-accent i',
	'.hero-controls .btn-accent svg',
	'.hero-controls .btn-admin',
	'.hero-controls .btn-admin i',
	'.hero-controls .btn-admin svg',
].join(', ')
const HERO_NEUTRAL_BUTTON_SELECTOR = [
	'.hero-controls .btn.btn-inverse',
	'.hero-controls .btn.btn-inverse i',
	'.hero-controls .btn.btn-inverse svg',
	'.hero-controls .btn-default',
	'.hero-controls .btn-default i',
	'.hero-controls .btn-default svg',
	'.hero-controls .btn-ghost',
	'.hero-controls .btn-ghost i',
	'.hero-controls .btn-ghost svg',
].join(', ')
const EDITOR_BUTTON_SELECTOR = [
	'#post-editor .editor-controls button',
	'#post-editor .editor-controls button i',
	'#post-editor .editor-controls button svg',
	'#standalone-editor .editor-controls button',
	'#standalone-editor .editor-controls button i',
	'#standalone-editor .editor-controls button svg',
	'.editor-controls > .btn',
	'.editor-controls > .btn i',
	'.editor-controls > .btn svg',
	'.editor-controls .mvp-toolbar-btn',
	'.editor-controls .mvp-toolbar-btn i',
	'.editor-controls .mvp-toolbar-btn svg',
	'.editor-toolbar .mvp-toolbar-btn',
	'.editor-toolbar .mvp-toolbar-btn i',
	'.editor-toolbar .mvp-toolbar-btn svg',
	'.toolbar .mvp-toolbar-btn',
	'.toolbar .mvp-toolbar-btn i',
	'.toolbar .mvp-toolbar-btn svg',
	'#post-editor .controls a',
	'#post-editor .controls a i',
	'#m-main-controls .btn',
	'#m-main-controls .btn i',
	'#m-main-controls a',
	'#m-main-controls a i',
].join(', ')

const GROUP_BY_ID = new Map<string, MvColorGroup>(
	MV_COLOR_GROUPS.map(group => [group.id, group])
)

const ACCENT_GROUPS = MV_COLOR_GROUPS.filter(group => group.category === 'accents')

const EXPLICIT_HEX_GROUP_LOOKUP = new Map<string, string>()
for (const group of MV_COLOR_GROUPS) {
	for (const hex of getGroupHexes(group)) {
		EXPLICIT_HEX_GROUP_LOOKUP.set(normalizeHex(hex), group.id)
	}
}

const BASE_OKLCH_BY_GROUP = new Map(
	MV_COLOR_GROUPS.map(group => [group.id, hexToOklch(group.baseColor)])
)

const GROUP_MATCH_CACHE = new Map<string, MvColorGroup | null>()

/**
 * Generates a CSS override string from user color overrides.
 *
 * @param colorOverrides - Map of groupId → user's new base hex color.
 *                         Only groups with overrides generate CSS.
 * @returns CSS string with !important rules, or empty string if no overrides.
 */
export function generateMvThemeCSS(colorOverrides: Record<string, string>): string {
	const hasColorOverrides = Object.keys(colorOverrides).length > 0

	if (!hasColorOverrides) return ''

	const rules: string[] = []

	// ── Color overrides ──────────────────────────────────────────────
	if (hasColorOverrides) {
		const changedGroups = new Map<string, string>()

		for (const group of MV_COLOR_GROUPS) {
			const newBase = normalizeHex(colorOverrides[group.id] || '')
			if (!newBase || newBase === group.baseColor) continue
			changedGroups.set(group.id, newBase)
		}

		if (changedGroups.size > 0) {
			const hexReplacements = new Map<string, string>()

			for (const [groupId, newBase] of changedGroups) {
				if (MANUAL_ONLY_GROUP_IDS.has(groupId)) continue
				const group = GROUP_BY_ID.get(groupId)
				if (!group) continue
				hexReplacements.set(group.baseColor, newBase)
				for (const shade of group.shades) {
					const newShade = shiftColor(shade, group.baseColor, newBase)
					hexReplacements.set(shade, newShade)
				}
			}

			for (const entry of MV_THEME_COLOR_RULES) {
				for (const oldHex of entry.c) {
					if (hexReplacements.has(oldHex)) continue
					const matchedGroup = resolveGroupForHex(oldHex)
					if (!matchedGroup) { hexReplacements.set(oldHex, oldHex); continue }
					if (MANUAL_ONLY_GROUP_IDS.has(matchedGroup.id)) { hexReplacements.set(oldHex, oldHex); continue }
					const changedBase = changedGroups.get(matchedGroup.id)
					const replacement = changedBase ? shiftColor(oldHex, matchedGroup.baseColor, changedBase) : oldHex
					hexReplacements.set(oldHex, replacement)
				}
			}

			for (const entry of MV_THEME_COLOR_RULES) {
				const selectors = splitCombinedSelectors(entry.s).filter(selector => !isProtectedSelector(selector))
				if (selectors.length === 0) continue
				let hasMappedColor = false
				const newValue = entry.v.replace(HEX_RE, rawHex => {
					const normalized = normalizeHex(rawHex)
					const replacement = hexReplacements.get(normalized)
					if (!replacement) return rawHex
					hasMappedColor = true
					return replacement
				})
				if (hasMappedColor) {
					const hadImportant = IMPORTANT_TAIL_RE.test(newValue)
					const cleanValue = newValue.replace(IMPORTANT_TAIL_RE, '').trim()
					// Boost specificity for rules that compete with MV's own !important
					// declarations so ours win regardless of injection order.
					const finalSelectors = hadImportant
						? selectors.map(s => `:root ${s}`)
						: selectors
					rules.push(`${finalSelectors.join(',')}{${entry.p}:${cleanValue} !important}`)
				}
			}

			rules.push(...buildTopbarFallbackRules(changedGroups))
			rules.push(...buildBrandMenuFallbackRules(changedGroups))
			rules.push(...buildHeroMenuFallbackRules(changedGroups))
			rules.push(...buildPostControlsFallbackRules(changedGroups))
			rules.push(...buildThreadMetricsFallbackRules(changedGroups))
			rules.push(...buildPostitFallbackRules(changedGroups))
			rules.push(...buildHoverOnlyRules(changedGroups))
			rules.push(...buildUnreadBadgeRules(changedGroups))
			rules.push(...buildModeratedInfoRules(changedGroups))
			rules.push(...buildLightThemeReadabilityRules(changedGroups))
			rules.push(...THREAD_LIVE_LOCK_RULES)
		}
	}

	if (rules.length === 0) return ''

	return `/* MV Theme Override - ${rules.length} rules */\n${rules.join('\n')}`
}

function resolveGroupForHex(hex: string): MvColorGroup | null {
	const normalized = normalizeHex(hex)

	const explicitGroupId = EXPLICIT_HEX_GROUP_LOOKUP.get(normalized)
	if (explicitGroupId) {
		return GROUP_BY_ID.get(explicitGroupId) ?? null
	}

	const cached = GROUP_MATCH_CACHE.get(normalized)
	if (cached !== undefined) return cached

	const oklch = hexToOklch(normalized)
	if (!oklch) {
		GROUP_MATCH_CACHE.set(normalized, null)
		return null
	}

	const candidates = oklch.c >= 0.045 ? ACCENT_GROUPS : MV_COLOR_GROUPS

	let bestGroup: MvColorGroup | null = null
	let bestScore = Number.POSITIVE_INFINITY

	for (const group of candidates) {
		const base = BASE_OKLCH_BY_GROUP.get(group.id)
		if (!base) continue

		const dL = oklch.l - base.l
		const dC = oklch.c - base.c
		const dH = normalizedHueDistance(oklch.h, base.h)

		let score = dL * dL * 1.8 + dC * dC * 6.5 + dH * dH * 0.8

		// Keep neutral shades away from chromatic accent buckets unless they are close.
		if (oklch.c < 0.02 && group.category === 'accents') {
			score += 0.2
		}

		// Keep bright shades away from dark background buckets when text is closer.
		if (oklch.l > 0.7 && group.category === 'backgrounds') {
			score += 0.15
		}

		if (score < bestScore) {
			bestScore = score
			bestGroup = group
		}
	}

	GROUP_MATCH_CACHE.set(normalized, bestGroup)
	return bestGroup
}

function normalizeHex(hex: string): string {
	const clean = hex.toLowerCase()
	if (clean.length === 4 || clean.length === 5) {
		const chunks = clean.slice(1).split('')
		return `#${chunks.map(chunk => chunk + chunk).join('')}`
	}
	return clean
}

function normalizedHueDistance(a?: number, b?: number): number {
	if (a == null || b == null) return 0
	const raw = Math.abs(a - b)
	const shortest = raw > 180 ? 360 - raw : raw
	return shortest / 180
}

function isProtectedSelector(selector: string): boolean {
	return PROTECTED_SELECTOR_PATTERNS.some(pattern => pattern.test(selector))
}

function getEffectiveGroupColor(groupId: string, changedGroups: Map<string, string>): string {
	const group = GROUP_BY_ID.get(groupId)
	if (!group) return '#ffffff'
	return changedGroups.get(groupId) ?? group.baseColor
}

function hexToRgba(hex: string, alpha: number): string {
	const normalized = normalizeHex(hex)
	if (normalized.length !== 7) return normalized

	const r = Number.parseInt(normalized.slice(1, 3), 16)
	const g = Number.parseInt(normalized.slice(3, 5), 16)
	const b = Number.parseInt(normalized.slice(5, 7), 16)
	return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function buildTopbarFallbackRules(changedGroups: Map<string, string>): string[] {
	if (changedGroups.size === 0) return []

	const accent = getEffectiveGroupColor('accent', changedGroups)
	const pageBg = getEffectiveGroupColor('page-bg', changedGroups)
	const textPrimary = getEffectiveGroupColor('text-primary', changedGroups)
	const surfaceBg = getEffectiveGroupColor('surface-bg', changedGroups)
	const hoverBg = getEffectiveGroupColor('hover-bg', changedGroups)

	const inactive = hexToRgba(textPrimary, 0.65)
	const hover = hexToRgba(textPrimary, 0.95)
	const navBg = shiftColor('#323639', '#272d30', surfaceBg)
	const navDivider = isLightBackground(pageBg) ? 'rgba(0, 0, 0, 0.18)' : 'rgba(0, 0, 0, 0.34)'

	return [
		`${TOPBAR_BG_BLOCK_SELECTOR}{background:${navBg} !important}`,
		`#header{border-bottom-color:${navDivider} !important;box-shadow:none !important}`,
		`#topbar{height:42px !important}`,
		`${TOPBAR_BORDER_RESET_SELECTOR}{border-left-color:${navBg} !important;border-right-color:${navBg} !important}`,
		`${TOPBAR_LINK_SELECTOR}{background:transparent !important;color:${inactive} !important}`,
		`${TOPBAR_INACTIVE_SELECTOR}{border-bottom:none !important;background:transparent !important;color:${inactive} !important}`,
		`${TOPBAR_ACTIVE_SELECTOR}{background:transparent !important;color:${accent} !important}`,
		`${TOPBAR_HOVER_SELECTOR}{background:${hoverBg} !important;color:${hover} !important}`,
	]
}

function buildBrandMenuFallbackRules(changedGroups: Map<string, string>): string[] {
	if (changedGroups.size === 0) return []

	const pageBg = getEffectiveGroupColor('page-bg', changedGroups)
	const surfaceBg = getEffectiveGroupColor('surface-bg', changedGroups)
	const accent = getEffectiveGroupColor('accent', changedGroups)
	const textPrimary = getEffectiveGroupColor('text-primary', changedGroups)
	const isLight = isLightBackground(pageBg)

	const brandTop = shiftColor('#343b41', '#32383e', surfaceBg)
	const brandBottom = shiftColor('#32383e', '#32383e', surfaceBg)
	const borderTop = isLight ? 'rgba(0, 0, 0, 0.18)' : 'rgba(0, 0, 0, 0.34)'
	const borderBottom = isLight ? 'rgba(0, 0, 0, 0.24)' : 'rgba(0, 0, 0, 0.4)'
	const linkColor = hexToRgba(textPrimary, isLight ? 0.72 : 0.65)
	const hoverBg = hexToRgba(textPrimary, isLight ? 0.08 : 0.06)

	return [
		`#brand-menu{background:${brandBottom} !important;background:linear-gradient(to bottom, ${brandTop} 0, ${brandBottom} 100%) !important;border-top-color:${borderTop} !important;border-bottom-color:${borderBottom} !important}`,
		`#brand-menu li a{color:${linkColor} !important;border-color:${linkColor} !important}`,
		`#brand-menu li a:hover{background-color:${hoverBg} !important}`,
		`#brand-menu li.active a,#brand-menu li.active a span.m{color:${textPrimary} !important;border-color:${accent} !important}`,
	]
}

function buildHoverOnlyRules(changedGroups: Map<string, string>): string[] {
	const newHover = changedGroups.get(HOVER_GROUP_ID)
	if (!newHover) return []

	const hoverGroup = GROUP_BY_ID.get(HOVER_GROUP_ID)
	if (!hoverGroup) return []

	const explicitHoverHexes = new Set(getGroupHexes(hoverGroup).map(normalizeHex))
	const rules: string[] = []

	for (const entry of MV_THEME_COLOR_RULES) {
		const hoverSelectors = splitCombinedSelectors(entry.s).filter(
			selector => isHoverSelector(selector) && !isProtectedSelector(selector)
		)
		if (hoverSelectors.length === 0) continue

		let changed = false
		const newValue = entry.v.replace(HEX_RE, rawHex => {
			const oldHex = normalizeHex(rawHex)

			if (!explicitHoverHexes.has(oldHex)) return rawHex

			changed = true
			return shiftColor(oldHex, hoverGroup.baseColor, newHover)
		})

		if (changed) {
			rules.push(`${hoverSelectors.join(',')}{${entry.p}:${newValue} !important}`)
		}
	}

	return rules
}

function buildHeroMenuFallbackRules(changedGroups: Map<string, string>): string[] {
	if (changedGroups.size === 0) return []

	const elevatedBg = getEffectiveGroupColor('elevated-bg', changedGroups)
	const pageBg = getEffectiveGroupColor('page-bg', changedGroups)
	const accent = getEffectiveGroupColor('accent', changedGroups)
	const textPrimary = getEffectiveGroupColor('text-primary', changedGroups)
	const textMuted = getEffectiveGroupColor('text-muted', changedGroups)

	const heroBg = shiftColor(HERO_MENU_BG_DEFAULT, '#435056', elevatedBg)
	const heroBorder = shiftColor(HERO_MENU_BORDER_DEFAULT, '#1c2022', pageBg)

	return [
		`.hero-menu{background-color:${heroBg} !important;border-bottom-color:${heroBorder} !important}`,
		`.hero-menu li a,.hero-menu li span.m{color:${accent} !important}`,
		`.hero-menu li span.lbl{color:${textMuted} !important}`,
		`.hero-menu li.active a,.hero-menu li.active a span.m{color:${textPrimary} !important}`,
	]
}

function buildUnreadBadgeRules(changedGroups: Map<string, string>): string[] {
	if (changedGroups.size === 0) return []

	const oldBg = getEffectiveGroupColor(UNREAD_OLD_GROUP_ID, changedGroups)
	const newBg = getEffectiveGroupColor(UNREAD_NEW_GROUP_ID, changedGroups)
	const hoverBg = getEffectiveGroupColor('page-bg', changedGroups)

	const oldText = pickReadableTextColor(oldBg)
	const newText = pickReadableTextColor(newBg)

	return [
		`.unread-num{background-color:${oldBg} !important;color:${oldText} !important}`,
		`.unseen-num{background-color:${newBg} !important;color:${newText} !important}`,
		`#moarnum{background-color:${newBg} !important;color:${newText} !important}`,
		`.unseen-num:hover{background-color:${hoverBg} !important;color:${newBg} !important}`,
	]
}

function buildModeratedInfoRules(changedGroups: Map<string, string>): string[] {
	const newSurface = changedGroups.get(SURFACE_GROUP_ID)
	if (!newSurface) return []

	const bg = shiftColor(MODERATED_INFO_BG_DEFAULT, '#272d30', newSurface)
	const border = shiftColor(MODERATED_INFO_BORDER_DEFAULT, '#272d30', newSurface)

	return [
		`${MODERATED_INFO_SELECTOR}{background-color:${bg} !important;border-color:${border} !important}`,
	]
}

function buildPostControlsFallbackRules(changedGroups: Map<string, string>): string[] {
	if (changedGroups.size === 0) return []

	const accent = getEffectiveGroupColor('accent', changedGroups)
	const pageBg = getEffectiveGroupColor('page-bg', changedGroups)
	const textPrimary = getEffectiveGroupColor('text-primary', changedGroups)
	const textSecondary = getEffectiveGroupColor('text-secondary', changedGroups)
	const textMuted = getEffectiveGroupColor('text-muted', changedGroups)
	const hoverBg = getEffectiveGroupColor('hover-bg', changedGroups)
	const isLight = isLightBackground(pageBg)
	const inactiveColor = isLight ? textMuted : textSecondary
	const actionColor = accent
	const actionText = pickReadableTextColor(actionColor)

	return [
		`.post-controls .post-btn,.post-controls .post-n,.post-controls .buttons .post-btn{color:${inactiveColor} !important}`,
		`.post-controls .post-btn:hover,.post-controls .post-n:hover,.post-controls .buttons .post-btn:hover{background-color:${hoverBg} !important;color:${textPrimary} !important}`,
		`.post-controls .buttons .post-btn.active,.post-controls .buttons .post-btn.bookmark.active,.post-controls .buttons .post-btn.masmola.active,.post-controls .post-btn.checked,.post-controls .post-n.checked{color:${actionColor} !important}`,
		`.post-controls .post-btn.btnmola i,.post-controls .post-n.btnmola i{background-color:${actionColor} !important;color:${actionText} !important}`,
	]
}

function buildPostitFallbackRules(changedGroups: Map<string, string>): string[] {
	if (changedGroups.size === 0) return []

	const pageBg = getEffectiveGroupColor('page-bg', changedGroups)
	const surfaceBg = getEffectiveGroupColor('surface-bg', changedGroups)
	const border3d = getEffectiveGroupColor('border-3d', changedGroups)
	const textPrimary = getEffectiveGroupColor('text-primary', changedGroups)
	const textMuted = getEffectiveGroupColor('text-muted', changedGroups)
	const accent = getEffectiveGroupColor('accent', changedGroups)

	const postitBg = shiftColor('#435056', '#39464c', surfaceBg)
	const postitBorder = shiftColor('#30353a', '#262b31', border3d)
	const toggleBg = isLightBackground(pageBg) ? hexToRgba(border3d, 0.18) : hexToRgba(pageBg, 0.62)

	return [
		`#postit{background-color:${postitBg} !important;border-color:${postitBorder} !important}`,
		`#postit .post-contents,#postit .post-contents p,#postit .post-contents em,#postit .post-contents li{color:${textPrimary} !important}`,
		`h3#postit,#postit .post-contents h1,#postit .post-contents h2,#postit .post-contents h3,#postit .post-contents h4,#postit .post-contents h5{color:${textPrimary} !important}`,
		`#postit .toggle{color:${textMuted} !important;background-color:${toggleBg} !important}`,
		`#postit a:not(.spoiler){color:${accent} !important}`,
	]
}

function buildThreadMetricsFallbackRules(changedGroups: Map<string, string>): string[] {
	if (changedGroups.size === 0) return []

	const textPrimary = getEffectiveGroupColor('text-primary', changedGroups)
	const textSecondary = getEffectiveGroupColor('text-secondary', changedGroups)
	const textMuted = getEffectiveGroupColor('text-muted', changedGroups)
	const hotBase = getEffectiveGroupColor(UNREAD_NEW_GROUP_ID, changedGroups)

	const coolHigh = textSecondary
	const coolMid = shiftColor('#b4bbbf', '#c2c7cb', coolHigh)
	const coolLow = shiftColor('#a0a8ae', '#c2c7cb', coolHigh)

	const hotHigh = hotBase
	const hotMid = shiftColor('#bd7834', '#d55f17', hotHigh)
	const hotLow = shiftColor('#a29180', '#d55f17', hotHigh)

	return [
		`body .num,body .age,body .m_date,body .thread-count .num{color:${textMuted} !important}`,
		`body .thread-count .num.reply{color:${textSecondary} !important}`,
		`body .cmap-h{color:${coolHigh} !important}`,
		`body .cmap-m{color:${coolMid} !important}`,
		`body .cmap-l{color:${coolLow} !important}`,
		`body .hmap-h{color:${hotHigh} !important}`,
		`body .hmap-m{color:${hotMid} !important}`,
		`body .hmap-l{color:${hotLow} !important}`,
		`body .unread .last-av .m_date{color:${textPrimary} !important}`,
	]
}

function buildLightThemeReadabilityRules(changedGroups: Map<string, string>): string[] {
	if (changedGroups.size === 0) return []

	const pageBg = getEffectiveGroupColor('page-bg', changedGroups)
	if (!isLightBackground(pageBg)) return []

	const accent = getEffectiveGroupColor('accent', changedGroups)
	const buttonBg = getEffectiveGroupColor('button-bg', changedGroups)
	const unreadNew = getEffectiveGroupColor(UNREAD_NEW_GROUP_ID, changedGroups)

	const accentText = pickReadableTextColor(accent)
	const neutralText = pickReadableTextColor(buttonBg)
	const editorText = pickReadableTextColor(pageBg)
	const bubbleText = pickReadableTextColor(unreadNew)

	return [
		`#header .bubble,#usermenu .bubble{background-color:${unreadNew} !important;color:${bubbleText} !important}`,
		`${PRIMARY_BUTTON_SELECTOR}{color:${accentText} !important}`,
		`${PRIMARY_BUTTON_SELECTOR} i{color:${accentText} !important}`,
		`${PRIMARY_BUTTON_BADGE_SELECTOR}{background-color:${accentText} !important;color:${accent} !important}`,
		`${NEUTRAL_BUTTON_SELECTOR}{background-color:${buttonBg} !important;color:${neutralText} !important}`,
		`${NEUTRAL_BUTTON_SELECTOR} i{color:${neutralText} !important}`,
		`${HERO_PRIMARY_BUTTON_SELECTOR}{color:${accentText} !important}`,
		`${HERO_NEUTRAL_BUTTON_SELECTOR}{color:${neutralText} !important}`,
		`${EDITOR_BUTTON_SELECTOR}{color:${editorText} !important}`,
	]
}

function isHoverSelector(selector: string): boolean {
	return HOVER_SELECTOR_RE.test(selector)
}

function pickReadableTextColor(bgHex: string, minContrast = 4.5): string {
	const dark = '#333333'
	const light = '#f9fcff'
	const darkContrast = wcagContrast(dark, bgHex)
	const lightContrast = wcagContrast(light, bgHex)

	if (darkContrast >= minContrast && darkContrast >= lightContrast) return dark
	if (lightContrast >= minContrast) return light

	return darkContrast >= lightContrast ? dark : light
}

function isLightBackground(bgHex: string): boolean {
	const rgb = parseHex(bgHex)
	if (!rgb) return false

	const luminance = 0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b
	return luminance > 0.72
}

function splitCombinedSelectors(selectorGroup: string): string[] {
	const selectors: string[] = []
	let current = ''
	let parenDepth = 0
	let bracketDepth = 0
	let quote: '"' | "'" | null = null

	for (let i = 0; i < selectorGroup.length; i++) {
		const ch = selectorGroup[i]

		if (quote) {
			current += ch
			if (ch === '\\' && i + 1 < selectorGroup.length) {
				i++
				current += selectorGroup[i]
				continue
			}
			if (ch === quote) quote = null
			continue
		}

		if (ch === '"' || ch === "'") {
			quote = ch
			current += ch
			continue
		}

		if (ch === '(') {
			parenDepth++
			current += ch
			continue
		}
		if (ch === ')') {
			parenDepth = Math.max(0, parenDepth - 1)
			current += ch
			continue
		}

		if (ch === '[') {
			bracketDepth++
			current += ch
			continue
		}
		if (ch === ']') {
			bracketDepth = Math.max(0, bracketDepth - 1)
			current += ch
			continue
		}

		if (ch === ',' && parenDepth === 0 && bracketDepth === 0) {
			const trimmed = current.trim()
			if (trimmed) selectors.push(trimmed)
			current = ''
			continue
		}

		current += ch
	}

	const tail = current.trim()
	if (tail) selectors.push(tail)

	return selectors
}
