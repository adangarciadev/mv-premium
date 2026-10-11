import { describe, expect, it } from 'vitest'
import { FEATURE_CATALOG, filterFeatureCatalog, getFeatureAction } from './feature-catalog'
import { getSettingById } from '../views/settings-view/constants'

describe('discovery catalogue', () => {
	it('links configurable features to existing settings, including the highlighted row', () => {
		for (const feature of FEATURE_CATALOG) {
			if (!feature.settingId) continue
			const setting = getSettingById(feature.settingId)
			expect(setting, feature.id).not.toBeNull()
			if (!feature.action) {
				expect(getFeatureAction(feature)?.href).toBe(`/settings?tab=${setting!.category}&setting=${setting!.id}`)
			}
		}
	})

	it('includes tools with no settings toggle and does not invent a settings link for them', () => {
		const favorites = FEATURE_CATALOG.find(feature => feature.id === 'unread-favorites')!
		expect(filterFeatureCatalog('favoritos nuevos')).toContain(favorites)
		expect(getFeatureAction(favorites)).toBeUndefined()
	})

	it('finds features by familiar words, regardless of accents, case and word order', () => {
		expect(filterFeatureCatalog('  FUTBOL   champions ').map(feature => feature.id)).toContain('football')
		expect(filterFeatureCatalog('lite twitter').map(feature => feature.id)).toContain('tweets-lite')
		expect(filterFeatureCatalog('autosave').map(feature => feature.id)).toContain('drafts')
	})

	it('distinguishes Mobile Lite features from desktop features without treating a mobile game forum as mobile support', () => {
		const mobileIds = filterFeatureCatalog('', 'all', 'mobile').map(feature => feature.id)
		expect(mobileIds).toContain('tweets-lite')
		expect(mobileIds).toContain('post-gestures')
		expect(mobileIds).not.toContain('drafts')
		expect(mobileIds).not.toContain('game-releases')
		const desktopIds = filterFeatureCatalog('', 'all', 'desktop').map(feature => feature.id)
		expect(desktopIds).toContain('tweets-lite')
		expect(desktopIds).not.toContain('post-gestures')
	})

	it('combines search, category and platform and returns no results for an unknown term', () => {
		expect(filterFeatureCatalog('twitter', 'media', 'mobile').map(feature => feature.id)).toEqual(['tweets-lite'])
		expect(filterFeatureCatalog('twitter', 'writing', 'mobile')).toEqual([])
		expect(filterFeatureCatalog('zzzinexistente')).toEqual([])
	})
})
