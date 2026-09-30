import { useUiText } from '../i18n/uiText';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router';
import { API_BASE_URL } from '../lib/apiFetch';
import { useApp } from '../contexts/AppContext';
import { usePosts } from '../hooks/usePosts';
import { PostCard } from '../components/posts/PostCard';
import { PROFILE_BACKGROUNDS } from '../lib/profileBackgrounds';
export function PublicProfilePage(){
  const ui = useUiText();const{username=''}=useParams();const{isDark}=useApp();const profile=useQuery({queryKey:['public-profile',username],queryFn:async()=>{const r=await fetch(`${API_BASE_URL}/api/profiles/${encodeURIComponent(username)}`);const j=await r.json();if(!r.ok)throw new Error(j.error);return j.data}});const posts=usePosts({username});const items=posts.data?.pages.flatMap(p=>p.posts)??[];
 if(profile.isLoading)return <p className="p-8">{ui("Loading profile…")}</p>;if(profile.isError)return <div className="p-8"><h1 className="text-2xl font-bold">{ui("Profile not found")}</h1></div>;const p=profile.data;
 return <main className="p-4 md:p-6"><section className={`rounded-2xl border overflow-hidden mb-5 ${isDark?'border-slate-700':'border-slate-200'}`}><div className="h-28 sm:h-36 relative" style={{background:PROFILE_BACKGROUNDS[p.profile_background] || PROFILE_BACKGROUNDS[0]}}>{p.profile_background_image && <img src={p.profile_background_image} alt={ui("Profile background")} className="w-full h-full object-cover"/>}</div><div className="flex gap-4 p-6"><img src={p.avatar||`https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(p.username)}`} alt="" className="w-20 h-20 rounded-full"/><div><h1 className="text-2xl font-bold">{p.display_name||p.username}</h1><p className="opacity-60">@{p.username}</p><p className="mt-2">{p.bio||'No bio yet.'}</p><p className="text-sm opacity-60 mt-2">{p.post_count} {ui("posts ·")} {p.like_count} {ui("likes received")}</p></div></div></section><h2 className="text-lg font-bold mb-3">{ui("Posts")}</h2><div className="space-y-3">{items.map(x=><PostCard key={x.id} post={x}/>)}</div>{posts.hasNextPage&&<button className="w-full border rounded-xl py-2 mt-4" onClick={()=>posts.fetchNextPage()}>{ui("Load more")}</button>}</main>}
