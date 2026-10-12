import { describe, expect, test } from 'claude-code/testing'

import { ember, isEnhanceable } from '../hooks/register'

describe('isEnhanceable', () => {
  test('needs two words and ten characters after trimming', async () => {
    for (const text of ['', '   ', 'A', 'refactor', '  refactorings  ', '\nfix\n', 'fix it', '  fix   it  ', 'fix\tbug']) {
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
const GRAYS = Array.from({ length: 24 }, (_, i) => 8 + 10 * i)
const rgb = (hex = '') => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16))
// Long enough to hold a whole cycle and its wrap back to red
const TEXT = 'x'.repeat(64)

describe('ember', () => {
  test('paints every background and moves one step per frame', async () => {
    const first = ember(TEXT, 0)
    const next = ember(TEXT, 1)
    expect(first.length).toBe(TEXT.length)
    for (let i = 1; i < first.length; i++) {
      expect(next[i]?.backgroundColor).toBe(first[i - 1]?.backgroundColor)
      expect(next[i]?.color).toBe(first[i - 1]?.color)
    }
  })

  test('uses only xterm 256-color cube and gray ramp entries', async () => {
    for (const [r = -1, g = -1, b = -1] of ember(TEXT, 0).map(d => rgb(d.backgroundColor))) {
      const isCube = [r, g, b].every(v => LEVELS.includes(v))
      const isGray = r === g && g === b && GRAYS.includes(r)
      expect(isCube || isGray).toBe(true)
    }
  })

  test('keeps the text readable on every background', async () => {
    for (const d of ember(TEXT, 0)) {
      expect(contrast(d.color ?? '', d.backgroundColor ?? '')).toBeGreaterThanOrEqual(4.5)
    }
  })
})
