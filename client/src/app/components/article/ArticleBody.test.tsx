import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ArticleBody } from './ArticleBody';
import type { NewsArticle } from '../../types/article';
afterEach(cleanup);
describe('structured article reader', () => {
  it('does not repeat resized BBC hero images in the gallery', () => {
    const article = {title:'BBC story',urlToImage:'https://ichef.bbci.co.uk/news/1024/cpsprodpb/abc/photo.jpg',images:[{url:'https://ichef.bbci.co.uk/ace/standard/976/cpsprodpb/abc/photo.jpg'}],content:'Article'} as unknown as NewsArticle;
    render(<ArticleBody article={article} isDark={false} />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
  it('labels unverified archived extractions', () => {
    render(<ArticleBody article={{images:[],qualityVerified:false,content:'Archived text'} as unknown as NewsArticle} isDark={false} />);
    expect(screen.getByRole('note')).toHaveTextContent('Archived extraction');
  });
  it('renders semantic blocks without duplicating the header image', () => {
    const article = {title:'Test story', images:[], urlToImage:'https://example.com/hero.jpg', content:'fallback', contentBlocks:[{type:'heading',text:'Results'},{type:'paragraph',text:'Evidence from the publisher.'},{type:'list',items:['Finding one','Finding two']}]} as unknown as NewsArticle;
    render(<ArticleBody article={article} isDark={false} />);
    expect(screen.getByRole('heading', {name:'Results'})).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.queryByAltText('Test story')).not.toBeInTheDocument();
    expect(screen.queryByText('fallback')).not.toBeInTheDocument();
  });
  it('renders untrusted publisher text as text, never HTML', () => {
    const article = {images:[],contentBlocks:[{type:'paragraph',text:'<script>bad()</script>'}]} as unknown as NewsArticle;
    const {container} = render(<ArticleBody article={article} isDark={false} />);
    expect(container.querySelector('script')).toBeNull();
    expect(screen.getByText('<script>bad()</script>')).toBeInTheDocument();
  });
});
