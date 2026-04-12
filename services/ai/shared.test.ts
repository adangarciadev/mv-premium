import { describe, it, expect } from 'vitest'
import { parseAIJsonResponse, repairJson } from './shared'

describe('repairJson', () => {
	it('should remove trailing commas before ]', () => {
		const input = '{"items": ["a", "b",]}'
		expect(JSON.parse(repairJson(input))).toEqual({ items: ['a', 'b'] })
	})

	it('should remove trailing commas before }', () => {
		const input = '{"a": 1, "b": 2,}'
		expect(JSON.parse(repairJson(input))).toEqual({ a: 1, b: 2 })
	})

	it('should fix missing commas between string array elements', () => {
		const input = `{"keyPoints": [
    "Punto clave 1"
    "Punto clave 2"
    "Punto clave 3"
  ]}`
		const parsed = JSON.parse(repairJson(input))
		expect(parsed.keyPoints).toEqual(['Punto clave 1', 'Punto clave 2', 'Punto clave 3'])
	})

	it('should fix missing commas between objects in array', () => {
		const input = `{"participants": [
    {"name": "User1", "contribution": "Did stuff"}
    {"name": "User2", "contribution": "Did more"}
  ]}`
		const parsed = JSON.parse(repairJson(input))
		expect(parsed.participants).toHaveLength(2)
		expect(parsed.participants[0].name).toBe('User1')
		expect(parsed.participants[1].name).toBe('User2')
	})

	it('should fix missing comma after value before next key', () => {
		const input = `{"topic": "Something"
  "status": "Active"}`
		const parsed = JSON.parse(repairJson(input))
		expect(parsed.topic).toBe('Something')
		expect(parsed.status).toBe('Active')
	})

	it('should handle already valid JSON', () => {
		const input = '{"a": 1, "b": [2, 3]}'
		expect(JSON.parse(repairJson(input))).toEqual({ a: 1, b: [2, 3] })
	})

	it('should handle combined issues', () => {
		const input = `{
  "topic": "Test topic"
  "keyPoints": [
    "Point 1"
    "Point 2",
  ],
  "participants": [
    {"name": "A", "contribution": "B"}
    {"name": "C", "contribution": "D"},
  ],
  "status": "Done",
}`
		const parsed = JSON.parse(repairJson(input))
		expect(parsed.topic).toBe('Test topic')
		expect(parsed.keyPoints).toHaveLength(2)
		expect(parsed.participants).toHaveLength(2)
		expect(parsed.status).toBe('Done')
	})
})

