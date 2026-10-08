import {safePath} from './repair.mjs';
const ensure=(ok,message)=>{if(!ok)throw Error(message);};
export async function readZipIndex(file,limit=1024*1024*1024){
  const start=Math.max(0,file.size-65557);
  const tail=new Uint8Array(await file.slice(start).arrayBuffer());
  const tv=new DataView(tail.buffer);let eocd=-1;
  for(let p=tail.length-22;p>=0;p--){
    if(tv.getUint32(p,true)===0x06054b50&&p+22+tv.getUint16(p+20,true)===tail.length){eocd=p;break;}
  }
  ensure(eocd>=0,'The ZIP end record is missing or truncated.');
  ensure(tv.getUint16(eocd+4,true)===0&&tv.getUint16(eocd+6,true)===0,'Multi-part ZIPs are not supported.');
  const count=tv.getUint16(eocd+10,true),size=tv.getUint32(eocd+12,true),offset=tv.getUint32(eocd+16,true);
  ensure(count===tv.getUint16(eocd+8,true)&&count!==65535&&size!==0xffffffff&&offset!==0xffffffff,'ZIP64 and multi-part ZIPs are not supported.');
  ensure(count<=5000&&offset+size<=start+eocd&&size<=6*1024*1024,'The ZIP directory is invalid or too large.');
  const directory=new Uint8Array(await file.slice(offset,offset+size).arrayBuffer());const dv=new DataView(directory.buffer);
  const index=new Map();let p=0,total=0;
  for(let i=0;i<count;i++){
    ensure(p+46<=directory.length&&dv.getUint32(p,true)===0x02014b50,'The ZIP directory is corrupt.');
    const flags=dv.getUint16(p+8,true),method=dv.getUint16(p+10,true),crc=dv.getUint32(p+16,true),compressed=dv.getUint32(p+20,true),expanded=dv.getUint32(p+24,true);
    const nameLength=dv.getUint16(p+28,true),extra=dv.getUint16(p+30,true),comment=dv.getUint16(p+32,true),local=dv.getUint32(p+42,true);
    ensure(!(flags&1),'Encrypted ZIPs are not supported.');ensure(method===0||method===8,'This ZIP uses an unsupported compression method.');
    ensure(compressed!==0xffffffff&&expanded!==0xffffffff&&local!==0xffffffff,'ZIP64 entries are not supported.');
    ensure(local+30+compressed<=offset,'A ZIP entry points outside its data area.');
    ensure(p+46+nameLength+extra+comment<=directory.length,'A ZIP directory entry is truncated.');
    const nameBytes=directory.subarray(p+46,p+46+nameLength);
    ensure((flags&2048)||nameBytes.every(x=>x<128),'Use the folder picker for ZIP filenames that are not UTF-8.');
    let name;try{name=new TextDecoder('utf-8',{fatal:true}).decode(nameBytes);}catch{throw Error('A ZIP filename has invalid UTF-8 encoding.');}
    const isDirectory=name.endsWith('/');const safe=safePath(isDirectory?name.slice(0,-1):name);
    ensure(!index.has(safe.toLowerCase()),`Duplicate ZIP path: ${safe}`);
    if(!isDirectory){total+=expanded;ensure(total<=limit,'The expanded ZIP exceeds the 1 GB browser limit.');index.set(safe.toLowerCase(),{path:safe,crc,size:expanded});}
    p+=46+nameLength+extra+comment;
  }
  ensure(p===directory.length,'The ZIP directory has unexpected trailing bytes.');
  return index;
}
