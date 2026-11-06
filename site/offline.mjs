const CONTROL='firered-offline-control-v1',POINTER='/FireRed-Evolved/__offline_active',PREFIX='firered-offline-pack-';
const hash=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
async function fresh(url){const r=await fetch(url,{cache:'reload'});if(!r.ok)throw Error('Could not download '+url);return r;}
export async function offlineInfo(){
  if(!('caches'in globalThis))return null;
  const response=await (await caches.open(CONTROL)).match(POINTER);return response?response.json():null;
}
export async function prepareOffline(progress=()=>{}){
  if(!('serviceWorker'in navigator)||!('caches'in globalThis))throw Error('Offline installation is unavailable in this browser.');
  await navigator.serviceWorker.register('./service-worker.js',{scope:'./'});
  await navigator.serviceWorker.register('/FireRed-Evolv3D/service-worker.js',{scope:'/FireRed-Evolv3D/'});
  await navigator.serviceWorker.ready;
  const [gba,native,localFiles,nativeFiles]=await Promise.all([
    './release.json','/FireRed-Evolv3D/release.json','./offline-files.json','/FireRed-Evolv3D/offline-files.json'
  ].map(async url=>(await fresh(url)).json()));
  if(!/^v\d+\.\d+\.\d+$/.test(gba.version)||gba.version!==native.version)throw Error('Wait until both editions have the same version, then try again.');
  const {validateManifest}=await import('/FireRed-Evolv3D/builder.mjs');validateManifest(native);
  if(gba.sources.length!==2||gba.target_size!==16777216)throw Error('Invalid GBA release metadata.');
  const previous=await offlineInfo(),name=PREFIX+gba.version+'-'+crypto.randomUUID(),cache=await caches.open(name);
  try{
    const files=[];
    for(const [base,manifest]of [['/FireRed-Evolved/',localFiles],['/FireRed-Evolv3D/',nativeFiles]]){
      if(manifest.schema!==1||!Array.isArray(manifest.files)||manifest.files.length>100)throw Error('Invalid offline file list.');
      for(const file of manifest.files){
        if(!/^[\w./-]+$/.test(file.path)||file.path.split('/').includes('..')||file.path.startsWith('/')||!/^[a-f0-9]{64}$/.test(file.sha256))throw Error('Unsafe offline file.');
        files.push({url:base+file.path,...file});
      }
    }
    for(const source of gba.sources){
      if(!/^[\w.-]+\.bps$/.test(source.patch)||!/^[a-f0-9]{64}$/.test(source.patch_sha256))throw Error('Invalid GBA patch metadata.');
      files.push({url:'/FireRed-Evolved/assets/'+source.patch,sha256:source.patch_sha256});
    }
    for(const [part,descriptor]of Object.entries(native.parts))files.push({url:'/FireRed-Evolv3D/assets/'+part,sha256:descriptor.sha256,size:descriptor.size});
    let done=0;
    for(const file of files){
      progress(`Saving offline files ${++done}/${files.length}…`);
      const response=await fresh(file.url),bytes=await response.arrayBuffer();
      if(bytes.byteLength>192*1024*1024||file.size!==undefined&&bytes.byteLength!==file.size)throw Error('Offline file size does not match.');
      const checked=file.textLF?new TextEncoder().encode(new TextDecoder('utf-8',{fatal:true}).decode(bytes).replaceAll('\r\n','\n')):bytes;
      if(await hash(checked)!==file.sha256)throw Error('Offline file verification failed: '+file.path);
      await cache.put(file.url,new Response(bytes,{headers:response.headers}));
    }
    // Freeze both manifests with the same verified pack, then publish the pointer last.
    for(const [url,value]of [['/FireRed-Evolved/release.json',gba],['/FireRed-Evolv3D/release.json',native]])
      await cache.put(url,new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json'}}));
    for(const base of ['/FireRed-Evolved/','/FireRed-Evolv3D/']){
      const index=await cache.match(base+'index.html');if(!index)throw Error('Offline start page is missing.');await cache.put(base,index);
    }
    const [latestGba,latestNative]=await Promise.all(['./release.json','/FireRed-Evolv3D/release.json'].map(async url=>(await fresh(url)).json()));
    if(latestGba.target_sha256!==gba.target_sha256||latestNative.output.sha256!==native.output.sha256)throw Error('An update arrived during download. Try again.');
    const info={cache:name,version:gba.version,preparedAt:Date.now(),files:files.length};
    await (await caches.open(CONTROL)).put(POINTER,new Response(JSON.stringify(info)));
    for(const old of await caches.keys())if(old.startsWith(PREFIX)&&old!==name&&old!==previous?.cache)await caches.delete(old);
    return info;
  }catch(error){await caches.delete(name);throw error;}
}
