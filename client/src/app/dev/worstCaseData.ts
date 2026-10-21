import type { PostItem, PostsPage } from '../hooks/usePosts';
import type { DataMode } from './dataMode';

/** Dev-only stress fixtures for the posts feed (?data=worst|empty|one|many).
 *
 * Every value here is either a realistic shape or the exact limit the server
 * accepts, so a break found with this data is a break that can reach
 * production: username 30 (validate.ts:28), displayName 60 (validate.ts:176),
 * post content 280 (validate.ts:136). Article titles come from publishers and
 * are bounded by nothing at all. */

const HOUR = 3_600_000;
const ago = (hours: number) => new Date(Date.now() - hours * HOUR).toISOString();

const base: PostItem = {
  id: 1, content: '', category: 'General', created_at: ago(2), updated_at: null,
  article_id: null, user_id: 901, username: 'reader', display_name: null, avatar: null,
  article_title: null, article_image: null, article_topic: null, source_name: null,
  like_count: 0, comment_count: 0, liked_by_me: false,
};

// Failures are spread across rows rather than stacked on row 1, the way real
// data arrives — the first rows are what is actually on screen.
export const WORST_CASE_POSTS: PostItem[] = [
  {
    ...base, id: 9001, user_id: 9001,
    // Both fields exactly at their server cap.
    username: 'maria.jose.fernandez.delacruz',
    display_name: 'María José Fernández de la Cruz y Santa María Pilar',
    content: 'Long handle and long display name at the schema cap, with no spaces in the handle to break on.',
    like_count: 1, comment_count: 1, created_at: ago(1),
  },
  {
    ...base, id: 9002, user_id: 9002,
    username: 'jo', display_name: 'Jo',
    // A URL that 404s: exercises the avatar's error path.
    avatar: 'https://example.invalid/this-avatar-will-never-load.png',
    content: 'Two-letter name, and an avatar URL that fails to load.',
    created_at: ago(0.2),
  },
  {
    ...base, id: 9003, user_id: 9003,
    username: 'taipei_desk', display_name: '台北新聞編輯部國際組',
    content: '中文貼文：這是一段沒有空格可以斷行的長文字，用來測試版面在無法斷詞的情況下會不會被撐破，以及行高是否足夠容納中文字形。',
    article_id: 'demo-article',
    article_title: '矽晶圓行情慘淡！「這指標股」已連跌4日累跌17%、台勝科、合晶、環球晶圓同步走弱，分析師示警下半年恐再探底',
    article_topic: 'Business', source_name: 'Yahoo TW',
    article_image: 'https://example.invalid/broken-thumbnail.jpg',
    like_count: 1284, comment_count: 342, created_at: ago(26),
  },
  {
    ...base, id: 9004, user_id: 9004,
    username: 'emoji_first', display_name: '🎉 Party Planner',
    content: 'Emoji-first display name, an unbreakable link, and content at the 280 cap. https://news.example.com/2026/10/21/an-extremely-long-canonical-article-slug-that-has-no-break-opportunities-at-all?utm_source=newsagg&utm_campaign=share — padding to the limit so the box is full.',
    like_count: 1, comment_count: 1, created_at: ago(5),
  },
  {
    ...base, id: 9005, user_id: 9005,
    username: 'stats_bot', display_name: null,
    content: 'Missing display name, counts past a thousand separator, and an edited marker.',
    like_count: 1_284_903, comment_count: 10_472,
    updated_at: ago(0.5), created_at: ago(70),
  },
  {
    ...base, id: 9006, user_id: 9006,
    username: 'clock_skew', display_name: 'Clock Skew',
    // A client whose clock is behind the server produces a future timestamp.
    content: 'Created in the future, as a client with a skewed clock reports it.',
    created_at: new Date(Date.now() + 3 * HOUR).toISOString(),
    category: undefined,
  },
];

const ONE_POST: PostItem[] = [{ ...base, id: 9101, content: 'Exactly one post, and every count at one.', like_count: 1, comment_count: 1 }];

const manyPosts = (): PostItem[] => Array.from({ length: 1000 }, (_, i) => ({
  ...base, id: 20_000 + i, user_id: 20_000 + i,
  username: `reader_${i}`, display_name: `Reader ${i}`,
  content: `Row ${i + 1} of an unpaginated thousand.`, created_at: ago(i / 10),
}));

const FIXTURES: Record<Exclude<DataMode, 'demo'>, () => PostItem[]> = {
  worst: () => WORST_CASE_POSTS, empty: () => [], one: () => ONE_POST, many: manyPosts,
};

export function worstCasePostsPage(mode: Exclude<DataMode, 'demo'>): PostsPage {
  return { posts: FIXTURES[mode](), nextCursor: null };
}
