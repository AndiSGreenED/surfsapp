// Minimaler FIT-Leser (ohne Bibliotheken). Liest Definitionen, Daten, Entwicklerfelder.
(function(root){
const BT={0:['u8',1],1:['s8',1],2:['u8',1],3:['s16',2],4:['u16',2],5:['s32',4],6:['u32',4],7:['str',1],8:['f32',4],9:['f64',8],10:['u8',1],11:['u16',2],12:['u32',4],13:['bytes',1],14:['s64',8],15:['u64',8],16:['u64',8]};
const INVALID={u8:255,s8:127,u16:65535,s16:32767,u32:4294967295,s32:2147483647};
function readVal(dv,off,bt,len,le){
  const t=(BT[bt&0x1f]||['u8',1]);const ty=t[0],sz=t[1];
  if(ty==='str'){let s='';for(let i=0;i<len;i++){const c=dv.getUint8(off+i);if(!c)break;s+=String.fromCharCode(c)}return s}
  if(ty==='bytes'||len>sz&&sz===1&&ty==='u8'&&len>1&&false){return null}
  const n=Math.floor(len/sz);if(n<1)return null;
  const one=(o)=>{switch(ty){case'u8':return dv.getUint8(o);case's8':return dv.getInt8(o);case'u16':return dv.getUint16(o,le);case's16':return dv.getInt16(o,le);case'u32':return dv.getUint32(o,le);case's32':return dv.getInt32(o,le);case'f32':return dv.getFloat32(o,le);case'f64':return dv.getFloat64(o,le);case'u64':return Number(dv.getBigUint64(o,le));case's64':return Number(dv.getBigInt64(o,le));}return null};
  const bad=(v)=>INVALID[ty]!==undefined&&v===INVALID[ty];
  if(n===1){const v=one(off);return bad(v)?null:v}
  const a=[];for(let i=0;i<n;i++){const v=one(off+i*sz);a.push(bad(v)?null:v)}return a;
}
function parse(buf){
  const dv=new DataView(buf);
  const hs=dv.getUint8(0);const dsz=dv.getUint32(4,true);
  if(String.fromCharCode(dv.getUint8(8),dv.getUint8(9),dv.getUint8(10),dv.getUint8(11))!=='.FIT')throw new Error('Keine FIT-Datei');
  let p=hs;const end=Math.min(buf.byteLength-2,hs+dsz);
  const defs={};const out={records:[],sessions:[],laps:[],events:[],devIds:[],devFields:[],other:{}};
  let lastTs=0;
  const fdesc={}; // key devIdx:fieldNum -> {name,units,type,base}
  while(p<end){
    const h=dv.getUint8(p++);
    if(h&0x80){ // compressed timestamp
      const lt=(h>>5)&3;const d=defs[lt];if(!d)throw new Error('Definition fehlt');
      const off=h&0x1f;let ts=(lastTs&~0x1f)+off;if(ts<lastTs)ts+=0x20;lastTs=ts;
      p=data(d,p,ts);continue;
    }
    const lt=h&0x0f;
    if(h&0x40){ // definition
      const hasDev=!!(h&0x20);p++;const arch=dv.getUint8(p++);const le=arch===0;
      const gm=dv.getUint16(p,le);p+=2;const nf=dv.getUint8(p++);const fields=[];
      for(let i=0;i<nf;i++){fields.push({num:dv.getUint8(p),size:dv.getUint8(p+1),bt:dv.getUint8(p+2)});p+=3}
      const dfields=[];
      if(hasDev){const nd=dv.getUint8(p++);for(let i=0;i<nd;i++){dfields.push({num:dv.getUint8(p),size:dv.getUint8(p+1),idx:dv.getUint8(p+2)});p+=3}}
      defs[lt]={gm,le,fields,dfields};
    } else {
      const d=defs[lt];if(!d)throw new Error('Definition fehlt');
      p=data(d,p,null);
    }
  }
  function data(d,p,cts){
    const m={};
    for(const f of d.fields){m[f.num]=readVal(dv,p,f.bt,f.size,d.le);p+=f.size}
    const dev={};
    for(const f of d.dfields){
      const k=f.idx+':'+f.num;const ds=fdesc[k];
      if(ds){dev[ds.name]=readVal(dv,p,ds.base,f.size,d.le)}
      p+=f.size;
    }
    if(cts!==null)m[253]=cts; if(m[253]!=null)lastTs=m[253];
    const g=d.gm;
    if(g===20){out.records.push({t:m[253],lat:m[0],lon:m[1],alt:m[78]!=null?m[78]/5-500:(m[2]!=null?m[2]/5-500:null),dist:m[5]!=null?m[5]/100:null,spd:m[73]!=null?m[73]/1000:(m[6]!=null?m[6]/1000:null),hr:m[3],temp:m[13],dev})}
    else if(g===18)out.sessions.push({m,dev});
    else if(g===19)out.laps.push({m,dev});
    else if(g===21)out.events.push(m);
    else if(g===207)out.devIds.push(m);
    else if(g===206){const nm=m[3],un=m[8];const name=(typeof nm==='string'?nm:'')||('Feld '+m[1]);fdesc[m[0]+':'+m[1]]={name,units:typeof un==='string'?un:'',base:m[2],idx:m[0],num:m[1]};out.devFields.push({idx:m[0],num:m[1],name,units:typeof un==='string'?un:'',base:m[2],native:m[14]})}
    else{out.other[g]=(out.other[g]||0)+1}
    return p;
  }
  return out;
}
root.FIT={parse};
})(typeof window!=='undefined'?window:globalThis);
