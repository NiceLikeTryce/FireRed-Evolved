// Same verified native builder, owned by this hub's offline service-worker scope.
importScripts('/FireRed-Evolv3D/vendor/HashCalculator.js','/FireRed-Evolv3D/vendor/BinFile.js','/FireRed-Evolv3D/vendor/RomPatcher.format.bps.js');
const builder=import('/FireRed-Evolv3D/builder.mjs');
self.onmessage=async({data})=>{
  try{
    const {build3dsx}=await builder;
    const output=await build3dsx(data.rom,data.manifest,async name=>{
      const response=await fetch('/FireRed-Evolv3D/assets/'+name);if(!response.ok)throw Error('A verified native build file is unavailable.');return response.arrayBuffer();
    },progress=>self.postMessage({progress}));
    self.postMessage({output:output.buffer},[output.buffer]);
  }catch(error){self.postMessage({error:error.message});}
};
