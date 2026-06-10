# Mobile Lite — Design System

Reference for every visual decision in the Mobile Lite panel ([components/mobile-lite-panel.tsx](components/mobile-lite-panel.tsx)). **Any new Mobile Lite UI must follow these tokens and recipes** so the experience keeps feeling like one native app instead of a collection of screens.

> The class-string constants documented here live at the top of `mobile-lite-panel.tsx` and are the single source of truth. If a new component outside that file needs them, extract them to a shared module instead of copy-pasting hex values.

---

## 1. Design philosophy

- **App, not dashboard**: bottom sheet + bottom tab bar + flat grouped lists. Never top-side segmented controls, never per-row "cards" with borders/gradients.
- **One accent**: amber `#f0a020` marks *the* selected/primary thing on screen. Everything else is a neutral surface ramp.
- **One "premium" treatment**: the beveled amber pill (see §5) is the only decorated state. Apply it to active selections (tab bar, filter chips) and nowhere else.
- **Feedback is transient**: a single toast channel above the tab bar. Status banners must never push layout.

## 2. Color tokens

Literal hex is used in classes so Tailwind JIT always generates them.

| Role | Hex | Usage |
| --- | --- | --- |
| Sheet background | `#1c1f27` | Panel body, sticky search backdrops |
| Group surface | `#242a36` | Grouped lists, dialogs, empty-state icon circle |
| Input / inset surface | `#14171d` | Inputs, tab bar, icon tiles, previews |
| Divider | `#2d3442` | `divide-y` inside groups, group inner borders |
| Pressed surface | `#2e3543` | `active:` state of neutral buttons, close button |
| Pressed surface (lighter) | `#3a4254` | `active:` over pressed surface; switch track off; handle |
| Tab bar border | `#2c3340` | `border-t` of bottom nav |
| Text | `#eef1f6` | Primary text |
| Text muted | `#9aa5b4` | Descriptions, secondary copy |
| Text faint | `#8b95a3` | Metadata, section labels, idle icons |
| Placeholder | `#707b8e` | Input placeholders, search icons, disabled-on-accent |
| **Accent** | `#f0a020` | Active states, primary buttons, badges |
| On-accent | `#221604` | Text/icons on amber fills |
| Accent pressed | `#d98e12` | `active:` of primary buttons |
| Destructive | `#e08a8a` on `#3a2427` (pressed) | Delete row actions only |
| Toast success | text `#d3f9e0`, icon `#41d97e`, bg `#0e3320`, border `#2e8a52` | Saturated so the outcome reads at a glance |
| Toast error | text `#ffd9d9`, icon `#ff8585`, bg `#3c181c`, border `#a84b53` | |
| Warning hint | `#d8b36a` | Inline validation text |

## 3. Shape & size scales

| Token | Value | Tailwind | Used for |
| --- | --- | --- | --- |
| Radius S | 12px | `rounded-xl` | Inputs, buttons, icon tiles |
| Radius M | 16px | `rounded-2xl` | Grouped lists, tab pills, add-user card |
| Radius L | 24px | `rounded-t-[24px]` / `rounded-3xl` | Sheet top edge, dialogs |
| Radius full | — | `rounded-full` | Chips, ghost icon actions, switches, badges |
| Control height | 44px | `h-11` | All inputs and text buttons (also iOS touch minimum) |
| Row icon action | 40px | `h-10 w-10` | Ghost circles inside ≥44px rows |
| Chip height | 36px | `h-9` | Filter chips, compact text actions |
| Switch | 28×48 visual | `h-7 w-12` track in `h-11 w-14` wrapper | Touch target stays 44px |
| Avatar / icon tile | 40px | `h-10 w-10` `rounded-lg` | MV-style squared avatars (never `rounded-full`) |

**Spacing**: 4/8 scale only. Page gutter `px-4`. Section gap via `SECTION_LABEL_CLASS` (`pt-5 pb-2`). List rows `py-2 pl-3 pr-2` (later padding tighter on the actions side).

**Typography**: body 16px (`text-base`) on every input — prevents mobile auto-zoom. Row titles `text-[15px] font-semibold`. Metadata `text-xs`/`text-[11px]`. Section labels `text-[11px] font-bold uppercase tracking-[0.14em]`. Wordmark: `MV` italic + `PREMIUM` upright amber, `font-black uppercase tracking-tighter`, with the `DASHBOARD` micro-label (`text-[9px] tracking-[0.25em]`) matching the desktop sidebar.

## 4. Component recipes (constants)

| Constant | Recipe |
| --- | --- |
| `GROUP_CLASS` | Flat grouped list: `overflow-hidden rounded-2xl bg-[#242a36]` + `divide-y divide-[#2d3442]`. Rows are plain flex rows — no per-row borders, gradients, or shadows. |
| `PRIMARY_BUTTON_CLASS` | Amber fill, dark text (`#221604`), `h-11 rounded-xl font-bold`. **The only filled-accent button.** Disabled: `bg-[#2e3543] text-[#707b8e]`. |
| `SECONDARY_BUTTON_CLASS` | Neutral fill `#2e3543`, `h-11 rounded-xl font-semibold`. |
| `ROW_ICON_*` | Ghost circle `h-10 w-10 rounded-full`; idle faint, active = amber tint `bg-[#f0a020]/[0.16] text-[#f0a020]`. |
| `INPUT_CLASS` | `h-11 rounded-xl bg-[#14171d]`, transparent border, `focus:border-[#f0a020]`, 16px text. |
| `SECTION_LABEL_CLASS` | Uppercase micro-label between groups. |
| `SWITCH_*` | 28×48 track in 44px wrapper; on = amber track, off = `#3a4254`. |
| `TAB_*` / `FILTER_*` | Beveled premium pill when active (§5); idle = faint text (+ `ring-white/[0.04]` on chips). |
| `STATUS_SUCCESS/ERROR_CLASS` | Toast pills (§6). |

