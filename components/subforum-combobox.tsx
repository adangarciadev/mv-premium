import { useState } from 'react'
import Check from 'lucide-react/dist/esm/icons/check'
import ChevronsUpDown from 'lucide-react/dist/esm/icons/chevrons-up-down'
import Star from 'lucide-react/dist/esm/icons/star'
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ALL_SUBFORUMS } from "@/lib/subforums"
import { useFavoriteSubforums } from "@/features/favorite-subforums/hooks/use-favorite-subforums"
import { NativeFidIcon } from "@/components/native-fid-icon"

interface SubforumComboboxProps {
  value: string
  onValueChange: (value: string) => void
  className?: string
}

/**
 * SubforumCombobox component - A searchable dropdown for selecting a subforum
 * Used in settings and form-like contexts.
 * @param value - Selected subforum slug
 * @param onValueChange - Callback when a subforum is selected
 * @param className - Optional CSS classes
 */
export function SubforumCombobox({ value, onValueChange, className }: SubforumComboboxProps) {
  const [open, setOpen] = useState(false)
  const { subforums: favoriteSubforums } = useFavoriteSubforums()

  const selectedSubforum = ALL_SUBFORUMS.find((sf) => sf.slug === value)
  
  const favoriteIds = new Set(favoriteSubforums.map(f => f.id))
  const favorites = ALL_SUBFORUMS.filter(sf => favoriteIds.has(sf.slug))
  const others = ALL_SUBFORUMS.filter(sf => !favoriteIds.has(sf.slug))

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("justify-between h-8 text-xs font-normal", className)}
        >
          <span className="flex items-center gap-2">
            {selectedSubforum && <NativeFidIcon iconId={selectedSubforum.iconId} className="h-4 w-4" />}
            {selectedSubforum ? selectedSubforum.name : "Sin subforo"}
          </span>
          <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar subforo..." className="h-9" />
          <CommandList>
            <CommandEmpty>No se encontró ningún subforo.</CommandEmpty>
            
            <CommandGroup>
              <CommandItem
                value="none"
                onSelect={() => {
                  onValueChange("none")
                  setOpen(false)
                }}
              >
                Sin subforo
                <Check
                  className={cn(
                    "ml-auto h-4 w-4",
                    value === "none" ? "opacity-100" : "opacity-0"
                  )}
                />
              </CommandItem>
            </CommandGroup>
            
            {favorites.length > 0 && (
              <CommandGroup heading="⭐ Favoritos">
                {favorites.map((sf) => (
                  <CommandItem
                    key={sf.slug}
                    value={sf.name}
                    onSelect={() => {
                      onValueChange(sf.slug)
                      setOpen(false)
                    }}
                  >
                    <NativeFidIcon iconId={sf.iconId} className="h-4 w-4 mr-2" />
                    <Star className="h-2.5 w-2.5 mr-1.5 text-yellow-500 fill-yellow-500" />
                    {sf.name}
                    <Check
                      className={cn(
                        "ml-auto h-4 w-4",
                        value === sf.slug ? "opacity-100" : "opacity-0"
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            
            <CommandGroup heading={favorites.length > 0 ? "Todos los subforos" : undefined}>
              {others.map((sf) => (
                <CommandItem
                  key={sf.slug}
                  value={sf.name}
                  onSelect={() => {
                    onValueChange(sf.slug)
                    setOpen(false)
                  }}
                >
                  <NativeFidIcon iconId={sf.iconId} className="h-4 w-4 mr-2" />
                  {sf.name}
                  <Check
                    className={cn(
                      "ml-auto h-4 w-4",
                      value === sf.slug ? "opacity-100" : "opacity-0"
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

