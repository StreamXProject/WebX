import { describe, it, expect } from 'vitest'
import { md5 } from '@/lib/md5'

describe('md5', () => {
  it('matches RFC 1321 vectors', () => {
    expect(md5('')).toBe('d41d8cd98f00b204e9800998ecf8427e')
    expect(md5('abc')).toBe('900150983cd24fb0d6963f7d28e17f72')
    expect(md5('The quick brown fox jumps over the lazy dog')).toBe('9e107d9d372bb6826bd81d3542a419d6')
  })
  it('handles multi-block and utf-8 input', () => {
    expect(md5('a'.repeat(1000))).toBe('cabe45dcc9ae5b66ba86600cca6b8ba8')
    expect(md5('héllo wörld ✓')).toBe('aa0c8a307a4488bfe0cb56530da19bc3')
  })
})
