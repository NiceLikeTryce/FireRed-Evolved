import {inspectSave,prepareTransfer,prepareVanillaImport} from './save-tools.mjs';
import {zipFiles} from './zip.mjs';
const $=id=>document.getElementById(id);
let version,bytes,selection=0;
const status=(text,error=false)=>{$('save-status').textContent=text;$('save-status').dataset.state=error?'error':'success';};
const instructions=()=>{$('save-instructions').textContent=$('save-destination').value==='3ds'
  ?'For 3DS, copy game.sav into /3ds/FireRedEvolved/ on the SD card or emulator SD folder.'
  :'For GBA, put the .sav beside the patched .gba with the same filename, or use your emulator’s battery-save import.';};
function refresh(){ $('save-download').disabled=!version||!bytes;instructions(); }
try{
  const [gba,native]=await Promise.all(['release.json','/FireRed-Evolv3D/release.json'].map(async url=>{
    const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw Error('Current game information is unavailable.');return r.json();
  }));
  if(gba.version!==native.version)throw Error('A coordinated update is being published. Please try again shortly.');
  version=gba.version;$('save-version').textContent=`Both editions: ${version}`;$('save-file').disabled=false;
}catch(error){status(error.message,true);}
$('save-file').addEventListener('change',async()=>{
  const current=++selection;bytes=null;refresh();const file=$('save-file').files[0];if(!file){status('');return;}
  try{
    const candidate=new Uint8Array(await file.arrayBuffer());const info=inspectSave(candidate);
    if(current!==selection)return;bytes=candidate;
    status(`Save checks passed. ${info.warning||'Both save banks are intact.'}`);
  }catch(error){if(current===selection)status(error.message,true);}
  refresh();
});
$('save-destination').addEventListener('change',refresh);
$('save-origin').addEventListener('change',refresh);
$('save-download').addEventListener('click',async()=>{
  if(!bytes||!version)return;
  try{
    const vanilla=$('save-origin').value==='vanilla';
    const destination=$('save-destination').value;
    const result=(vanilla?prepareVanillaImport:prepareTransfer)(bytes,destination,version);
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
    const readme=`FireRed Evolved / Evolv3D ${version} — save transfer\n\nClose the game first. Back up the current destination save before replacing it.\n\nCopy ${result.path} to the matching game installation.\n${destination==='3ds'?'The SD-card path is /3ds/FireRedEvolved/game.sav.':'The .sav filename must match the patched .gba filename.'}\nChoose Continue after starting the game.\n\nbackup/original.sav is an untouched copy of your input. Its SHA-256 is ${hash}.\nThe transferred save has exactly the same bytes.\n3DS-specific settings and tracker sidecars are not part of the raw save.\n`;
    const importNote=vanilla?'\nOriginal FireRed import: this tool validates the retail flash layout and preserves the entire save. It cannot determine the original ROM revision or language from the save alone. Use a battery save from US/English FireRed v1.0/v1.1. On first Continue, the game initializes missing extra-feature records; the next in-game save writes them. Your original progress is retained.\n':'';
    const blob=zipFiles([{name:result.path,data:result.bytes},{name:'backup/original.sav',data:bytes},{name:'READ_ME.txt',data:readme+importNote}]);
    const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`FireRed_save_transfer_${destination}_${version}.zip`;link.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
    status('Transfer package ready. Your untouched backup is included.');
  }catch(error){status(error.message,true);}
});
refresh();
