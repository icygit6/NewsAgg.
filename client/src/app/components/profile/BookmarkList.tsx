import { useUiText } from '../../i18n/uiText';
import { useTitleTranslations } from '../../hooks/useTitleTranslations';
import { useState } from 'react';
import { Link } from 'react-router';
import { AlertCircle, Archive, Bookmark as BookmarkIcon, Check, ExternalLink, RotateCcw, Trash2 } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { useBookmarkActions, useBookmarkList } from '../../hooks/useBookmarks';

export function BookmarkList({ compact=false, filters={} }: { compact?:boolean; filters?:Record<string,string> }) {
  const ui = useUiText();
  const { isDark }=useApp(); const q=useBookmarkList(filters); const {update,remove,restore}=useBookmarkActions();
  const [removed,setRemoved]=useState<number|null>(null); const items=q.data?.pages.flatMap((p:any)=>p.bookmarks)??[];
  const titles = useTitleTranslations(items.map((b:any) => ({ id: String(b.article_id), title: b.article_title || '', language: b.article_language })));
  if(q.isLoading) return <p className="py-8 text-center">{ui("Loading bookmarks…")}</p>;
  if(q.isError) return <div role="alert" className="p-4 rounded-xl border border-red-300 text-red-600 flex gap-2"><AlertCircle size={18}/>{ui("Could not load bookmarks.")} <button onClick={()=>q.refetch()} className="underline">{ui("Retry")}</button></div>;
  if(!items.length) return <div className={`text-center py-14 rounded-2xl border ${isDark?'border-slate-700':'border-slate-200'}`}><BookmarkIcon className="mx-auto mb-3 opacity-50"/><h2 className="font-bold">{ui("No matching bookmarks")}</h2><Link to="/" className="text-cyan-500 text-sm">{ui("Explore articles")}</Link></div>;
  return <>
    {removed!==null&&<div role="status" className="mb-3 p-3 rounded-xl bg-cyan-500/10 flex justify-between">{ui("Bookmark removed")}<button className="font-semibold text-cyan-600" onClick={()=>restore.mutate(removed,{onSuccess:()=>setRemoved(null)})}><RotateCcw size={14} className="inline"/> {ui("Undo")}</button></div>}
    <div className={`grid grid-cols-1 gap-4 ${compact?'':'sm:grid-cols-2'}`}>{items.map((b:any,index:number)=><article key={b.id} className={`rounded-2xl border overflow-hidden ${isDark?'bg-slate-900 border-slate-700':'bg-white border-slate-200'}`}>
      {b.url_to_image&&<img loading="lazy" src={b.url_to_image} alt="" className="w-full h-36 object-cover"/>}
      <div className="p-4 space-y-3">
        <div className="flex gap-2 text-xs"><span className="rounded-full px-2 py-1 bg-cyan-500/10 text-cyan-600">{b.collection_name}</span>{b.topic&&<span className="px-2 py-1">{b.topic}</span>}</div>
        <Link to={`/article/${b.article_id}`} className="font-semibold leading-snug line-clamp-2 hover:text-cyan-500">{titles[index]?.title||ui('Untitled article')}</Link>
        <input aria-label={`Collection for ${b.article_title}`} defaultValue={b.collection_name} onBlur={e=>{if(e.target.value.trim()&&e.target.value!==b.collection_name)update.mutate({id:b.id,collectionName:e.target.value.trim()})}} className={`w-full text-xs rounded-lg border px-2 py-1.5 bg-transparent ${isDark?'border-slate-700':'border-slate-200'}`}/>
        <textarea aria-label={`Notes for ${b.article_title}`} defaultValue={b.notes||''} placeholder={ui("Add a private note…")} maxLength={1000} onBlur={e=>update.mutate({id:b.id,notes:e.target.value||null})} className={`w-full text-xs rounded-lg border p-2 bg-transparent resize-none ${isDark?'border-slate-700':'border-slate-200'}`}/>
        <div className="flex items-center justify-between text-xs">
          <span className="opacity-60">{ui("Saved")} {new Date(b.created_at).toLocaleDateString()}</span>
          <div className="flex gap-1">
            <button aria-label={`${b.is_read?'Mark unread':'Mark read'}: ${b.article_title}`} onClick={()=>update.mutate({id:b.id,isRead:!b.is_read})} className="p-2 rounded-lg hover:bg-cyan-500/10"><Check size={15}/></button>
            <button aria-label={`Archive ${b.article_title}`} onClick={()=>update.mutate({id:b.id,archived:true})} className="p-2 rounded-lg hover:bg-cyan-500/10"><Archive size={15}/></button>
            {b.article_url&&<a href={b.article_url} target="_blank" rel="noopener noreferrer" aria-label={`Open original article: ${b.article_title}`} className="p-2"><ExternalLink size={15}/></a>}
            <button aria-label={`Remove bookmark: ${b.article_title}`} onClick={()=>remove.mutate(b.id,{onSuccess:()=>setRemoved(b.id)})} className="p-2 text-rose-500"><Trash2 size={15}/></button>
          </div>
        </div>
      </div></article>)}</div>
    {q.hasNextPage&&<button onClick={()=>q.fetchNextPage()} disabled={q.isFetchingNextPage} className="mt-5 w-full rounded-xl border py-2">{q.isFetchingNextPage?'Loading…':ui("Load more")}</button>}
  </>;
}