## 5. The "premium pill" (active state recipe)

Used by the bottom tab bar and filter chips. This is the house style for *selected*:

```
bg-gradient-to-b from-[#f0a020]/[0.22] to-[#f0a020]/[0.07]   ← vertical amber gradient (light on top)
text-[#f0a020]
ring-1 ring-inset ring-[#f0a020]/[0.25]                       ← subtle amber outline
shadow-[inset_0_1px_0_rgba(255,255,255,0.12),                 ← top inner highlight
        inset_0_-1px_0_rgba(0,0,0,0.3),                       ← bottom inner shade
        0_2px_6px_rgba(0,0,0,0.35)]                           ← drop shadow (use 0_3px_10px/0.45 on the tab bar)
```

Do **not** invent new active treatments; reuse this.

## 6. Interaction patterns

- **Navigation**: fixed bottom tab bar (max 5 items, icon + uppercase 10px label), `role="tablist"`, badge anchored to the icon with `ring-2 ring-[#14171d]`. Tab bar gets `border-t` + upward shadow for elevation, and `pb-[max(10px,env(safe-area-inset-bottom))]`.
- **Feedback**: one toast container absolutely positioned `bottom-24` above the tab bar (`pointer-events-none` wrapper). Toasts render via `PanelToast` and lead with a status icon (`CircleCheck` / `CircleAlert`). Success = `role="status"`, auto-dismissed after **3.5s**; errors = `role="alert"`, persist until the next action. Toggles whose state is self-evident still confirm via toast, never via inline banners.
- **Clipboard**: never add "paste from clipboard" buttons. Android clipboard reads always trigger the browser's paste-authorization bubble and there is no API to know whether the clipboard has content; the native long-press paste on inputs is the expected gesture.
- **Sheet gesture**: header drag-to-dismiss. Threshold `max(140px, 25% of sheet height)`; below it, snap back; above it, animate fully down then unmount (220ms). Curve: `cubic-bezier(0.32, 0.72, 0, 1)` (iOS sheet feel). Drag tracking uses `transition: none`.
- **Press feedback**: every tappable element has an `active:` state (background shift or tint). No hover-dependent UI.
- **Empty states**: open and centered (`px-6 py-12`), icon inside a `h-12 w-12 rounded-full bg-[#242a36]` circle, bold one-liner + optional faint hint. Never boxed in a bordered card.
- **Sticky search**: search bars stick to `top-0` of the scroll body with the sheet background (`-mx-4 px-4`).
- **Destructive actions**: red ghost icon (`#e08a8a`), separated from other actions; bulk destructive actions require an `alertdialog` confirm sheet (Cancelar secondary / action primary).

## 7. Every-screen rules (phones → tablets)

- Sheet: `w-full max-w-[34rem]` centered, `h-[90%]` of `100dvh` (dynamic viewport handles Firefox Android chrome).
- Header and tab bar are `shrink-0`; only the body scrolls (`min-h-0 flex-1 overflow-y-auto overscroll-contain`).
- Safe areas: `env(safe-area-inset-top)` (header), `env(safe-area-inset-bottom)` (tab bar, dialogs).
- All inputs 16px; all touch targets ≥44px; long text uses `truncate` / `line-clamp-2`.
- Gesture thresholds proportional to actual sheet size, never hardcoded to a phone.

## 8. Accessibility & test-stability contract

`features/mobile-lite/logic/panel.test.tsx` asserts accessible names. When restyling, **never change**:

- Roles: `tab` (Usuarios / Hilos / Ajustes), `switch`, `alertdialog`, `status`, `alert`.
- `aria-label`s: `Cerrar`, `Silenciar`/`Silenciado`, `Ocultar`/`Ocultado`, `Quitar`, `Mostrar`, `Mostrar todos`, `Hilos`, `Color personalizado`, `Modo Live`, `Botón ocultar hilos`, `Editar color de negrita`, `Guardar color de negrita`, `Guardar API key de ImgBB`.
- Filter chip accessible names follow `<label> (<count>)`.
- Badges and decorative icons stay `aria-hidden="true"`.

## 9. New-feature checklist

- [ ] Surfaces use the §2 tokens — no new hex values without adding them here.
- [ ] Lists are flat groups (`GROUP_CLASS` + `divide-y`), not cards.
- [ ] Buttons reuse `PRIMARY_BUTTON_CLASS` / `SECONDARY_BUTTON_CLASS`; one primary per screen.
- [ ] Active/selected states use the §5 premium pill or the `ROW_ICON_ACTIVE_CLASS` tint.
- [ ] Feedback goes through the toast channel (no inline banners).
- [ ] Inputs 16px, controls ≥44px, `active:` feedback everywhere.
- [ ] Safe areas + `truncate`/`line-clamp` verified at 320px width and on tablet landscape.
- [ ] Roles/aria-labels preserved; new interactive elements get accessible names and tests.