describe('parseAIJsonResponse', () => {
	it('should parse valid JSON', () => {
		const result = parseAIJsonResponse<{ a: number }>('{"a": 1}')
		expect(result).toEqual({ a: 1 })
	})

	it('should strip markdown code blocks', () => {
		const result = parseAIJsonResponse<{ a: number }>('```json\n{"a": 1}\n```')
		expect(result).toEqual({ a: 1 })
	})

	it('should find JSON in surrounding text', () => {
		const result = parseAIJsonResponse<{ a: number }>('Here is the result: {"a": 1} hope that helps!')
		expect(result).toEqual({ a: 1 })
	})

	it('should throw on missing JSON', () => {
		expect(() => parseAIJsonResponse('no json here')).toThrow('No JSON object found')
	})

	it('should repair and parse malformed LLM JSON', () => {
		const malformed = `{
  "topic": "Resumen del hilo sobre videojuegos"
  "keyPoints": [
    "Punto sobre gráficos"
    "Punto sobre gameplay",
  ]
  "participants": [
    {"name": "User1", "contribution": "Opinó sobre X"}
    {"name": "User2", "contribution": "Respondió Y"}
  ]
  "status": "Debate activo",
}`
		const result = parseAIJsonResponse<{
			topic: string
			keyPoints: string[]
			participants: { name: string; contribution: string }[]
			status: string
		}>(malformed)

		expect(result.topic).toBe('Resumen del hilo sobre videojuegos')
		expect(result.keyPoints).toHaveLength(2)
		expect(result.participants).toHaveLength(2)
		expect(result.status).toBe('Debate activo')
	})

	it('should handle missing commas in keyPoints arrays', () => {
		// Simulates the actual error: long keyPoints entries without commas
		const malformed = `{
  "topic": "Análisis de la última actualización del juego",
  "keyPoints": [
    "La actualización trajo cambios significativos en el balance de personajes, con varios usuarios debatiendo si los cambios fueron positivos o negativos para la experiencia general del juego"
    "Varios participantes compartieron sus experiencias con los nuevos mapas, destacando problemas de rendimiento en hardware de gama media que afectan la jugabilidad competitiva"
    "Se discutió ampliamente sobre el nuevo sistema de progresión, con opiniones divididas entre quienes prefieren el modelo anterior y los que ven mejoras en la monetización actual del juego"
  ],
  "participants": [
    {"name": "GameMaster99", "contribution": "Aportó análisis detallado de los cambios de balance (15 votos)"}
    {"name": "ProGamer", "contribution": "Compartió benchmarks de rendimiento en diferentes configuraciones"}
  ],
  "status": "Debate activo con posiciones encontradas sobre la dirección del juego"
}`
		const result = parseAIJsonResponse<{
			topic: string
			keyPoints: string[]
			participants: { name: string; contribution: string }[]
			status: string
		}>(malformed)

		expect(result.keyPoints).toHaveLength(3)
		expect(result.participants).toHaveLength(2)
	})

	it('should handle literal newlines inside string values', () => {
		// Real-world malformed responses can contain literal \n that break JSON
		const malformed = `{
  "topic": "Elecciones autonómicas en Aragón con victoria del PP",
  "keyPoints": [
    "El PP gana con 28 escaños pero pierde 2 respecto a 2019; ne\ncesitará pactar con Vox (14 escaños) que necesitará pactar"
    "El PSOE marca un mínimo histórico (18 escaños) y Podemos desa\nparece del parlamento"
  ],
  "participants": [
    {"name": "User1", "contribution": "Análisis del pacto PP-Vox"}
  ],
  "status": "Debate intenso"
}`
		const result = parseAIJsonResponse<{
			topic: string
			keyPoints: string[]
			participants: { name: string; contribution: string }[]
			status: string
		}>(malformed)

		expect(result.topic).toContain('Elecciones')
		expect(result.keyPoints).toHaveLength(2)
		expect(result.keyPoints[0]).toContain('necesitará pactar')
		expect(result.keyPoints[1]).toContain('parece del parlamento')
	})

	it('should handle semicolons followed by newlines inside strings', () => {
		const malformed = `{
  "keyPoints": [
    "Punto A; con\ncontinuación del texto aquí"
    "Punto B normal"
  ]
}`
		const result = parseAIJsonResponse<{ keyPoints: string[] }>(malformed)
		expect(result.keyPoints).toHaveLength(2)
		expect(result.keyPoints[0]).toContain('continuación')
	})

	it('should handle same-line missing commas between array elements (no newline)', () => {
		// Some model responses put elements on the same line without commas
		const malformed = '{"items": ["first element" "second element" "third"]}'
		const result = parseAIJsonResponse<{ items: string[] }>(malformed)
		expect(result.items).toHaveLength(3)
	})

	it('should handle many missing commas via iterative repair', () => {
		// Simulates a response with 5+ missing commas across different positions
		const malformed = `{
  "topic": "Tema del hilo"
  "keyPoints": [
    "Punto 1 con texto largo sobre algo importante"
    "Punto 2 sobre otro tema relevante"
    "Punto 3 con más información"
    "Punto 4 final"
  ]
  "participants": [
    {"name": "User1", "contribution": "Aportó X"}
    {"name": "User2", "contribution": "Aportó Y"}
    {"name": "User3", "contribution": "Aportó Z"}
  ]
  "status": "Debate activo"
}`
		const result = parseAIJsonResponse<{
			topic: string
			keyPoints: string[]
			participants: { name: string; contribution: string }[]
			status: string
		}>(malformed)

		expect(result.topic).toBe('Tema del hilo')
		expect(result.keyPoints).toHaveLength(4)
		expect(result.participants).toHaveLength(3)
		expect(result.status).toBe('Debate activo')
	})

	it('should handle a real malformed Aragon elections pattern', () => {
		// Based on the actual error: long topic, complex content with commas in strings
		const malformed = `{
  "topic": "Análisis de las elecciones autonómicas en Aragón donde el PP logra 28 escaños tras 20 años sin ganar, Vox entra por primera vez en el gobierno con 7 escaños, el PSOE cae a su peor resultado histórico (23-18 escaños), Podemos desaparece del parlamento y Sumar apenas mantiene 1 escaño."
  "keyPoints": [
    "El PP de Azcón logra la victoria con 28 escaños y necesita a Vox (7 escaños) para gobernar, formando el primer gobierno de coalición PP-Vox en la comunidad"
    "El PSOE de Lambán sufre una derrota histórica pasando de 24 a 18 escaños, su peor resultado en democracia, mientras Podemos desaparece completamente del parlamento aragonés"
    "CHA obtiene 3 escaños y Sumar (IU+Más País) apenas mantiene 1 escaño, confirmando el giro a la derecha del electorado aragonés"
  ]
  "participants": [
    {"name": "PoliticFan", "contribution": "Aportó datos electorales detallados y comparativas históricas (15 votos)"}
    {"name": "AragonVota", "contribution": "Analizó los pactos postelectorales y sus implicaciones"}
  ]
  "status": "Debate cerrado con consenso sobre la victoria del PP y el hundimiento de la izquierda en Aragón"
}`
		const result = parseAIJsonResponse<{
			topic: string
			keyPoints: string[]
			participants: { name: string; contribution: string }[]
			status: string
		}>(malformed)

		expect(result.topic).toContain('Aragón')
		expect(result.keyPoints).toHaveLength(3)
		expect(result.participants).toHaveLength(2)
		expect(result.status).toContain('Debate cerrado')
	})
})
