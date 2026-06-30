import type { GameProfile, MeResponse, ProgressPatch } from '../types/shared';
const API_URL=import.meta.env.VITE_API_URL??'http://localhost:4000'; const KEY='cardworld_token';
export const getToken=()=>localStorage.getItem(KEY); export const setToken=(t:string)=>localStorage.setItem(KEY,t); export const clearToken=()=>localStorage.removeItem(KEY); export const discordLoginUrl=()=>`${API_URL}/auth/discord/start`;
async function request<T>(path:string, init:RequestInit={}):Promise<T>{const h=new Headers(init.headers); h.set('Content-Type','application/json'); const t=getToken(); if(t) h.set('Authorization',`Bearer ${t}`); const r=await fetch(`${API_URL}${path}`,{...init,headers:h}); if(!r.ok) throw new Error(`${path} ${r.status}`); return r.json() as Promise<T>}
export async function devLogin(userId:string){const r=await request<{token:string}>(`/auth/dev?userId=${encodeURIComponent(userId)}`); setToken(r.token)}
export const getMe=()=>request<MeResponse>('/game/me');
export const createOrUpdateProfile=(body:{displayName:string;avatar:unknown})=>request<GameProfile>('/game/profile',{method:'POST',body:JSON.stringify(body)});
export const getInventory=()=>request<CardStack[]>('/game/inventory');
import type { CardStack } from '../types/shared';
export const updateProgress=(patch:ProgressPatch)=>request<GameProfile>('/game/progress',{method:'POST',body:JSON.stringify(patch)});