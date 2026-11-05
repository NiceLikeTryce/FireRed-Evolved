// Small, dependency-free ZIP writer using the interoperable stored method.
const encode = text => new TextEncoder().encode(text);
const table=Uint32Array.from({length:256},(_,n)=>{for(let b=0;b<8;b++)n=(n>>>1)^((n&1)?0xedb88320:0);return n>>>0;});
function crc32(bytes){let crc=0xffffffff;for(const b of bytes)crc=table[(crc^b)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;}
export function zipFiles(files) {
  const local=[],central=[];let offset=0;
  for(const file of files){
    if(!file.name || file.name.startsWith('/') || file.name.includes('..') || /[:\\]/.test(file.name))throw Error('Invalid ZIP path.');
    const name=encode(file.name),data=typeof file.data==='string'?encode(file.data):new Uint8Array(file.data);
    const crc=crc32(data),header=new Uint8Array(30+name.length),h=new DataView(header.buffer);
    h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(6,0x800,true);
    h.setUint16(12,33,true);h.setUint32(14,crc,true);h.setUint32(18,data.length,true);h.setUint32(22,data.length,true);h.setUint16(26,name.length,true);header.set(name,30);
    local.push(header,data);
    const entry=new Uint8Array(46+name.length),e=new DataView(entry.buffer);
    e.setUint32(0,0x02014b50,true);e.setUint16(4,20,true);e.setUint16(6,20,true);e.setUint16(8,0x800,true);
    e.setUint16(14,33,true);e.setUint32(16,crc,true);e.setUint32(20,data.length,true);e.setUint32(24,data.length,true);e.setUint16(28,name.length,true);e.setUint32(42,offset,true);entry.set(name,46);
    central.push(entry);offset+=header.length+data.length;
  }
  const size=central.reduce((n,x)=>n+x.length,0),end=new Uint8Array(22),e=new DataView(end.buffer);
  e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,size,true);e.setUint32(16,offset,true);
  return new Blob([...local,...central,end],{type:'application/zip'});
}
