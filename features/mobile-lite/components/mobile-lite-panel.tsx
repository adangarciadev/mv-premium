import { useCallback, useEffect, useRef, useState } from 'react'
import EyeOff from 'lucide-react/dist/esm/icons/eye-off'
import Settings from 'lucide-react/dist/esm/icons/settings'
import UserX from 'lucide-react/dist/esm/icons/user-x'
import X from 'lucide-react/dist/esm/icons/x'
import { browser } from 'wxt/browser'
import { useBoldColor } from '../hooks/use-bold-color'
import { useGeminiApiKey } from '../hooks/use-gemini-api-key'
import { useHiddenThreads } from '../hooks/use-hidden-threads'
import { useIgnoredUsers } from '../hooks/use-ignored-users'
import { useImgbbApiKey } from '../hooks/use-imgbb-api-key'
import { useMobileLiteToggles } from '../hooks/use-mobile-lite-toggles'
import { useSheetDrag } from '../hooks/use-sheet-drag'
import { useStorageUsage } from '../hooks/use-storage-usage'
import { useWhatsNew } from '../hooks/use-whats-new'
import { type PanelTab, type PanelView } from './panel-helpers'
import { TAB_ACTIVE_CLASS, TAB_BASE_CLASS, TAB_IDLE_CLASS } from './panel-tokens'
import { PanelToast } from './panel-toast'
import { MobileLiteWhatsNewView } from './whats-new-view'
import { ConfirmClearHiddenThreadsDialog } from './confirm-clear-dialog'
import { SettingsTab } from './tabs/settings-tab'
import { ThreadsTab } from './tabs/threads-tab'
import { UsersTab } from './tabs/users-tab'

export const MOBILE_LITE_PANEL_OPEN_EVENT = 'mvp-mobile-lite-panel:open'

