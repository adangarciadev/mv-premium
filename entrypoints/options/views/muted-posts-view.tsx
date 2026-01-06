import { useState } from 'react'
import Plus from 'lucide-react/dist/esm/icons/plus'
import X from 'lucide-react/dist/esm/icons/x'
import Shield from 'lucide-react/dist/esm/icons/shield'
import Info from 'lucide-react/dist/esm/icons/info'
import Search from 'lucide-react/dist/esm/icons/search'
import { useSettingsStore } from '@/store/settings-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function MutedPostsView() {
	const { mutedWordsEnabled, setMutedWordsEnabled, mutedWords, setMutedWords } = useSettingsStore()

	const [inputValue, setInputValue] = useState('')
	const [searchFilter, setSearchFilter] = useState('')

    const CHAR_LIMIT = 20

	// Filter words based on search
	const filteredWords = searchFilter
		? mutedWords.filter(word => word.toLowerCase().includes(searchFilter.toLowerCase()))
		: mutedWords

	const handleAddWord = () => {
		const word = inputValue.trim()

		if (!word) return

		// Strict validation: No spaces allowed
		if (/\s/.test(word)) {
			toast.error('Solo se permiten palabras sueltas (sin espacios)')
			return
		}
		
		if (word.length > CHAR_LIMIT) {
			toast.error(`La palabra no puede superar los ${CHAR_LIMIT} caracteres`)
			return
		}

		// Always lowercase
		const normalizedWord = word.toLowerCase()

		if (mutedWords.includes(normalizedWord)) {
			toast.error('Esta palabra ya está silenciada')
			return
		}

		setMutedWords([...mutedWords, normalizedWord])
		setInputValue('')
		toast.success('Palabra añadida a la lista negra')
	}

	const handleRemoveWord = (wordToRemove: string) => {
		setMutedWords(mutedWords.filter(w => w !== wordToRemove))
		toast.success('Palabra eliminada')
	}

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'Enter') {
			handleAddWord()
		}
	}

	return (
		<div className="flex flex-col gap-6 max-w-4xl mx-auto p-6 animate-in fade-in duration-300">
			<div className="space-y-2">
				<h1 className="text-3xl font-bold tracking-tight">Palabras Silenciadas</h1>
				<p className="text-muted-foreground">
					Gestiona las palabras o frases que quieres filtrar automáticamente en el foro.
				</p>
			</div>

			<div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 flex gap-3 text-amber-600 dark:text-amber-400">
				<Info className="h-5 w-5 shrink-0 mt-0.5" />
				<div className="space-y-1">
					<p className="font-semibold text-amber-700 dark:text-amber-300">¿Cómo funciona el silenciado?</p>
					<p className="text-sm leading-relaxed opacity-90">
						Cualquier post que contenga alguna de las palabras de tu lista negra{' '}
						<strong className="text-amber-700 dark:text-amber-300">dejará de estar visible</strong> de forma automática.
						En su lugar, verás un aviso sutil que te permitirá revelar el contenido si así lo deseas.
					</p>
				</div>
			</div>

			<Card>
				<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
					<div className="space-y-1">
						<CardTitle className="text-xl">Activar filtrado</CardTitle>
						<CardDescription>Habilita o deshabilita el ocultamiento automático de contenido.</CardDescription>
					</div>
					<Switch
						checked={mutedWordsEnabled}
						onCheckedChange={val => {
							setMutedWordsEnabled(val)
							toast.success(val ? 'Filtrado activado' : 'Filtrado desactivado')
						}}
					/>
				</CardHeader>
			</Card>

			<Card className={!mutedWordsEnabled ? 'opacity-60 pointer-events-none transition-opacity' : 'transition-opacity'}>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Shield className="h-5 w-5" />
						Tu Lista Negra
					</CardTitle>
					<CardDescription>
						Introduce palabras que quieras evitar en el foro.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-6">
					<div className="space-y-2">
						<div className="flex gap-2">
                            <Input
                                placeholder="Ej: 'spoiler', 'troll', 'fútbol'..."
                                value={inputValue}
                                onChange={e => {
									const val = e.target.value
									if (val.length <= CHAR_LIMIT) {
										setInputValue(val)
									}
								}}
                                onKeyDown={handleKeyDown}
                                className="max-w-md"
                            />
                            <Button onClick={handleAddWord}>
                                <Plus className="h-4 w-4 mr-2" />
                                Añadir
                            </Button>
                        </div>
						<div className="flex justify-between max-w-md px-1">
							<p className="text-xs text-muted-foreground">Solo palabras sueltas, sin espacios.</p>
							<p className={`text-xs ${inputValue.length === CHAR_LIMIT ? "text-amber-500 font-bold" : "text-muted-foreground"}`}>
								{inputValue.length}/{CHAR_LIMIT}
							</p>
						</div>
					</div>

					<Separator />

					{mutedWords.length === 0 ? (
						<div className="flex flex-col items-center justify-center py-8 text-muted-foreground text-center">
							<Info className="h-12 w-12 mb-4 opacity-20" />
							<p>No tienes palabras silenciadas.</p>
							<p className="text-sm">Añade palabras arriba para empezar a limpiar tu feed.</p>
						</div>
					) : (
						<div className="space-y-4">
							{/* Search filter - only show if there are more than 5 words */}
							{mutedWords.length > 5 && (
								<div className="relative">
									<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
									<Input
										placeholder="Buscar en tu lista..."
										value={searchFilter}
										onChange={e => setSearchFilter(e.target.value)}
										className="pl-9 max-w-xs"
									/>
									{searchFilter && (
										<span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
											{filteredWords.length} / {mutedWords.length}
										</span>
									)}
								</div>
							)}

							{/* Word count */}
							{!searchFilter && mutedWords.length > 0 && (
								<p className="text-xs text-muted-foreground">
									{mutedWords.length} {mutedWords.length === 1 ? 'palabra' : 'palabras'} silenciadas
								</p>
							)}

							{/* No results message */}
							{searchFilter && filteredWords.length === 0 && (
								<p className="text-sm text-muted-foreground py-4 text-center">
									No se encontraron palabras que coincidan con "{searchFilter}"
								</p>
							)}

							{/* Words list */}
							<div className="flex flex-wrap gap-2">
								{filteredWords.map(word => (
									<Badge
										key={word}
										variant="secondary"
										className="px-3 py-1 text-sm flex items-center gap-2 hover:bg-destructive hover:text-destructive-foreground transition-colors cursor-pointer group"
										onClick={() => handleRemoveWord(word)}
									>
										{word}
										<X className="h-3 w-3 opacity-50 group-hover:opacity-100" />
									</Badge>
								))}
							</div>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	)
}
