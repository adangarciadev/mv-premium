/**
 * Google Font Picker - Searchable Google Fonts selector
 *
 * Uses a static list of the ~200 most popular Google Fonts
 * to avoid API calls and keep the extension fast.
 */
import { useState, useMemo, useEffect, useCallback } from 'react'
import Check from 'lucide-react/dist/esm/icons/check'
import ChevronsUpDown from 'lucide-react/dist/esm/icons/chevrons-up-down'
import Search from 'lucide-react/dist/esm/icons/search'
import X from 'lucide-react/dist/esm/icons/x'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
// Top 200 Google Fonts by popularity (curated list)
const GOOGLE_FONTS = [
	// Popular Sans-serif
	'Inter',
	'Roboto',
	'Open Sans',
	'Lato',
	'Montserrat',
	'Poppins',
	'Source Sans 3',
	'Nunito',
	'Raleway',
	'Ubuntu',
	'Fira Sans',
	'Work Sans',
	'Outfit',
	'Space Grotesk',
	'Nunito Sans',
	'Rubik',
	'Quicksand',
	'Mulish',
	'Barlow',
	'Manrope',
	'DM Sans',
	'Josefin Sans',
	'Karla',
	'Cabin',
	'Arimo',
	'Dosis',
	'Libre Franklin',
	'Exo 2',
	'Titillium Web',
	'Varela Round',
	'Assistant',
	'Catamaran',
	'Abel',
	'Questrial',
	'Signika',
	'Overpass',
	'Maven Pro',
	'Prompt',
	'Hind',
	'Archivo',
	'Lexend',
	'Plus Jakarta Sans',
	'Red Hat Display',
	'Sora',
	'Urbanist',
	'Figtree',
	'Onest',
	'Geist',
	'Be Vietnam Pro',
	'Public Sans',
	'Atkinson Hyperlegible',

	// Popular Serif
	'Merriweather',
	'Playfair Display',
	'Lora',
	'PT Serif',
	'Noto Serif',
	'Libre Baskerville',
	'Source Serif 4',
	'Bitter',
	'Crimson Text',
	'EB Garamond',
	'Cormorant Garamond',
	'Spectral',
	'Vollkorn',
	'Cardo',
	'Gentium Book Plus',
	'Literata',
	'Newsreader',
	'Fraunces',
	'Bodoni Moda',
	'DM Serif Display',
	'Young Serif',

	// Display / Decorative
	'Oswald',
	'Bebas Neue',
	'Anton',
	'Archivo Black',
	'Righteous',
	'Passion One',
	'Abril Fatface',
	'Alfa Slab One',
	'Bungee',
	'Fredoka',
	'Lilita One',
	'Paytone One',
	'Russo One',
	'Secular One',
	'Staatliches',
	'Teko',
	'Black Ops One',
	'Bowlby One SC',
	'Bree Serif',
	'Concert One',
	'Fugaz One',
	'Graduate',
	'Knewave',
	'Lobster Two',
	'Oleo Script',
	'Patua One',
	'Prosto One',
	'Rampart One',
	'Rubik Mono One',
	'Saira Stencil One',
	'Shrikhand',
	'Sigmar One',
	'Squada One',
	'Ultra',

	// Handwriting / Script
	'Dancing Script',
	'Pacifico',
	'Caveat',
	'Satisfy',
	'Great Vibes',
	'Lobster',
	'Sacramento',
	'Kaushan Script',
	'Permanent Marker',
	'Indie Flower',
	'Shadows Into Light',
	'Amatic SC',
	'Architects Daughter',
	'Cookie',
	'Courgette',
	'Gloria Hallelujah',
	'Homemade Apple',
	'Kalam',
	'Leckerli One',
	'Marck Script',
	'Nothing You Could Do',
	'Patrick Hand',
	'Rock Salt',
	'Tangerine',
	'Yellowtail',
	'Allura',
	'Alex Brush',

	// Monospace
	'JetBrains Mono',
	'Fira Code',
	'Source Code Pro',
	'Roboto Mono',
	'IBM Plex Mono',
	'Ubuntu Mono',
	'Inconsolata',
	'Space Mono',
	'Anonymous Pro',
	'Cousine',
	'PT Mono',
	'Nanum Gothic Coding',
	'Overpass Mono',
	'Red Hat Mono',
	'Azeret Mono',
	'Martian Mono',
	'Commit Mono',

	// More sans-serif
	'Heebo',
	'Kanit',
	'Noto Sans',
	'Oxygen',
	'Asap',
	'Mukta',
	'Sarabun',
	'Yantramanav',
	'Encode Sans',
	'Chivo',
	'Comfortaa',
	'Monda',
	'Acme',
	'Orbitron',
	'Rajdhani',
	'Play',
	'Gruppo',
	'Advent Pro',
	'Economica',
	'Electrolize',
	'Share Tech',
	'Exo',
	'Michroma',
	'Audiowide',
	'Coda',
	'Quantico',
	'Jura',
	'Aldrich',
	'Syncopate',

	// Extra variety
	'Cormorant',
	'Cinzel',
	'Forum',
	'Marcellus',
	'Philosopher',
	'Sorts Mill Goudy',
	'Gilda Display',
	'Mate',
	'Fanwood Text',
	'GFS Didot',
	'Oranienbaum',
	'Prata',
	'Rufina',
	'Sahitya',
	'Suranna',
	'Tinos',
	'Unna',
	'Vidaloka',
	'Zilla Slab',
	'Arvo',
	'Crete Round',
	'Domine',
	'Enriqueta',
	'Noticia Text',
	'Rokkitt',
	'Sanchez',
	'Slabo 27px',
	'Trocchi',
	'Aleo',
	'Amiri',
]

