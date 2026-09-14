import { describe, it, expect } from 'vitest'
import { normalizeBaseUrl, buildUrl } from '@/api/client'

describe('api client helpers', () => {
  it('normalises base urls', () => {
    expect(normalizeBaseUrl(' 192.168.1.2:8000/ ')).toBe('http://192.168.1.2:8000')
    expect(normalizeBaseUrl('https://x.dev///')).toBe('https://x.dev')
    expect(normalizeBaseUrl('')).toBe('')
  })
  it('builds urls with params and skips empties', () => {
    expect(buildUrl('/tracks/1/stream', { token: 'abc', format: undefined }, 'http://h')).toBe('http://h/tracks/1/stream?token=abc')
    expect(buildUrl('http://other/x', { a: 1 }, 'http://h')).toBe('http://other/x?a=1')
  })
})
