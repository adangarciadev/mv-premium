/**
 * Settings View - Vertical Tabs Layout
 * Sidebar navigation with content panel
 */
import { useEffect } from 'react'
import { browser } from 'wxt/browser'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { useSettingsStore } from '@/store/settings-store'

// Local imports
import { SETTINGS_CATEGORIES, type CategoryId, isValidCategory, getTabFromUrl, updateUrlParam } from './constants'
import { IntegrationsContent } from './integrations-content'
import { FeaturesContent } from './features-content'
import { ContentTabContent } from './content-tab-content'
import { AdvancedContent } from './advanced-content'

// External imports for tabs that are not split
import { SettingsNavigation } from '../../components/settings'
import { ShortcutsContent } from '../shortcuts-view'

export function SettingsView() {
	const { settingsActiveTab, setSettingsActiveTab } = useSettingsStore()

	// Determine active tab: URL param takes priority, then store value
	const urlTab = getTabFromUrl()
	const activeTab = (urlTab ?? (isValidCategory(settingsActiveTab) ? settingsActiveTab : 'integrations')) as CategoryId

	// Sync URL on mount if store has a value but URL doesn't
	useEffect(() => {
		if (!urlTab && isValidCategory(settingsActiveTab)) {
			updateUrlParam(settingsActiveTab as CategoryId)
		}
	}, [])

	// Handle tab change
	const handleTabChange = (tabId: CategoryId) => {
		setSettingsActiveTab(tabId)
		updateUrlParam(tabId)
	}

	return (
		<div className="space-y-6 pb-20">
			{/* Header */}
			<div>
				<h1 className="text-3xl font-bold tracking-tight">Ajustes</h1>
				<p className="text-muted-foreground mt-1">Configura todas las opciones de la extensión MVP.</p>
			</div>

			{/* Main Layout: Sidebar + Content */}
			<div className="flex gap-8">
				{/* Sidebar Navigation */}
				<nav className="w-56 shrink-0">
					<div className="sticky top-4 space-y-1">
						{SETTINGS_CATEGORIES.map(category => (
							<Button
								key={category.id}
								variant={activeTab === category.id ? 'secondary' : 'ghost'}
								className={cn(
									'w-full justify-start gap-2 font-normal',
									activeTab === category.id
										? 'rounded-l-none border-l-4 !border-l-primary font-medium bg-accent text-accent-foreground'
										: 'hover:bg-accent/50'
								)}
								onClick={() => handleTabChange(category.id)}
							>
								<category.icon className="h-4 w-4" />
								{category.label}
							</Button>
						))}
					</div>
				</nav>

				{/* Content Panel */}
				<main className="flex-1 min-w-0">
					<Card className="p-6">
						<div key={activeTab} className="animate-in fade-in duration-200">
							<SettingsContent activeTab={activeTab} />
						</div>
					</Card>
				</main>
			</div>

			{/* Footer */}
			<div className="flex items-center justify-center pt-4 border-t">
				<div className="text-sm text-muted-foreground">
					<Badge variant="secondary" className="mr-2">
						v{browser.runtime.getManifest().version}
					</Badge>
					MVP Extension
				</div>
			</div>
		</div>
	)
}

// Content Router
function SettingsContent({ activeTab }: { activeTab: CategoryId }) {
	switch (activeTab) {
		case 'integrations':
			return <IntegrationsContent />
		case 'features':
			return <FeaturesContent />
		case 'navigation':
			return <SettingsNavigation />
		case 'content':
			return <ContentTabContent />
		case 'shortcuts':
			return <ShortcutsContent />
		case 'advanced':
			return <AdvancedContent />
		default:
			return null
	}
}
