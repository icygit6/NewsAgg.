import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ImageWithFallback } from './ImageWithFallback'

describe('ImageWithFallback', () => {
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
    expect(screen.getByAltText('Error loading image')).toBeInTheDocument()
  })
})
