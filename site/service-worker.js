// No ROMs or saves pass through this cache. It serves explicitly prepared files only.
const CONTROL='firered-offline-control-v1',POINTER='/FireRed-Evolved/__offline_active';
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==self.location.origin||request.cache==='reload')return;
  if(!url.pathname.startsWith('/FireRed-Evolved/')&&!url.pathname.startsWith('/FireRed-Evolv3D/'))return;
  if(/\.(gba|sav|srm|3dsx)$/i.test(url.pathname))return;
  event.respondWith((async()=>{
    try{
      const response=await fetch(request);if(response.ok)return response;
      throw Error('The resource is unavailable.');
    }catch(error){
      const pointer=await (await caches.open(CONTROL)).match(POINTER);
      if(pointer){
        const active=await pointer.json(),cache=await caches.open(active.cache);
        const saved=await cache.match(request,{ignoreSearch:true});
        if(saved)return saved;
      }
      throw error;
    }
  })());
});
