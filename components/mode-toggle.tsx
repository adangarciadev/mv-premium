import { useState } from 'react'
import Moon from 'lucide-react/dist/esm/icons/moon'
import Sun from 'lucide-react/dist/esm/icons/sun'
import Palette from 'lucide-react/dist/esm/icons/palette'
import Check from 'lucide-react/dist/esm/icons/check'
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right'
import { Button } from '@/components/ui/button'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
	DropdownMenuSeparator,
	DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import { useTheme } from '@/providers/theme-provider'
import { ThemeEditorSheet } from '@/features/theme-editor'

/**
 * ModeToggle component - Theme switcher dropdown (Light/Dark/System)
 * Also provides access to the custom Theme Editor
 */
export function ModeToggle() {
	const { theme, setTheme, resolvedTheme } = useTheme()
	const [themeEditorOpen, setThemeEditorOpen] = useState(false)

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button variant="outline" size="icon">
						<Sun className="h-[1.2rem] w-[1.2rem] scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
						<Moon className="absolute h-[1.2rem] w-[1.2rem] scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
						<span className="sr-only">Toggle theme</span>
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="w-44">
					<DropdownMenuLabel className="text-xs text-muted-foreground">Modo</DropdownMenuLabel>
					<DropdownMenuItem onClick={() => setTheme('light')}>
						<Sun className="mr-2 h-4 w-4" />
						Claro
						{theme === 'light' && <Check className="ml-auto h-4 w-4" />}
					</DropdownMenuItem>
					<DropdownMenuItem onClick={() => setTheme('dark')}>
						<Moon className="mr-2 h-4 w-4" />
						Oscuro
						{theme === 'dark' && <Check className="ml-auto h-4 w-4" />}
					</DropdownMenuItem>
					<DropdownMenuItem onClick={() => setTheme('system')}>
						<span className="mr-2 h-4 w-4 flex items-center justify-center text-xs">💻</span>
						Sistema
						{theme === 'system' && <Check className="ml-auto h-4 w-4" />}
					</DropdownMenuItem>
					
					<DropdownMenuSeparator />
					
					<DropdownMenuItem onClick={() => setThemeEditorOpen(true)}>
						<Palette className="mr-2 h-4 w-4" />
						Personalizar
						<ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>

			<ThemeEditorSheet
				resolvedTheme={resolvedTheme}
				open={themeEditorOpen}
				onOpenChange={setThemeEditorOpen}
			/>
		</>
	)
}

