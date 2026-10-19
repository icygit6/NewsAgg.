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
    expect(screen.getByRole('img', { name: 'No photo from the publisher' })).toBeInTheDocument()
  })
  it('recovers when a different article image replaces a failed source', () => {
    const { rerender } = render(<ImageWithFallback src="https://example.com/old.jpg" alt="old" />)
    fireEvent.error(screen.getByAltText('old'))
    rerender(<ImageWithFallback src="https://example.com/new.jpg" alt="new" />)
    expect(screen.getByAltText('new')).toHaveAttribute('src', 'https://example.com/new.jpg')
    expect(screen.queryByRole('img', { name: 'No photo from the publisher' })).not.toBeInTheDocument()
  })
  it('retries the original Yahoo asset before using an article alternative', () => {
    const original = 'https://media.zenfs.com/en/news/photo.jpg';
    const resized = `https://s.yimg.com/lo/mysterio/api/hash/resize/${encodeURIComponent(original)}`;
    render(<ImageWithFallback src={resized} fallbackSources={['https://example.com/second.jpg']} alt="story" />);
    fireEvent.error(screen.getByAltText('story'));
    expect(screen.getByAltText('story')).toHaveAttribute('src', original);
    fireEvent.error(screen.getByAltText('story'));
    expect(screen.getByAltText('story')).toHaveAttribute('src', 'https://example.com/second.jpg');
    fireEvent.error(screen.getByAltText('story'));
    expect(screen.getByRole('img', { name: 'No photo from the publisher' })).toBeInTheDocument();
  });
  it('uses a verified alternative when the primary source is empty', () => {
    render(<ImageWithFallback fallbackSources={['https://example.com/second.jpg']} alt="story" />);
    expect(screen.getByAltText('story')).toHaveAttribute('src', 'https://example.com/second.jpg');
  });
})
