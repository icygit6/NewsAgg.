import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { ImageWithFallback } from './ImageWithFallback'

describe('ImageWithFallback', () => {
  afterEach(cleanup)
  it('renders the provided image source', () => {
    render(<ImageWithFallback src="https://example.com/photo.jpg" alt="a photo" />)
    const img = screen.getByAltText('a photo') as HTMLImageElement
    expect(img).toBeInTheDocument()
    expect(img.src).toContain('example.com/photo.jpg')
  })

  it('swaps to the fallback graphic when the image fails to load', () => {
    render(<ImageWithFallback src="https://broken.invalid/x.jpg" alt="broken" />)
    fireEvent.error(screen.getByAltText('broken'))
    // The original alt is gone; the fallback placeholder is shown instead.
    expect(screen.queryByAltText('broken')).not.toBeInTheDocument()
    expect(screen.getByAltText('Image unavailable')).toBeInTheDocument()
  })
  it('recovers when a different article image replaces a failed source', () => {
    const { rerender } = render(<ImageWithFallback src="https://example.com/old.jpg" alt="old" />)
    fireEvent.error(screen.getByAltText('old'))
    rerender(<ImageWithFallback src="https://example.com/new.jpg" alt="new" />)
    expect(screen.getByAltText('new')).toHaveAttribute('src', 'https://example.com/new.jpg')
    expect(screen.queryByAltText('Image unavailable')).not.toBeInTheDocument()
  })
})
