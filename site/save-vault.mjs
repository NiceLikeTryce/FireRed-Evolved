import {inspectSave,previewTrainer} from './save-tools.mjs';
const DATABASE='firered-save-backups',STORE='saves',KEEP=5;
let database;
function open(){
  if(!database)database=new Promise((resolve,reject)=>{
    const request=indexedDB.open(DATABASE,1);
    request.onupgradeneeded=()=>request.result.createObjectStore(STORE,{keyPath:'id'});
    request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
  });
  return database;
}
export async function listBackups(){
  const db=await open();return new Promise((resolve,reject)=>{
    const request=db.transaction(STORE).objectStore(STORE).getAll();
    request.onsuccess=()=>resolve(request.result.sort((a,b)=>b.createdAt-a.createdAt));
    request.onerror=()=>reject(request.error);
  });
}
export async function keepBackup(input,version){
  const info=inspectSave(input),preview=previewTrainer(info.bytes);
  const id=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',info.bytes)),b=>b.toString(16).padStart(2,'0')).join('');
  const row={id,profile:preview.profile,preview,version,createdAt:Date.now(),bytes:info.bytes.slice().buffer};
  const db=await open();
  await new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE,'readwrite'),store=tx.objectStore(STORE),request=store.getAll();
    request.onsuccess=()=>{
      const older=request.result.filter(x=>x.profile===row.profile&&x.id!==id).sort((a,b)=>b.createdAt-a.createdAt);
      store.put(row);for(const old of older.slice(KEEP-1))store.delete(old.id);
    };
    tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);tx.onerror=()=>reject(tx.error);
  });return row;
}
export async function loadBackup(id){
  const db=await open();return new Promise((resolve,reject)=>{
    const request=db.transaction(STORE).objectStore(STORE).get(id);
    request.onsuccess=async()=>{
      try{
        const row=request.result;if(!row)throw Error('That backup is unavailable.');
        const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',row.bytes)),b=>b.toString(16).padStart(2,'0')).join('');
        if(digest!==row.id)throw Error('Backup integrity check failed. Keep your original save.');
        inspectSave(row.bytes);resolve(row);
      }catch(error){reject(error);}
    };request.onerror=()=>reject(request.error);
  });
}
