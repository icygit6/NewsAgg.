export interface Bookmark {
  id: number;
  article_id: string;
  article_title: string | null;
  article_url: string | null;
  url_to_image: string | null;
  source_name: string | null;
  topic: string | null;
  collection_name: string;
  notes: string | null;
  is_read: boolean;
  archived: boolean;
  created_at: string;
}
