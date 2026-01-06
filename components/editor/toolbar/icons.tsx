import Bold from 'lucide-react/dist/esm/icons/bold'
import Italic from 'lucide-react/dist/esm/icons/italic'
import Underline from 'lucide-react/dist/esm/icons/underline'
import Strikethrough from 'lucide-react/dist/esm/icons/strikethrough'
import Link from 'lucide-react/dist/esm/icons/link'
import Quote from 'lucide-react/dist/esm/icons/quote'
import Code from 'lucide-react/dist/esm/icons/code'
import AlignCenter from 'lucide-react/dist/esm/icons/align-center'
import Heading from 'lucide-react/dist/esm/icons/heading'
import EyeOff from 'lucide-react/dist/esm/icons/eye-off'
import Ban from 'lucide-react/dist/esm/icons/ban'
import Image from 'lucide-react/dist/esm/icons/image'
import Table from 'lucide-react/dist/esm/icons/table'
import Undo from 'lucide-react/dist/esm/icons/undo'
import Redo from 'lucide-react/dist/esm/icons/redo'
import Wand2 from 'lucide-react/dist/esm/icons/wand-2'
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down'
import FileText from 'lucide-react/dist/esm/icons/file-text'
import ListTree from 'lucide-react/dist/esm/icons/list-tree'

export const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  'fa-bold': Bold,
  'fa-italic': Italic,
  'fa-underline': Underline,
  'fa-strikethrough': Strikethrough,
  'fa-link': Link,
  'fa-quote-left': Quote,
  'fa-code': Code,
  'fa-align-center': AlignCenter,
  'fa-heading': Heading,
  'fa-eye-slash': EyeOff,
  'fa-ban': Ban,
  'fa-image': Image,
  'fa-table': Table,
  'fa-undo': Undo,
  'fa-repeat': Redo,
  'fa-magic': Wand2,
  'fa-caret-down': ChevronDown,
  'fa-file-text-o': FileText,
  'fa-list-ol': ListTree,
}

export function getToolbarIcon(iconName: string): React.ComponentType<{ className?: string }> | null {
  return ICON_MAP[iconName] || null
}
