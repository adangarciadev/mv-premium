/**
 * Shadow DOM Styles Export
 *
 * Centralizes the shadow.css import to ensure only ONE copy
 * of the CSS string exists in the bundle.
 *
 * This prevents the bundler from duplicating the large CSS string
 * when it's imported in multiple places (shadow-wrapper, dialog, etc.)
 */
import css from './shadow.css?inline'

export const SHADOW_CSS = css
