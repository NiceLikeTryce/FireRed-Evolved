// Raw FireRed flash save validation. No player data is sent to a server.
export const SAVE_BYTES = 128 * 1024;
const SECTOR = 4096;
const SPANS = [3876,3968,3968,3968,3816,3968,3968,3968,3968,3968,3968,3968,3968,2000];
const SIGNATURE = 0x08012025;
const ANNEX_MAGIC = 0x31524642;
const ANNEX_SIZES = {1:0xe24,2:0xe68,3:0xe70,4:3724,5:3724,6:3724,7:3724,8:3724,9:3724};

function checksum(view, start, length) {
  let sum = 0;
  for (let i=0;i<length;i+=4) sum = (sum + view.getUint32(start+i,true)) >>> 0;
  return ((sum & 65535) + (sum >>> 16)) & 65535;
}

function crc16(bytes) {
  let crc=65535;
  for (const value of bytes) {
    crc ^= value << 8;
    for (let bit=0;bit<8;bit++) crc=((crc<<1)^((crc&32768)?0x1021:0))&65535;
  }
  return crc;
}

function inspectBank(bytes, view, bank) {
  const records = new Map();
  let counter, error='';
  for (let i=0;i<14;i++) {
    const at=(bank*14+i)*SECTOR;
    const id=view.getUint16(at+4084,true);
    if (view.getUint32(at+4088,true)!==SIGNATURE || id>=14 || records.has(id)) {
      error='Missing or duplicated save sectors.'; break;
    }
    if (checksum(view,at,SPANS[id])!==view.getUint16(at+4086,true)) {
      error='A save checksum does not match.'; break;
    }
    const current=view.getUint32(at+4092,true);
    if (counter!==undefined && counter!==current) {error='The save bank is incomplete.';break;}
    counter=current;
    records.set(id,at);
  }
  const valid=!error && records.size===14;
  if (!valid) return {bank,valid:false,error};
  const marked=[...records.values()].filter(at=>view.getUint32(at+3968,true)===ANNEX_MAGIC);
  let extension='none';
  if (marked.length) {
    const version=view.getUint16(marked[0]+3972,true);
    if (marked.length!==14 || !ANNEX_SIZES[version]) extension='invalid';
    else {
      let offset=0;
      for (let id=0;id<14;id++) {
        const at=records.get(id), tail=3968-SPANS[id], capacity=tail+108;
        const length=Math.min(capacity,Math.max(0,ANNEX_SIZES[version]-offset));
        const content=new Uint8Array(length);
        const first=Math.min(tail,length);
        content.set(bytes.subarray(at+SPANS[id],at+SPANS[id]+first));
        content.set(bytes.subarray(at+3976,at+3976+length-first),first);
        if (view.getUint16(at+3972,true)!==version || crc16(content)!==view.getUint16(at+3974,true)) {
          extension='invalid'; break;
        }
        offset+=capacity;
      }
      if (extension!=='invalid') extension='evolved';
    }
  }
  return {bank,valid:true,counter,extension};
}

export function inspectSave(input) {
  const bytes=input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.length!==SAVE_BYTES) throw Error('Choose a 128 KiB battery save (.sav or .srm), not an emulator save state.');
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const banks=[0,1].map(bank=>inspectBank(bytes,view,bank));
  const valid=banks.filter(bank=>bank.valid);
  if (!valid.length) throw Error('No complete FireRed save bank passed its sector and checksum checks. Keep the original and try a backup.');
  // Match FireRed's special rollover comparison at FFFFFFFF -> 00000000.
  const newer=(a,b)=>((a.counter===0xffffffff && b.counter===0) ? b :
    (b.counter===0xffffffff && a.counter===0) ? a : (a.counter>=b.counter ? a : b));
  const active=valid.reduce(newer);
  if (active.extension==='invalid') throw Error('The newest save has damaged extra progress data. Use a known-good backup.');
  return {format:'FireRed 128 KiB flash',kind:active.extension==='evolved'?'evolved':'vanilla-or-legacy',
    activeBank:active.bank,counter:active.counter,validBanks:valid.length,
    warning:valid.length===1?'Only one complete save bank is available; keep the included backup.':'',
    bytes:new Uint8Array(bytes)};
}

export function prepareTransfer(input, destination, version) {
  if (!['gba','3ds'].includes(destination) || !/^v\d+\.\d+\.\d+$/.test(version)) throw Error('Choose a supported destination and game version.');
  const inspected=inspectSave(input);
  if (inspected.kind!=='evolved') throw Error('This looks like a vanilla or older save. Choose vanilla save import instead.');
  return {...inspected,path:destination==='3ds'?'3ds/FireRedEvolved/game.sav':`GBA/FireRed_Evolved_${version}.sav`};
}

// Preview only: use the same validated, newest coherent bank as the transfer.
export function previewTrainer(input) {
  const info=inspectSave(input), bytes=info.bytes;
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength), sections=new Map();
  for(let i=0;i<14;i++) {
    const at=(info.activeBank*14+i)*SECTOR;
    sections.set(view.getUint16(at+4084,true),bytes.subarray(at,at+SPANS[view.getUint16(at+4084,true)]));
  }
  const core=sections.get(0), identity=new DataView(core.buffer,core.byteOffset,core.byteLength);
  const glyph=code=>code===0?' ':code>=0xbb&&code<=0xd4?String.fromCharCode(65+code-0xbb):
    code>=0xd5&&code<=0xee?String.fromCharCode(97+code-0xd5):code>=0xa1&&code<=0xaa?String(code-0xa1):
    ({0xab:'!',0xac:'?',0xad:'.',0xae:'-',0xb4:"'",0xb8:',',0xf0:':'})[code]||'□';
  const name=[];for(const c of core.subarray(0,7)){if(c===0xff)break;name.push(glyph(c));}
  const block=new Uint8Array(0x3d68);let offset=0;
  for(let id=1;id<=4;id++){block.set(sections.get(id),offset);offset+=sections.get(id).length;}
  let badges=0;for(let i=0;i<8;i++){const flag=0x820+i;if(block[0xee0+(flag>>3)]&(1<<(flag&7)))badges++;}
  const profile=Array.from([...core.subarray(0,9),...core.subarray(10,14)],b=>b.toString(16).padStart(2,'0')).join('');
  return {name:name.join('')||'Unnamed trainer',trainerId:identity.getUint16(10,true),
    hours:identity.getUint16(14,true),minutes:core[16],badges,party:Math.min(block[0x34],6),
    profile,counter:info.counter,kind:info.kind};
}

export function prepareVanillaImport(input, destination, version) {
  if (!['gba','3ds'].includes(destination) || !/^v\d+\.\d+\.\d+$/.test(version)) throw Error('Choose a supported destination and game version.');
  const inspected=inspectSave(input);
  if (inspected.kind!=='vanilla-or-legacy') throw Error('This already contains Evolved progress. Choose FireRed Evolved / FireRed Evolv3D instead.');
  // Both targets retain the retail save layout. Preserve every input byte;
  // the game initializes absent extra-game records when it first loads them.
  return {...inspected,origin:'vanilla',path:destination==='3ds'?'3ds/FireRedEvolved/game.sav':`GBA/FireRed_Evolved_${version}.sav`};
}
