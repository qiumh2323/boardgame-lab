/* Asset-only persistent cache. Never cache HTML/JS, APIs, or game/replay data. */
const PREFIX='castle-assets-'+new URL(self.registration.scope).pathname.replace(/[^a-z0-9]/gi,'_')+'-';
const CACHE=PREFIX+'v1';
const inFlight=new Map();
function assetKey(value){const url=new URL(value,self.registration.scope),base=new URL('assets/',self.registration.scope);if(url.origin!==base.origin||!url.pathname.startsWith(base.pathname))return null;if(!/\.(jpg|png|svg|webp)$/i.test(url.pathname)&&!/\/champion-(?:r\d+(?:-(?:x2|rel)-r\d+)?|gumbel-r\d+)\.json$/.test(url.pathname))return null;url.search='';url.hash='';return url.href;}
async function cachedAsset(url){
 const cache=await caches.open(CACHE),hit=await cache.match(url);if(hit)return hit;
 if(!inFlight.has(url))inFlight.set(url,(async()=>{const response=await fetch(url);if(response.ok&&response.type!=='opaque')await cache.put(url,response.clone());return response;})().finally(()=>inFlight.delete(url)));
 return (await inFlight.get(url)).clone();
}
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const name of await caches.keys())if(name.startsWith(PREFIX)&&name!==CACHE)await caches.delete(name);await self.clients.claim();})()));
self.addEventListener('fetch',event=>{if(event.request.method!=='GET')return;const key=assetKey(event.request.url);if(key)event.respondWith(cachedAsset(key).catch(()=>fetch(event.request)));});
self.addEventListener('message',event=>{
 if(event.data?.type!=='CACHE_ART')return;
 const urls=[...new Set((event.data.urls??[]).slice(0,100).map(assetKey).filter(Boolean))];
 event.waitUntil((async()=>{let cursor=0;await Promise.all(Array.from({length:3},async()=>{while(cursor<urls.length){const url=urls[cursor++];try{await cachedAsset(url)}catch{/* Offline first visit: retry lazily next time. */}}}));event.ports?.[0]?.postMessage({completed:true});})());
});
