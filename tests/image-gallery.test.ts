import { getImageGridPresentation } from '../utils/image-gallery'
import { describe, expect, it } from 'vitest'

describe('chat image gallery presentation', () => {
  it('renders at most four tiles and reports the hidden remainder', () => {
    expect(getImageGridPresentation(2)).toEqual({ tileCount: 2, hiddenCount: 0, layout: 'pair' })
    expect(getImageGridPresentation(3)).toEqual({ tileCount: 3, hiddenCount: 0, layout: 'trio' })
    expect(getImageGridPresentation(4)).toEqual({ tileCount: 4, hiddenCount: 0, layout: 'quad' })
    expect(getImageGridPresentation(16)).toEqual({
      tileCount: 4,
      hiddenCount: 12,
      layout: 'quad'
    })
  })
})
