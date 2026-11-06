const $=id=>document.getElementById(id);
const base='/FireRed-Evolv3D/';
let theme='dark';try{const value=localStorage.getItem('firered-evolved-theme');if(['light','dark'].includes(value))theme=value;}catch{}
function paint(){document.documentElement.dataset.theme=theme;$('theme').textContent=theme==='dark'?'Light mode':'Dark mode';}
paint();$('theme').addEventListener('click',()=>{theme=theme==='dark'?'light':'dark';paint();try{localStorage.setItem('firered-evolved-theme',theme);}catch{}});
function descriptor(downloads,key,name,limit){
  const item=downloads?.[key];if(!item||item.asset!==name||!Number.isSafeInteger(item.size)||item.size<1||item.size>limit||!/^[a-f0-9]{64}$/.test(item.sha256))throw Error('The current installation tools are not available yet. You can still use the builder and copy its game to your SD card.');
  return base+'downloads/'+item.asset;
}
try{
  const response=await fetch(base+'release.json',{cache:'no-store'});if(!response.ok)throw Error('Current installation information is unavailable.');
  const manifest=await response.json();if(manifest.distribution_scope!=='public-patch-data'||manifest.launcher_abi!==1)throw Error('Use the current builder to prepare a launcher-compatible game.');
  const cia=descriptor(manifest.downloads,'launcher','FireRed-Evolv3D-Launcher.cia',4*1024*1024);
  const qr=descriptor(manifest.downloads,'launcher_qr','FireRed-Evolv3D-Launcher-QR.png',128*1024);
  const wireless=descriptor(manifest.downloads,'wireless','FireRed-Evolv3D-Wireless.zip',64*1024*1024);
  $('launcher-download').href=cia;$('launcher-download').hidden=false;$('launcher-qr').src=qr;$('launcher-qr').hidden=false;
  $('wireless-download').href=wireless;$('wireless-download').hidden=false;$('tools-status').textContent='Installation tools for '+manifest.version+'.';
}catch(error){$('tools-status').textContent=error.message;}
