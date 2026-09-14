import { describe, it, expect } from 'vitest'
import { ThemeDefinitionSchema } from '@/theme/tokens'
import { resolveTheme } from '@/theme/scheme'
import { getBuiltInThemes, parseThemeJson, exportThemeJson } from '@/theme/registry'

describe('theme engine', () => {
  it('discovers built-in themes with WebX first', () => {
    const themes = getBuiltInThemes()
    expect(themes.length).toBeGreaterThanOrEqual(5)
    expect(themes[0].id).toBe('webx-crimson')
    expect(new Set(themes.map((t) => t.id)).size).toBe(themes.length)
  })

  it('resolves a full MD3 scheme for light and dark', () => {
    const t = getBuiltInThemes()[0]
    const r = resolveTheme(t)
    for (const role of ['primary', 'onPrimary', 'surface', 'onSurface', 'surfaceContainerHighest', 'outlineVariant'] as const) {
      expect(r.dark[role]).toMatch(/^#[0-9A-F]{6}$/)
      expect(r.light[role]).toMatch(/^#[0-9A-F]{6}$/)
    }
    expect(r.dark.surface).not.toBe(r.light.surface)
  })

  it('honours pureBlack and overrides', () => {
    const t = ThemeDefinitionSchema.parse({
      id: 'x',
      name: 'X',
      seed: '#123456',
      typography: { body: 'sans-serif' },
      effects: { glass: false, ambientBackdrop: false, pureBlack: true, tonalElevation: false },
      overrides: { dark: { primary: '#ABCDEF' } },
    })
    const r = resolveTheme(t)
    expect(r.dark.surface).toBe('#000000')
    expect(r.dark.primary).toBe('#ABCDEF')
  })

  it('round-trips JSON import/export and rejects bad input', () => {
    const t = getBuiltInThemes()[1]
    const json = exportThemeJson(t)
    const back = parseThemeJson(json)
    expect(back.id).toBe(t.id)
    expect(back.builtIn).toBe(false)
    expect(() => parseThemeJson('{"id":"bad id","name":"","seed":"red"}')).toThrow(/Invalid theme/)
  })
})
