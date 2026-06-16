/*
 * Seeder de datos ficticios para el widget "Tu ritmo" (desarrollo).
 *
 * USO:
 *   1. Abre la PÁGINA DE OPCIONES de la extensión (el dashboard).
 *   2. Abre la consola del navegador (F12 → Console).
 *   3. Pega TODO este archivo y pulsa Enter.
 *   4. Recarga la página (F5). Verás el reloj, "Dónde", día y semana con datos.
 *
 * BORRAR (volver a datos reales / vacío):
 *   chrome.storage.local.remove('mvp-rhythm-stats'); // y recarga
 *
 * Nota: sobrescribe tus datos reales de ritmo (que de momento son pocos segundos).
 * El tracking real sigue funcionando con normalidad después de borrarlo.
 */
(async () => {
	const S = typeof browser !== 'undefined' && browser.storage ? browser : chrome
	const rnd = (a, b) => Math.floor(a + Math.random() * (b - a))
	const pad = n => String(n).padStart(2, '0')

	// Minutos aprox. por hora del día (patrón diurno) → ms
	const hourMin = [2, 1, 0, 0, 0, 1, 4, 9, 15, 22, 28, 33, 42, 38, 30, 26, 24, 29, 36, 31, 21, 12, 6, 3]
	const hours = hourMin.map(m => m * 60000 + rnd(0, 59) * 1000)

	// Minutos por día de la semana (0=Dom … 6=Sáb) → ms
	const weekdays = [40, 95, 70, 88, 130, 112, 52].map(m => m * 60000)

	// Subforos por hora (slugs reales de lib/subforums)
	const pool = [
		'off-topic', 'deportes', 'cine', 'dev', 'ia', 'juegos', 'politica', 'musica',
		'tv', 'motor', 'criptomonedas', 'pokemon', 'diablo', 'anime-manga', 'fitness', 'wow',
	]
	const hourSubforums = {}
	hours.forEach((ms, h) => {
		if (ms < 20000) return
		const picks = [...pool].sort(() => Math.random() - 0.5).slice(0, rnd(2, 9))
		let left = ms
		const obj = {}
		picks.forEach((slug, i) => {
			const part = i === picks.length - 1 ? left : Math.max(1000, Math.floor(left * (0.25 + Math.random() * 0.35)))
			obj[slug] = part
			left -= part
		})
		hourSubforums[String(h)] = obj // claves '0'..'23' (sin padding, como en el código)
	})

	// Últimas 52 semanas (clave = lunes 'YYYY-MM-DD') → ms
	const now = new Date()
	const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
	monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
	const weeks = {}
	for (let i = 0; i < 52; i++) {
		const d = new Date(monday)
		d.setDate(monday.getDate() - i * 7)
		weeks[`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`] = rnd(3, 200) * 60000
	}

	await S.storage.local.set({ 'mvp-rhythm-stats': { hours, weekdays, weeks, hourSubforums } })
	console.log('✅ "Tu ritmo" sembrado con datos ficticios. Recarga la página (F5).')
})()
