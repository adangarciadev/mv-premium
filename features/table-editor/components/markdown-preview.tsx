import { useState } from 'react'
import Code2 from 'lucide-react/dist/esm/icons/code-2'
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down'
import { cn } from '@/lib/utils'

interface MarkdownPreviewProps {
	generateMarkdown: () => string
}

export function MarkdownPreview({ generateMarkdown }: MarkdownPreviewProps) {
	const [showPreview, setShowPreview] = useState(false)

	return (
		<div className="px-4 pb-3">
			<button
				onClick={() => setShowPreview(!showPreview)}
				className="flex items-center gap-1.5 p-1 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer bg-transparent border-none outline-none"
			>
				<Code2 className="w-3.5 h-3.5" />
				<span>Vista previa del código</span>
				<ChevronDown className={cn('w-3 h-3 transition-transform duration-150', showPreview && 'rotate-180')} />
			</button>
			{showPreview && (
				<pre className="mt-2 p-3 bg-muted border border-border rounded-md text-xs font-mono text-muted-foreground overflow-auto max-h-[100px] whitespace-pre scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
					{generateMarkdown()}
				</pre>
			)}
		</div>
	)
}
