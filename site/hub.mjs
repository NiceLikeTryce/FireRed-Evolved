const $=id=>document.getElementById(id);
const editions={gba:{name:'FireRed Evolved',extension:'gba',worker:'gba-worker.js'},'3ds':{name:'FireRed Evolv3D',extension:'3dsx',worker:'/FireRed-Evolv3D/worker.js'}};
let edition=new URLSearchParams(location.search).get('platform')==='3ds'?'3ds':'gba';
let manifests,rom,busy=false,checking=false,generation=0,worker;
const digest=async(name,bytes)=>Array.from(new Uint8Array(await crypto.subtle.digest(name,bytes)),b=>b.toString(16).padStart(2,'0')).join('');
function status(text,error=false){$('status').textContent=text;$('status').dataset.state=error?'error':'success';}
function refresh(){
  $('apply').disabled=!manifests||!rom||busy||checking;$('rom').disabled=!manifests||busy;
  for(const name of Object.keys(editions)){$('edition-'+name).setAttribute('aria-pressed',String(edition===name));$('edition-'+name).disabled=busy;}
  $('apply').textContent=busy?'Building your game…':`Build and download .${editions[edition].extension}`;
  $('edition-description').textContent=edition==='gba'?'The classic GBA adventure, expanded.':'The same adventure in voxel 3D, with dual-screen menus and touch controls.';
}
let theme='dark';try{const saved=localStorage.getItem('firered-evolved-theme');if(['dark','light'].includes(saved))theme=saved;}catch{}
function setTheme(value){document.documentElement.dataset.theme=value;$('theme').textContent=value==='dark'?'Light mode':'Dark mode';$('theme').setAttribute('aria-pressed',String(value==='dark'));}
setTheme(theme);$('theme').addEventListener('click',()=>{theme=theme==='dark'?'light':'dark';setTheme(theme);try{localStorage.setItem('firered-evolved-theme',theme);}catch{}});
for(const name of Object.keys(editions))$('edition-'+name).addEventListener('click',()=>{edition=name;refresh();});
async function check(file){
  const current=++generation;rom=null;checking=!!file;refresh();if(!file){status('');checking=false;refresh();return;}
  try{
    if(file.size!==16777216)throw Error('Choose a clean 16 MiB US/English FireRed v1.0 or v1.1 ROM.');
    status('Detecting your FireRed revision…');const bytes=await file.arrayBuffer();
    const [sha1,sha256]=await Promise.all([digest('SHA-1',bytes),digest('SHA-256',bytes)]);
    if(current!==generation)return;
    const gba=manifests.gba.sources.find(s=>s.base_sha1===sha1),native=manifests['3ds'].sources.find(s=>s.sha256===sha256);
    if(!gba||!native||gba.revision!==native.revision)throw Error('This is not a supported clean US/English FireRed ROM.');
    rom=bytes;$('selected').textContent=`FireRed ${gba.revision} detected`;status('Ready. Choose either edition and build.');
  }catch(error){if(current===generation){$('selected').textContent='Choose your FireRed ROM';status(error.message,true);}}
  finally{if(current===generation){checking=false;refresh();}}
}
$('rom').addEventListener('change',()=>check($('rom').files[0]));
$('drop-zone').addEventListener('dragover',e=>{e.preventDefault();$('drop-zone').dataset.dragging='true';});
$('drop-zone').addEventListener('dragleave',()=>delete $('drop-zone').dataset.dragging);
$('drop-zone').addEventListener('drop',e=>{e.preventDefault();delete $('drop-zone').dataset.dragging;if(!busy&&manifests)check(e.dataTransfer.files[0]);});
$('apply').addEventListener('click',()=>{
  if(!rom||busy)return;busy=true;refresh();status('Preparing your game…');
  worker=new Worker(editions[edition].worker);const chosen=edition;
  const finish=()=>{worker?.terminate();worker=null;busy=false;refresh();};
  worker.onerror=()=>{status('The builder stopped. Your ROM is unchanged; please try again.',true);finish();};
  worker.onmessage=({data})=>{
    if(data.progress){status(data.progress);return;}
    if(data.error){status(data.error,true);finish();return;}
    if(!(data.output instanceof ArrayBuffer)){status('The builder returned an invalid download.',true);finish();return;}
    const blob=new Blob([data.output],{type:'application/octet-stream'}),url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download=`${chosen==='gba'?'FireRed_Evolved':'FireRed_Evolv3D'}_${manifests[chosen].version}.${editions[chosen].extension}`;link.click();
    setTimeout(()=>URL.revokeObjectURL(url),10000);status(`${editions[chosen].name} ${manifests[chosen].version} is ready. Your download has started.`);finish();
  };
  const input=rom.slice(0);worker.postMessage({rom:input,manifest:manifests[edition]},[input]);
});
refresh();
try{
  const [gba,native]=await Promise.all(['release.json','/FireRed-Evolv3D/release.json'].map(async url=>{const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw Error('Current release information is unavailable.');return r.json();}));
  if(!/^v\d+\.\d+\.\d+$/.test(gba.version)||gba.version!==native.version)throw Error('A coordinated update is being published. Please try again shortly.');
  if(gba.target_size!==16777216||!Array.isArray(gba.sources)||gba.sources.length!==2||!gba.sources.every(s=>['v1.0','v1.1'].includes(s.revision)&&/^[a-f0-9]{40}$/.test(s.base_sha1)&&/^[a-f0-9]{64}$/.test(s.patch_sha256)&&/^[A-Za-z0-9_.-]+\.bps$/.test(s.patch)))throw Error('Invalid GBA release information.');
  if(native.distribution_scope!=='public-patch-data'||!Array.isArray(native.sources)||native.sources.length!==2||!native.sources.every(s=>/^[a-f0-9]{64}$/.test(s.sha256)))throw Error('Invalid 3DS release information.');
  manifests={gba,'3ds':native};$('version').textContent=`Both editions · ${gba.version}`;status('');refresh();
}catch(error){status(error.message,true);}
