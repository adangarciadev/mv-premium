/**
 * App-like token system: one neutral surface ramp + a single amber accent (#f0a020).
 * Flat grouped lists (no per-row gradients), bottom tab bar, 44px controls and a
 * 12/16/24 radius scale. Literal hex is used throughout so Tailwind's JIT reliably
 * generates each class. These constants are the single source of truth.
 *
 *   sheet #1c1f27 · group #242a36 · input #14171d · divider #2d3442 · pressed #2e3543
 *   text #eef1f6 · muted #9aa5b4 · faint #8b95a3 · accent #f0a020 · on-accent #221604
 */

// Bottom tab bar items: the active state fills the whole button as one pill (icon + label).
export const TAB_BASE_CLASS =
	'flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-2xl text-[10px] font-bold uppercase tracking-[0.08em] transition-colors'
export const TAB_ACTIVE_CLASS =
	'bg-gradient-to-b from-[#f0a020]/[0.22] to-[#f0a020]/[0.07] text-[#f0a020] ring-1 ring-inset ring-[#f0a020]/[0.25] shadow-[inset_0_1px_0_rgba(255,255,255,0.12),inset_0_-1px_0_rgba(0,0,0,0.3),0_3px_10px_rgba(0,0,0,0.45)]'
export const TAB_IDLE_CLASS = 'text-[#8b95a3] active:bg-[#1d212b] active:text-[#c2cad6]'
// Filter chips: same beveled-pill language as the bottom tab bar.
export const FILTER_BASE_CLASS =
	'inline-flex h-9 min-w-0 items-center justify-center gap-1 rounded-full px-2.5 text-xs font-semibold transition-colors'
export const FILTER_ACTIVE_CLASS =
	'bg-gradient-to-b from-[#f0a020]/[0.22] to-[#f0a020]/[0.07] text-[#f0a020] ring-1 ring-inset ring-[#f0a020]/[0.25] shadow-[inset_0_1px_0_rgba(255,255,255,0.12),inset_0_-1px_0_rgba(0,0,0,0.3),0_2px_6px_rgba(0,0,0,0.35)]'
export const FILTER_IDLE_CLASS = 'bg-[#242a36] text-[#9aa5b4] ring-1 ring-inset ring-white/[0.04] active:bg-[#2e3543]'
// Buttons: a single amber primary + one neutral secondary, both 44px.
export const PRIMARY_BUTTON_CLASS =
	'inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#f0a020] px-4 text-sm font-bold text-[#221604] transition-colors active:bg-[#d98e12] disabled:bg-[#2e3543] disabled:text-[#707b8e]'
export const SECONDARY_BUTTON_CLASS =
	'inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#2e3543] px-4 text-sm font-semibold text-[#eef1f6] transition-colors active:bg-[#3a4254] disabled:opacity-50'
// Row icon actions: ghost circles, accent tint only when active.
export const ROW_ICON_BASE_CLASS =
	'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-50'
export const ROW_ICON_IDLE_CLASS = 'text-[#8b95a3] active:bg-[#2e3543]'
export const ROW_ICON_ACTIVE_CLASS = 'bg-[#f0a020]/[0.16] text-[#f0a020]'
// Grouped list surfaces (iOS inset-list style) and section labels.
export const GROUP_CLASS = 'overflow-hidden rounded-2xl bg-[#242a36]'
export const SECTION_LABEL_CLASS = 'px-4 pb-2 pt-5 text-[11px] font-bold uppercase tracking-[0.14em] text-[#8b95a3]'
// Inputs: 16px text always (prevents iOS auto-zoom), flat surface, accent focus ring.
export const INPUT_CLASS =
	'h-11 w-full rounded-xl border border-transparent bg-[#14171d] text-base text-[#eef1f6] outline-none placeholder:text-[#707b8e] focus:border-[#f0a020]'
// Switch: 28x48 visual track inside a 44px touch target.
export const SWITCH_WRAPPER_CLASS = 'inline-flex h-11 w-14 shrink-0 items-center justify-center disabled:opacity-60'
export const SWITCH_TRACK_BASE_CLASS = 'relative block h-7 w-12 rounded-full transition-colors'
export const SWITCH_THUMB_BASE_CLASS =
	'pointer-events-none absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow transition-transform'
// Toasts: single feedback channel anchored above the tab bar. Saturated
// surfaces + status icon so the outcome reads at a glance.
export const STATUS_SUCCESS_CLASS =
	'pointer-events-auto flex w-full items-center gap-2.5 rounded-xl border border-[#2e8a52] bg-[#0e3320]/95 px-4 py-3 text-sm font-semibold text-[#d3f9e0] shadow-[0_8px_24px_rgba(0,0,0,0.45)] backdrop-blur animate-in fade-in-0 slide-in-from-bottom-2 duration-200'
export const STATUS_ERROR_CLASS =
	'pointer-events-auto flex w-full items-center gap-2.5 rounded-xl border border-[#a84b53] bg-[#3c181c]/95 px-4 py-3 text-sm font-semibold text-[#ffd9d9] shadow-[0_8px_24px_rgba(0,0,0,0.45)] backdrop-blur animate-in fade-in-0 slide-in-from-bottom-2 duration-200'
