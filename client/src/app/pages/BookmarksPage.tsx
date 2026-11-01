import { useUiText } from '../i18n/uiText';
import { Bookmark } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { BookmarkCollection } from '../components/profile/BookmarkCollection';

export function BookmarksPage(){
  const ui = useUiText();
 const {user,setSidebarOpen}=useApp();
 if(!user)return <div className="text-center py-24"><Bookmark className="mx-auto mb-4"/><h1 className="text-2xl font-bold">{ui("Sign in to view bookmarks")}</h1><p className="my-4">{ui("Save, organise and annotate your favourite articles.")}</p><button onClick={()=>setSidebarOpen(true)} className="px-6 py-3 rounded-xl bg-[var(--brand)] text-white">{ui("Sign in")}</button></div>;
 return <main className="px-4 md:px-6 py-8"><h1 className="text-4xl font-bold">{ui("My bookmarks")}</h1><BookmarkCollection /></main>;
}
