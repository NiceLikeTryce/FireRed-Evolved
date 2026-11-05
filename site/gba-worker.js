importScripts('vendor/rom-patcher-js/modules/HashCalculator.js','vendor/rom-patcher-js/modules/BinFile.js','vendor/rom-patcher-js/modules/RomPatcher.format.bps.js');
const hex=async(name,bytes)=>Array.from(new Uint8Array(await crypto.subtle.digest(name,bytes)),b=>b.toString(16).padStart(2,'0')).join('');
self.onmessage=async({data})=>{
  try{
    const {rom,manifest}=data;
    if(rom.byteLength!==16777216)throw Error('Choose a clean 16 MiB FireRed ROM.');
    const sha1=await hex('SHA-1',rom),source=manifest.sources.find(s=>s.base_sha1===sha1);
    if(!source)throw Error('The ROM does not match either supported FireRed revision.');
    self.postMessage({progress:'Downloading the matching GBA patch…'});
    const response=await fetch('assets/'+source.patch);if(!response.ok)throw Error('The patch download failed. Please try again.');
    const bytes=await response.arrayBuffer();if(await hex('SHA-256',bytes)!==source.patch_sha256)throw Error('Patch verification failed.');
    const patch=BPS.fromFile(new BinFile(bytes));
    if(patch.sourceSize!==16777216||patch.targetSize!==manifest.target_size)throw Error('Invalid patch sizes.');
    const output=patch.apply(new BinFile(rom),true)._u8array;
    if(output.length!==manifest.target_size||await hex('SHA-256',output)!==manifest.target_sha256||await hex('SHA-1',output)!==manifest.target_sha1)throw Error('Finished game verification failed.');
    self.postMessage({output:output.buffer},[output.buffer]);
  }catch(error){self.postMessage({error:error.message});}
};
