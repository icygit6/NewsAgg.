import { useUiText } from '../i18n/uiText';
import { useState } from 'react';
import { Bookmark, Search } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { useBookmarkMeta } from '../hooks/useBookmarks';
import { BookmarkList } from '../components/profile/BookmarkList';

export function BookmarksPage(){
  const ui = useUiText();
 const {user,isDark,setSidebarOpen}=useApp(); const [search,setSearch]=useState(''); const [status,setStatus]=useState(''); const [collection,setCollection]=useState(''); const meta=useBookmarkMeta(Boolean(user));
 if(!user)return <div className="text-center py-24"><Bookmark className="mx-auto mb-4"/><h1 className="text-2xl font-bold">{ui("Sign in to view bookmarks")}</h1><p className="my-4">{ui("Save, organize, and annotate your favorite articles.")}</p><button onClick={()=>setSidebarOpen(true)} className="px-6 py-3 rounded-xl bg-cyan-500 text-white">{ui("Sign In")}</button></div>;
 const input=`rounded-xl border px-3 py-2 bg-transparent ${isDark?'border-slate-700':'border-slate-300'}`;
 return <main className="px-4 md:px-6 py-8"><h1 className="text-4xl font-bold">{ui("My Bookmarks")}</h1><p className="opacity-70 mb-5">{meta.data?.total??'…'} {ui("saved articles")}</p>
  <div className="grid sm:grid-cols-3 gap-2 mb-5">
   <label className={`flex items-center gap-2 ${input}`}><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder={ui("Search bookmarks")} className="bg-transparent outline-none w-full"/></label>
   <select aria-label={ui("Filter by status")} value={status} onChange={e=>setStatus(e.target.value)} className={input}><option value="">{ui("All statuses")}</option><option value="unread">{ui("Unread")}</option><option value="read">{ui("Read")}</option><option value="archived">{ui("Archived")}</option></select>
   <select aria-label={ui("Filter by collection")} value={collection} onChange={e=>setCollection(e.target.value)} className={input}><option value="">{ui("All collections")}</option>{meta.data?.collections?.map((x:string)=><option key={x}>{x}</option>)}</select>
  </div><BookmarkList filters={{search, status, collection}}/></main>;
}
