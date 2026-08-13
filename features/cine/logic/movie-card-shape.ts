/**
 * Geometry of a review card.
 *
 * A published card cannot be read back: its title, score and quote are drawn into the PNG as
 * pixels. What it does keep is its shape. At 1200×453 the ratio is 2.649, which almost no
 * ordinary forum image shares, so geometry is what tells a card apart from a meme.
 *
 * This is used only for importing already-published cards. Cards generated from now on carry
 * a known image identifier and are matched exactly, never by shape.
 */

export const CARD_WIDTH = 1200
export const CARD_HEIGHT = 453
export const CARD_RATIO = CARD_WIDTH / CARD_HEIGHT

/**
 * Relative, not absolute: 3% of the ratio, not 0.03 in ratio units.
 *
 * The resulting window is roughly 2.57–2.73. That excludes every common shape — 16:9, 21:9,
 * 2.35:1 and 2.39:1 cinemascope, social previews, banner headers — but it does include 2.66:1
 * film stills, which is an accepted false positive: the import dialog simply offers them and
 * the user leaves that row empty. Narrowing further would start rejecting genuine cards that
 * image hosts have resized, and a missed card is the more expensive failure.
 */
export const CARD_RATIO_TOLERANCE = 0.03

/** How long to wait for a candidate image before giving up on measuring it. */
const MEASURE_TIMEOUT_MS = 8000

export function isCardRatio(width: number, height: number): boolean {
	if (!(width > 0) || !(height > 0)) return false

	const ratio = width / height
	return Math.abs(ratio - CARD_RATIO) / CARD_RATIO <= CARD_RATIO_TOLERANCE
}

/**
 * Loads an image only to read its intrinsic size, and resolves null when it cannot be
 * measured. Measuring has to happen this way because the dashboard parses a fetched page with
 * DOMParser, where images never load and naturalWidth is always 0.
 */
export function measureImageRatio(url: string, timeoutMs: number = MEASURE_TIMEOUT_MS): Promise<number | null> {
	return new Promise(resolve => {
		if (!url) {
			resolve(null)
			return
		}

		const image = new Image()
		let settled = false

		const finish = (ratio: number | null) => {
			if (settled) return
			settled = true
			window.clearTimeout(timer)
			resolve(ratio)
		}

		const timer = window.setTimeout(() => finish(null), timeoutMs)

		image.onload = () => {
			finish(image.naturalWidth > 0 && image.naturalHeight > 0 ? image.naturalWidth / image.naturalHeight : null)
		}
		image.onerror = () => finish(null)

		image.src = url
	})
}
