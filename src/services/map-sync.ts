import fs from 'node:fs/promises';
import path from 'node:path';
import {prisma} from '../lib/db.js';

const endpoint='https://valorant-api.com/v1/maps';
type CachedMap={uuid:string;nameEn:string;nameZhTw:string;nameZhCn:string;splash:string|null};
type MapCache={syncedAt:string;data:CachedMap[]};
const cachePath=()=>path.resolve('storage/cache/valorant-maps.json');

async function saveMaps(cache:MapCache){
  const syncedAt=new Date(cache.syncedAt);
  for(const m of cache.data)await prisma.map.upsert({
    where:{id:m.uuid},
    update:{nameEn:m.nameEn,nameZhTw:m.nameZhTw,nameZhCn:m.nameZhCn||m.nameEn,splashUrl:m.splash,official:true,lastSyncedAt:syncedAt},
    create:{id:m.uuid,nameEn:m.nameEn,nameZhTw:m.nameZhTw,nameZhCn:m.nameZhCn||m.nameEn,splashUrl:m.splash,official:true,lastSyncedAt:syncedAt}
  });
  return cache;
}

export async function restoreCachedMaps(){
  const cache=JSON.parse(await fs.readFile(cachePath(),'utf8')) as MapCache;
  if(!Array.isArray(cache.data)||cache.data.length<7)throw new Error('本機地圖快取無效');
  return saveMaps(cache);
}

export async function syncValorantMaps(){
  const fetchLang=async(language:string)=>{
    const r=await fetch(`${endpoint}?language=${language}`,{signal:AbortSignal.timeout(15000)});
    if(!r.ok)throw new Error(`VALORANT API ${r.status}`);
    const j=await r.json() as {data:Array<{uuid:string;displayName:string;splash:string|null;tacticalDescription:string|null}>};
    return j.data;
  };
  const [en,zhTw,zhCn]=await Promise.all([fetchLang('en-US'),fetchLang('zh-TW'),fetchLang('zh-CN')]),zhTwById=new Map(zhTw.map(x=>[x.uuid,x])),zhCnById=new Map(zhCn.map(x=>[x.uuid,x]));
  const official=en.filter(x=>x.tacticalDescription&&x.splash&&!['The Range','Basic Training'].includes(x.displayName));
  const cache:MapCache={syncedAt:new Date().toISOString(),data:official.map(m=>({uuid:m.uuid,nameEn:m.displayName,nameZhTw:zhTwById.get(m.uuid)?.displayName||m.displayName,nameZhCn:zhCnById.get(m.uuid)?.displayName||m.displayName,splash:m.splash}))};
  await saveMaps(cache);
  await fs.mkdir(path.dirname(cachePath()),{recursive:true});
  await fs.writeFile(cachePath(),JSON.stringify(cache,null,2));
  return cache;
}

export async function ensureMapCatalog(){
  const existing=await prisma.map.count();
  if(existing)return {source:'database' as const,count:existing};
  try{const result=await syncValorantMaps();return {source:'api' as const,count:result.data.length}}
  catch(apiError){try{const result=await restoreCachedMaps();return {source:'cache' as const,count:result.data.length}}catch{throw apiError}}
}
