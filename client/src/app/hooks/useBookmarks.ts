import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApp } from '../contexts/AppContext';
import { apiFetch } from '../lib/apiFetch';
import type { Bookmark } from '../services/bookmarkService';
import type { NewsArticle } from '../types/article';
import { getArticleId } from '../services/newsAPI';
import { toast } from 'sonner';
import { useUiText } from '../i18n/uiText';

type IdRow = Pick<Bookmark, 'id' | 'article_id'>;
type Filters = { search?: string; collection?: string; source?: string; topic?: string; status?: string; sources?: string; categories?: string; sentiments?: string; sort?: string };
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
  // Every bookmark change is confirmed with a toast that can undo it.
  const ui = useUiText();
  const undoAdd = async (b: Bookmark) => {
    await apiFetch(`/api/bookmarks/${b.id}`, { method: 'DELETE' });
    qc.setQueryData<IdRow[]>(key, (old = []) => old.filter((x) => x.id !== b.id)); refresh();
  };
  const undoRemove = async (bookmarkId: number) => {
    await apiFetch(`/api/bookmarks/${bookmarkId}/restore`, { method: 'POST' });
    void qc.invalidateQueries({ queryKey: key }); refresh();
  };
  const add = useMutation({
    mutationFn: async (article: NewsArticle): Promise<Bookmark> => unwrap<Bookmark>(await apiFetch<any>('/api/bookmarks', { method:'POST', body:JSON.stringify({ articleId:getArticleId(article), articleTitle:article.title, articleUrl:article.url, urlToImage:article.urlToImage || '', sourceName:article.source.name, topic:article.topic }) })),
    onSuccess: (b: Bookmark) => { qc.setQueryData<IdRow[]>(key, (old=[]) => [{id:b.id,article_id:b.article_id}, ...old.filter(x=>x.article_id!==b.article_id)]); refresh();
      toast.success(ui('Saved to bookmarks'), { action: { label: ui('Undo'), onClick: () => { void undoAdd(b); } } }); },
  });
  const remove = useMutation({
    mutationFn: async (bookmarkId:number) => { await apiFetch(`/api/bookmarks/${bookmarkId}`, {method:'DELETE'}); return bookmarkId; },
    onSuccess: (bookmarkId) => { qc.setQueryData<IdRow[]>(key, (old=[])=>old.filter(x=>x.id!==bookmarkId)); refresh();
      toast(ui('Removed from bookmarks'), { action: { label: ui('Undo'), onClick: () => { void undoRemove(bookmarkId); } } }); },
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

export type BookmarkMeta = { total:number; unread:number; read:number; archived:number; collections:string[]; presets:string[]; collection_counts:Record<string,number>; sources:string[]; topics:string[] };

export function useBookmarkMeta(enabled=true) {
  return useQuery<BookmarkMeta>({ queryKey:['bookmark-meta'], queryFn:async()=>unwrap(await apiFetch<any>('/api/bookmarks/meta')), enabled });
}

type BookmarkUpdate = { id:number; collectionName?:string; notes?:string|null; isRead?:boolean; archived?:boolean };
type ListPages = { pages: { bookmarks: Bookmark[]; nextCursor: string|null }[]; pageParams: unknown[] };

export function useBookmarkActions() {
  const qc=useQueryClient(); const ui=useUiText();
  const refresh=()=>{qc.invalidateQueries({queryKey:['bookmark-list']});qc.invalidateQueries({queryKey:['bookmark-meta']});qc.invalidateQueries({queryKey:['bookmark-ids']});};
  const patch=async({id,...body}:BookmarkUpdate)=>unwrap<Bookmark>(await apiFetch<any>(`/api/bookmarks/${id}`,{method:'PATCH',body:JSON.stringify(body)}));
  // Status flips show on the card at once; the refetch afterwards moves the
  // card out of a status filter it no longer matches.
  const update=useMutation({
    mutationFn:patch,
    onMutate:async(change)=>{
      await qc.cancelQueries({queryKey:['bookmark-list']});
      const before=qc.getQueriesData<ListPages>({queryKey:['bookmark-list']});
      const fields:Partial<Bookmark>={...(change.collectionName!==undefined&&{collection_name:change.collectionName}),...(change.isRead!==undefined&&{is_read:change.isRead}),...(change.archived!==undefined&&{archived:change.archived}),...(change.notes!==undefined&&{notes:change.notes})};
      qc.setQueriesData<ListPages>({queryKey:['bookmark-list']},(old)=>old&&{...old,pages:old.pages.map(p=>({...p,bookmarks:p.bookmarks.map(b=>b.id===change.id?{...b,...fields}:b)}))});
      return {before};
    },
    onError:(_e,_change,ctx)=>{ctx?.before.forEach(([key,data])=>qc.setQueryData(key,data)); toast.error(ui('Could not update bookmark'));},
    onSettled:refresh,
  });
  const archive=(b:Pick<Bookmark,'id'|'archived'>)=>update.mutate({id:b.id,archived:!b.archived},{onSuccess:()=>{
    toast(ui(b.archived?'Moved back to bookmarks':'Bookmark archived'),{action:{label:ui('Undo'),onClick:()=>update.mutate({id:b.id,archived:b.archived})}});
  }});
  const remove=useMutation({mutationFn:async(id:number)=>{await apiFetch(`/api/bookmarks/${id}`,{method:'DELETE'});return id;},onSuccess:refresh});
  const renameCollection=useMutation({
    mutationFn:async(body:{from:string;to:string})=>unwrap<{name:string;moved:number}>(await apiFetch<any>('/api/bookmarks/collections/rename',{method:'POST',body:JSON.stringify(body)})),
    onSuccess:()=>{refresh(); toast.success(ui('Collection renamed'));},
    onError:()=>toast.error(ui('Could not rename collection')),
  });
  const createCollection=useMutation({
    mutationFn:async(name:string)=>unwrap<{name:string}>(await apiFetch<any>('/api/bookmarks/collections',{method:'POST',body:JSON.stringify({name})})),
    onSuccess:refresh,
    onError:()=>toast.error(ui('Could not add collection')),
  });
  // moveTo null deletes the collection's bookmarks with it.
  const deleteCollection=useMutation({
    mutationFn:async(body:{name:string;moveTo:string|null})=>unwrap<{moveTo:string|null;moved:number;deleted:number}>(await apiFetch<any>('/api/bookmarks/collections/delete',{method:'POST',body:JSON.stringify(body)})),
    onSuccess:()=>{refresh(); qc.invalidateQueries({queryKey:['bookmark-ids']}); toast.success(ui('Collection deleted'));},
    onError:()=>toast.error(ui('Could not delete collection')),
  });
  const restore=useMutation({mutationFn:async(id:number)=>apiFetch(`/api/bookmarks/${id}/restore`,{method:'POST'}),onSuccess:refresh});
  return {update,archive,remove,restore,renameCollection,createCollection,deleteCollection};
}
