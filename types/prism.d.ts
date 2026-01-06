/**
 * Type declarations for PrismJS language components
 *
 * PrismJS language components are side-effect modules that register
 * themselves with the global Prism instance. They don't export anything.
 *
 * @see https://prismjs.com/
 * @see ADR-004 for background on why Prism runs in background script
 */

// Declare Prism language component modules as side-effect imports
declare module 'prismjs/components/prism-javascript' {
	const _: void
	export default _
}

declare module 'prismjs/components/prism-typescript' {
	const _: void
	export default _
}

declare module 'prismjs/components/prism-css' {
	const _: void
	export default _
}

declare module 'prismjs/components/prism-markup' {
	const _: void
	export default _
}

declare module 'prismjs/components/prism-python' {
	const _: void
	export default _
}

declare module 'prismjs/components/prism-bash' {
	const _: void
	export default _
}

declare module 'prismjs/components/prism-json' {
	const _: void
	export default _
}

declare module 'prismjs/components/prism-sql' {
	const _: void
	export default _
}

declare module 'prismjs/components/prism-java' {
	const _: void
	export default _
}

declare module 'prismjs/components/prism-go' {
	const _: void
	export default _
}

declare module 'prismjs/components/prism-rust' {
	const _: void
	export default _
}

declare module 'prismjs/components/prism-c' {
	const _: void
	export default _
}

declare module 'prismjs/components/prism-cpp' {
	const _: void
	export default _
}

declare module 'prismjs/components/prism-clike' {
	const _: void
	export default _
}

declare module 'prismjs/components/prism-csharp' {
	const _: void
	export default _
}

declare module 'prismjs/components/prism-php' {
	const _: void
	export default _
}

declare module 'prismjs/components/prism-jsx' {
	const _: void
	export default _
}

declare module 'prismjs/components/prism-tsx' {
	const _: void
	export default _
}

// Wildcard declaration for any other Prism language component
declare module 'prismjs/components/prism-*' {
	const _: void
	export default _
}