export function MobileLitePanel() {
	const [open, setOpen] = useState(false)
	const [panelView, setPanelView] = useState<PanelView>('main')
	const [activeTab, setActiveTab] = useState<PanelTab>('users')
	const panelBodyRef = useRef<HTMLDivElement>(null)
	const logoUrl = browser.runtime.getURL('/icon/48.png')

	const drag = useSheetDrag(() => setOpen(false))
	const whatsNew = useWhatsNew(open)
	const ignoredUsers = useIgnoredUsers({ open, activeTab, panelBodyRef })
	const hiddenThreads = useHiddenThreads({ open, panelBodyRef })
	const imgbb = useImgbbApiKey(open)
	const gemini = useGeminiApiKey(open)
	const boldColor = useBoldColor(open)
	const toggles = useMobileLiteToggles(open)
	const storageUsage = useStorageUsage(open)

	const { markWhatsNewAsSeen } = whatsNew

	useEffect(() => {
		const handleOpen = () => {
			setPanelView('main')
			setOpen(true)
		}
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') setOpen(false)
		}

		window.addEventListener(MOBILE_LITE_PANEL_OPEN_EVENT, handleOpen)
		window.addEventListener('keydown', handleKeyDown)

		return () => {
			window.removeEventListener(MOBILE_LITE_PANEL_OPEN_EVENT, handleOpen)
			window.removeEventListener('keydown', handleKeyDown)
		}
	}, [])

	useEffect(() => {
		if (!open) return

		const previousOverflow = document.body.style.overflow
		document.body.style.overflow = 'hidden'

		return () => {
			document.body.style.overflow = previousOverflow
		}
	}, [open])

	const openWhatsNewView = useCallback(() => {
		setPanelView('whats-new')
		void markWhatsNewAsSeen()
		panelBodyRef.current?.scrollTo?.({ top: 0 })
	}, [markWhatsNewAsSeen])

	if (!open) return null

	// The overlay anchors with inset-0 (layout viewport) — correct on every
	// well-behaved device. On Firefox Android the dynamic toolbar makes that
	// viewport end ABOVE the real screen bottom while the toolbar is visible,
	// and no CSS unit (100vh overshoots, 100dvh undershoots) nor the
	// VisualViewport API reports the difference. Instead of guessing, a bleed
	// strip below the sheet fills any potential gap with the tab bar color;
	// when the viewport is accurate the bleed simply sits off-screen.
	return (
		<div className="fixed inset-0 z-[99999] flex items-end justify-center overscroll-none bg-black/60 animate-in fade-in-0 duration-200">
			<button type="button" className="absolute inset-0 h-full w-full cursor-default" aria-label="Cerrar panel MVP" onClick={() => setOpen(false)} />

			{/* Bleed: fills the Firefox Android dynamic-toolbar gap below the sheet */}
			<div aria-hidden="true" className="absolute inset-x-0 top-full mx-auto h-28 w-full max-w-[34rem] bg-[#14171d]" />

			<section
				ref={drag.sheetRef}
				className="relative flex h-[90%] w-full max-w-[34rem] flex-col overflow-hidden rounded-t-[24px] bg-[#1c1f27] text-[#eef1f6] shadow-[0_-12px_48px_rgba(0,0,0,0.6)] animate-in slide-in-from-bottom-8 duration-300 ease-out"
				style={{
					transform: `translateY(${drag.dragOffset}px)`,
					transition: drag.isDragging ? 'none' : 'transform 220ms cubic-bezier(0.32, 0.72, 0, 1)',
				}}
			>
				<header
					className="shrink-0 touch-none select-none pt-[max(4px,env(safe-area-inset-top))]"
					onTouchStart={drag.handleSheetTouchStart}
					onTouchMove={drag.handleSheetTouchMove}
					onTouchEnd={drag.handleSheetTouchEnd}
				>
					{/* Grab handle (drag down to dismiss) */}
					<div className="flex justify-center pb-1 pt-2">
						<span className="h-1 w-10 rounded-full bg-[#3a4254]" aria-hidden="true" />
					</div>
					<div className="flex items-center justify-between gap-3 px-4 pb-2.5 pt-1">
						<div className="flex min-w-0 items-center gap-2.5">
							<img src={logoUrl} alt="" className="h-7 w-7 shrink-0 rounded-lg object-contain" aria-hidden="true" />
							<h2 className="flex min-w-0 items-baseline gap-2 truncate">
								<span className="shrink-0 text-base font-black uppercase leading-none tracking-tighter">
									<span className="italic">MV</span>
									<span className="text-[#f0a020]">Premium</span>
								</span>
								<span className="truncate text-[9px] font-bold uppercase leading-none tracking-[0.25em] text-[#8b95a3]/80">
									Dashboard
								</span>
							</h2>
						</div>
						<button
							type="button"
							className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#2e3543] text-[#aab4c0] transition-colors active:bg-[#3a4254]"
							aria-label="Cerrar"
							onClick={() => setOpen(false)}
						>
							<X className="h-5 w-5" aria-hidden="true" />
						</button>
					</div>
				</header>

				<div ref={panelBodyRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6">
					{panelView === 'whats-new' ? (
						<MobileLiteWhatsNewView
							entries={whatsNew.mobileLiteChangelog}
							onBack={() => setPanelView('main')}
							onDone={() => {
								void markWhatsNewAsSeen()
								setPanelView('main')
							}}
						/>
					) : activeTab === 'users' ? (
						<UsersTab
							hasUnseenWhatsNew={whatsNew.hasUnseenWhatsNew}
							latestMobileLiteEntry={whatsNew.latestMobileLiteEntry}
							latestMobileLiteChangeCount={whatsNew.latestMobileLiteChangeCount}
							onOpenWhatsNew={openWhatsNewView}
							onDismissWhatsNew={() => void markWhatsNewAsSeen()}
							query={ignoredUsers.query}
							onQueryChange={ignoredUsers.handleQueryChange}
							usernameValidationMessage={ignoredUsers.usernameValidationMessage}
							hasAnyFilteredUsers={ignoredUsers.hasAnyFilteredUsers}
							filterOptions={ignoredUsers.filterOptions}
							activeFilter={ignoredUsers.activeFilter}
							onActiveFilterChange={ignoredUsers.setActiveFilter}
							canAddQueryUser={ignoredUsers.canAddQueryUser}
							addUserSuggestions={ignoredUsers.addUserSuggestions}
							exactQuerySuggestion={ignoredUsers.exactQuerySuggestion}
							exactQueryDisplayName={ignoredUsers.exactQueryDisplayName}
							exactQueryUsername={ignoredUsers.exactQueryUsername}
							savingUser={ignoredUsers.savingUser}
							onAddQueryFilter={ignoredUsers.addQueryFilter}
							onAddSuggestionFilter={ignoredUsers.addSuggestionFilter}
							missingAvatarCount={ignoredUsers.missingAvatarCount}
							refreshingAvatars={ignoredUsers.refreshingAvatars}
							onRefreshAvatars={ignoredUsers.refreshMissingAvatars}
							filteredUsers={ignoredUsers.filteredUsers}
							onUpdateFilter={ignoredUsers.updateFilter}
							onRemoveUserFilter={ignoredUsers.removeUserFilter}
						/>
					) : activeTab === 'threads' ? (
						<ThreadsTab
							hiddenThreads={hiddenThreads.hiddenThreads}
							hiddenThreadQuery={hiddenThreads.hiddenThreadQuery}
							filteredHiddenThreads={hiddenThreads.filteredHiddenThreads}
							restoringThread={hiddenThreads.restoringThread}
							clearingHiddenThreads={hiddenThreads.clearingHiddenThreads}
							onHiddenThreadQueryChange={hiddenThreads.setHiddenThreadQuery}
							onRequestClearAll={() => hiddenThreads.setConfirmClearHiddenThreads(true)}
							onRestoreThread={hiddenThreads.restoreHiddenThread}
						/>
					) : (
						<SettingsTab
							latestMobileLiteEntry={whatsNew.latestMobileLiteEntry}
							latestMobileLiteChangeCount={whatsNew.latestMobileLiteChangeCount}
							hasUnseenWhatsNew={whatsNew.hasUnseenWhatsNew}
							onOpenWhatsNew={openWhatsNewView}
							imgbbApiKeyDraft={imgbb.imgbbApiKeyDraft}
							isImgbbConfigured={imgbb.isImgbbConfigured}
							isImgbbDirty={imgbb.isImgbbDirty}
							savingImgbbApiKey={imgbb.savingImgbbApiKey}
							onImgbbDraftChange={imgbb.handleDraftChange}
							onSaveImgbbApiKey={imgbb.saveImgbbApiKey}
							geminiApiKeyDraft={gemini.geminiApiKeyDraft}
							isGeminiConfigured={gemini.isGeminiConfigured}
							isGeminiDirty={gemini.isGeminiDirty}
							savingGeminiApiKey={gemini.savingGeminiApiKey}
							onGeminiDraftChange={gemini.handleDraftChange}
							onSaveGeminiApiKey={gemini.saveGeminiApiKey}
							boldColor={boldColor.boldColor}
							boldColorDraft={boldColor.boldColorDraft}
							normalizedBoldColorDraft={boldColor.normalizedBoldColorDraft}
							boldColorEnabled={boldColor.boldColorEnabled}
							boldColorExpanded={boldColor.boldColorExpanded}
							isBoldColorDirty={boldColor.isBoldColorDirty}
							savingBoldColor={boldColor.savingBoldColor}
							onToggleBoldColor={boldColor.toggleBoldColor}
							onToggleBoldColorExpanded={boldColor.toggleExpanded}
							onBoldColorDraftChange={boldColor.handleDraftChange}
							onResetBoldColor={boldColor.resetBoldColor}
							onSaveBoldColor={boldColor.saveBoldColor}
							liveThreadEnabled={toggles.liveThreadEnabled}
							galleryButtonEnabled={toggles.galleryButtonEnabled}
							quoteSelectionEnabled={toggles.quoteSelectionEnabled}
							hideThreadButtonEnabled={toggles.hideThreadButtonEnabled}
							savingMobileLiteSetting={toggles.savingMobileLiteSetting}
							onToggleLiveThread={toggles.toggleLiveThread}
							onToggleGallery={toggles.toggleGallery}
							onToggleQuoteSelection={toggles.toggleQuoteSelection}
							onToggleHideThread={toggles.toggleHideThread}
							storageUsage={storageUsage}
						/>
					)}
				</div>

				{/* Single feedback channel: transient toasts floating above the tab bar */}
				<div className="pointer-events-none absolute inset-x-0 bottom-24 z-30 flex flex-col items-center gap-2 px-4">
					{ignoredUsers.statusMessage && <PanelToast kind="success">{ignoredUsers.statusMessage}</PanelToast>}
					{hiddenThreads.statusMessage && <PanelToast kind="success">{hiddenThreads.statusMessage}</PanelToast>}
					{imgbb.statusMessage && <PanelToast kind="success">{imgbb.statusMessage}</PanelToast>}
					{gemini.statusMessage && <PanelToast kind="success">{gemini.statusMessage}</PanelToast>}
					{boldColor.statusMessage && <PanelToast kind="success">{boldColor.statusMessage}</PanelToast>}
					{toggles.statusMessage && <PanelToast kind="success">{toggles.statusMessage}</PanelToast>}
					{ignoredUsers.errorMessage && <PanelToast kind="error">{ignoredUsers.errorMessage}</PanelToast>}
					{hiddenThreads.errorMessage && <PanelToast kind="error">{hiddenThreads.errorMessage}</PanelToast>}
					{imgbb.errorMessage && <PanelToast kind="error">{imgbb.errorMessage}</PanelToast>}
					{gemini.errorMessage && <PanelToast kind="error">{gemini.errorMessage}</PanelToast>}
					{boldColor.errorMessage && <PanelToast kind="error">{boldColor.errorMessage}</PanelToast>}
					{toggles.errorMessage && <PanelToast kind="error">{toggles.errorMessage}</PanelToast>}
				</div>

				{/* Bottom tab bar: thumb-reachable primary navigation */}
				<nav className="relative shrink-0 border-t border-[#2c3340] bg-[#14171d] px-3 pb-[max(10px,env(safe-area-inset-bottom))] pt-2 shadow-[0_-10px_30px_rgba(0,0,0,0.45)]">
					<div className="flex h-[52px] items-stretch gap-1.5" role="tablist" aria-label="Secciones del panel MVPremium">
						<button
							type="button"
							role="tab"
							aria-selected={activeTab === 'users'}
							aria-label="Usuarios"
							className={`${TAB_BASE_CLASS} ${activeTab === 'users' ? TAB_ACTIVE_CLASS : TAB_IDLE_CLASS}`}
							onClick={() => {
								setPanelView('main')
								setActiveTab('users')
							}}
						>
							<span className="relative">
								<UserX className="h-5 w-5" aria-hidden="true" />
								{ignoredUsers.allFilteredUsers.length > 0 && (
									<span
										aria-hidden="true"
										className="absolute -right-2.5 -top-2 inline-flex min-w-[18px] items-center justify-center rounded-full bg-[#f0a020] px-1 text-[10px] font-black leading-[18px] text-[#221604] ring-2 ring-[#14171d]"
									>
										{ignoredUsers.allFilteredUsers.length}
									</span>
								)}
							</span>
							Usuarios
						</button>
						<button
							type="button"
							role="tab"
							aria-selected={activeTab === 'threads'}
							aria-label="Hilos"
							className={`${TAB_BASE_CLASS} ${activeTab === 'threads' ? TAB_ACTIVE_CLASS : TAB_IDLE_CLASS}`}
							onClick={() => {
								setPanelView('main')
								setActiveTab('threads')
							}}
						>
							<span className="relative">
								<EyeOff className="h-5 w-5" aria-hidden="true" />
								{hiddenThreads.hiddenThreads.length > 0 && (
									<span
										aria-hidden="true"
										className="absolute -right-2.5 -top-2 inline-flex min-w-[18px] items-center justify-center rounded-full bg-[#f0a020] px-1 text-[10px] font-black leading-[18px] text-[#221604] ring-2 ring-[#14171d]"
									>
										{hiddenThreads.hiddenThreads.length}
									</span>
								)}
							</span>
							Hilos
						</button>
						<button
							type="button"
							role="tab"
							aria-selected={activeTab === 'settings'}
							className={`${TAB_BASE_CLASS} ${activeTab === 'settings' ? TAB_ACTIVE_CLASS : TAB_IDLE_CLASS}`}
							onClick={() => {
								setPanelView('main')
								setActiveTab('settings')
							}}
						>
							<Settings className="h-5 w-5" aria-hidden="true" />
							Ajustes
						</button>
					</div>
				</nav>
			</section>

			{hiddenThreads.confirmClearHiddenThreads && (
				<ConfirmClearHiddenThreadsDialog
					clearing={hiddenThreads.clearingHiddenThreads}
					onCancel={() => hiddenThreads.setConfirmClearHiddenThreads(false)}
					onConfirm={hiddenThreads.restoreAllHiddenThreads}
				/>
			)}
		</div>
	)
}