interface GoogleFontPickerProps {
	value: string
	onChange: (font: string) => void
}

/**
 * GoogleFontPicker component - Dropdown to select and preview Google Fonts
 */
export function GoogleFontPicker({ value, onChange }: GoogleFontPickerProps) {
	const [open, setOpen] = useState(false)
	const [search, setSearch] = useState('')

	// Filter fonts based on search
	const filteredFonts = useMemo(() => {
		if (!search) return GOOGLE_FONTS
		const searchLower = search.toLowerCase()
		return GOOGLE_FONTS.filter(font => font.toLowerCase().includes(searchLower))
	}, [search])

	// Load multiple fonts in a single request (much faster!)
	/**
	 * Loads multiple fonts in a single request (batch optimization)
	 */
	const loadFontsBatch = useCallback((fonts: string[]) => {
		// Filter out already loaded fonts
		const fontsToLoad = fonts.filter(font => {
			const linkId = `preview-font-${font.replace(/\s+/g, '-')}`
			return !document.getElementById(linkId)
		})

		if (fontsToLoad.length === 0) return

		// Mark them as loading (to prevent duplicate requests)
		fontsToLoad.forEach(font => {
			const marker = document.createElement('meta')
			marker.id = `preview-font-${font.replace(/\s+/g, '-')}`
			document.head.appendChild(marker)
		})

		// Build a single URL with all fonts
		const families = fontsToLoad.map(f => `family=${f.replace(/\s+/g, '+')}`).join('&')
		const link = document.createElement('link')
		link.rel = 'stylesheet'
		link.href = `https://fonts.googleapis.com/css2?${families}&display=swap`
		document.head.appendChild(link)
	}, [])

	// Load selected font on mount to show preview in trigger
	useEffect(() => {
		if (value) {
			loadFontsBatch([value])
		}
	}, [value, loadFontsBatch])

	// Pre-load first batch of visible fonts when popover opens
	useEffect(() => {
		if (!open) return
		// Load first 20 fonts in one request
		loadFontsBatch(filteredFonts.slice(0, 20))
	}, [open, filteredFonts, loadFontsBatch])

	// Load more fonts on scroll (batched)
	const handleScroll = useCallback(
		(e: React.UIEvent<HTMLDivElement>) => {
			const container = e.currentTarget
			const scrollTop = container.scrollTop
			const itemHeight = 32
			const startIndex = Math.floor(scrollTop / itemHeight)
			const endIndex = Math.min(startIndex + 25, filteredFonts.length)

			loadFontsBatch(filteredFonts.slice(startIndex, endIndex))
		},
		[filteredFonts, loadFontsBatch]
	)

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between h-10">
					<span className="truncate" style={value ? { fontFamily: `"${value}", system-ui` } : undefined}>
						{value || 'Selecciona una fuente...'}
					</span>
					<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-[300px] p-0" align="start">
				<div className="flex items-center border-b px-3">
					<Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
					<input
						placeholder="Buscar fuente..."
						value={search}
						onChange={e => setSearch(e.target.value)}
						className="flex h-10 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
					/>
					{search && (
						<Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setSearch('')}>
							<X className="h-3 w-3" />
						</Button>
					)}
				</div>
				<div className="max-h-[300px] overflow-y-auto overscroll-contain" onScroll={handleScroll}>
					{filteredFonts.length === 0 ? (
						<div className="py-6 text-center text-sm text-muted-foreground">No se encontró ninguna fuente.</div>
					) : (
						<div className="p-1">
							{/* Default option */}
							<button
								type="button"
								onClick={() => {
									onChange('')
									setOpen(false)
								}}
								className={cn(
									'relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none',
									'hover:bg-accent hover:text-accent-foreground',
									!value && 'bg-accent'
								)}
							>
								<Check className={cn('mr-2 h-4 w-4', !value ? 'opacity-100' : 'opacity-0')} />
								<span className="text-muted-foreground">Por defecto (navegador)</span>
							</button>

							{/* Font list */}
							{filteredFonts.map(font => (
								<button
									type="button"
									key={font}
									data-font={font}
									onClick={() => {
										onChange(font)
										setOpen(false)
									}}
									className={cn(
										'relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none',
										'hover:bg-accent hover:text-accent-foreground',
										value === font && 'bg-accent'
									)}
								>
									<Check className={cn('mr-2 h-4 w-4', value === font ? 'opacity-100' : 'opacity-0')} />
									<span style={{ fontFamily: `"${font}", system-ui` }}>{font}</span>
								</button>
							))}
						</div>
					)}
				</div>
				<div className="border-t p-2 text-xs text-muted-foreground text-center">
					{filteredFonts.length} fuentes disponibles
				</div>
			</PopoverContent>
		</Popover>
	)
}
