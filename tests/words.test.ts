import { describe, expect, test } from 'claude-code/testing'

import { isEnhanceable, rainbow } from '../hooks/register'

describe('isEnhanceable', () => {
  test('needs two words and ten characters after trimming', async () => {
    for (const text of ['', '   ', 'refactor', '  refactorings  ', '\nfix\n', 'fix it', '  fix   it  ', 'fix\tbug']) {
      expect(isEnhanceable(text)).toBe(false)
    }
    for (const text of ['fix the bug', '  fix   the bug  ', 'fix\nthis now', 'fix\tthe bug now']) {
      expect(isEnhanceable(text)).toBe(true)
    }
  })
})

// WCAG contrast ratio between two #rrggbb colors
const contrast = (a: string, b: string) => {
  const luminance = (hex: string) => {
    const [r = 0, g = 0, bl = 0] = [1, 3, 5].map(i => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl
  }
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05)
}

const LEVELS = [0, 95, 135, 175, 215, 255]
const rgb = (hex = '') => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16))
// Long enough to hold a whole cycle and its wrap back to red
const TEXT = 'x'.repeat(64)

describe('rainbow', () => {
  test('paints every background and moves one step per frame', async () => {
    const first = rainbow(TEXT, 0)
    const next = rainbow(TEXT, 1)
    expect(first.length).toBe(TEXT.length)
    for (let i = 1; i < first.length; i++) {
      expect(next[i]?.backgroundColor).toBe(first[i - 1]?.backgroundColor)
      expect(next[i]?.color).toBe(first[i - 1]?.color)
    }
  })

  test('blends neighbors one 256-color cube level at a time', async () => {
    const bands = rainbow(TEXT, 0).map(d => rgb(d.backgroundColor))
    expect(bands.flat().every(v => LEVELS.includes(v))).toBe(true)
    // Exactly one channel moves, by one level, between any two neighbors
    const steps = (a: number[], b: number[]) =>
      a.map((v, c) => Math.abs(LEVELS.indexOf(v) - LEVELS.indexOf(b[c] ?? -1))).sort()
    bands.slice(1).forEach((b, i) => expect(steps(bands[i] ?? [], b)).toEqual([0, 0, 1]))
  })

  test('keeps the text readable on every background', async () => {
    for (const d of rainbow(TEXT, 0)) {
      expect(contrast(d.color ?? '', d.backgroundColor ?? '')).toBeGreaterThanOrEqual(4.5)
    }
  })
})
