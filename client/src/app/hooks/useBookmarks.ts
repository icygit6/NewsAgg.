import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApp } from '../contexts/AppContext';
import { apiFetch } from '../lib/apiFetch';
import type { Bookmark } from '../services/bookmarkService';
import type { NewsArticle } from '../types/article';
import { getArticleId } from '../services/newsAPI';

type IdRow = Pick<Bookmark, 'id' | 'article_id'>;
type Filters = { search?: string; collection?: string; source?: string; topic?: string; status?: string };
const unwrap = <T,>(json: { success: boolean; data?: T; error?: string }): T => {
  if (!json.success || json.data === undefined) throw new Error(json.error || 'Request failed');
  return json.data;
};

export function useBookmarks() {
  const { user, isAuthenticated } = useApp();
  const qc = useQueryClient();
  const key = ['bookmark-ids', user?.id ?? null];
  const ids = useQuery({ queryKey: key, queryFn: async () => unwrap(await apiFetch<{success:boolean;data?:IdRow[];error?:string}>('/api/bookmarks/ids')), enabled: isAuthenticated, staleTime: 60_000 });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['bookmark-list'] }); qc.invalidateQueries({ queryKey: ['bookmark-meta'] }); };
  const add = useMutation({
    mutationFn: async (article: NewsArticle): Promise<Bookmark> => unwrap<Bookmark>(await apiFetch<any>('/api/bookmarks', { method:'POST', body:JSON.stringify({ articleId:getArticleId(article), articleTitle:article.title, articleUrl:article.url, urlToImage:article.urlToImage || '', sourceName:article.source.name, topic:article.topic }) })),
    onSuccess: (b: Bookmark) => { qc.setQueryData<IdRow[]>(key, (old=[]) => [{id:b.id,article_id:b.article_id}, ...old.filter(x=>x.article_id!==b.article_id)]); refresh(); },
  });
  const remove = useMutation({
    mutationFn: async (bookmarkId:number) => { await apiFetch(`/api/bookmarks/${bookmarkId}`, {method:'DELETE'}); return bookmarkId; },
    onSuccess: (bookmarkId) => { qc.setQueryData<IdRow[]>(key, (old=[])=>old.filter(x=>x.id!==bookmarkId)); refresh(); },
  });
  const rows = ids.data ?? [];
  return { bookmarks: rows, isLoading:ids.isLoading, isError:ids.isError, add, remove, isBookmarked:(articleId:string)=>rows.some(b=>b.article_id===articleId), bookmarkIdFor:(articleId:string)=>rows.find(b=>b.article_id===articleId)?.id ?? null };
}

export function useBookmarkList(filters: Filters = {}) {
  const sp = new URLSearchParams();
  Object.entries(filters).forEach(([k,v]) => { if(v) sp.set(k,v); });
  return useInfiniteQuery({
    queryKey:['bookmark-list',filters], initialPageParam:'',
    queryFn:async ({pageParam}) => { const q=new URLSearchParams(sp); if(pageParam) q.set('cursor',pageParam); return unwrap(await apiFetch<any>(`/api/bookmarks?${q}`)); },
    getNextPageParam:(last:any)=>last.nextCursor || undefined,
  });
}

export function useBookmarkMeta(enabled=true) {
  return useQuery<{total:number;collections:string[];sources:string[];topics:string[]}>({ queryKey:['bookmark-meta'], queryFn:async()=>unwrap(await apiFetch<any>('/api/bookmarks/meta')), enabled });
}

export function useBookmarkActions() {
  const qc=useQueryClient(); const refresh=()=>{qc.invalidateQueries({queryKey:['bookmark-list']});qc.invalidateQueries({queryKey:['bookmark-meta']});qc.invalidateQueries({queryKey:['bookmark-ids']});};
  const update=useMutation({mutationFn:async({id,...body}:{id:number;collectionName?:string;notes?:string|null;isRead?:boolean;archived?:boolean})=>unwrap(await apiFetch<any>(`/api/bookmarks/${id}`,{method:'PATCH',body:JSON.stringify(body)})),onSuccess:refresh});
  const remove=useMutation({mutationFn:async(id:number)=>{await apiFetch(`/api/bookmarks/${id}`,{method:'DELETE'});return id;},onSuccess:refresh});
  const restore=useMutation({mutationFn:async(id:number)=>apiFetch(`/api/bookmarks/${id}/restore`,{method:'POST'}),onSuccess:refresh});
  return {update,remove,restore};
}
