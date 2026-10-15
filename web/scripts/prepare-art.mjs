import sharp from 'sharp';
import {mkdir} from 'node:fs/promises';
await mkdir('public/game/art',{recursive:true});
// Separate the four disconnected sprite drawings by alpha components; preserve source masters.
for (const unit of ['hero','rival']) {
 const {data,info}=await sharp(`source-art/${unit}-atlas-v2.png`).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const w=info.width,h=info.height,labels=new Int32Array(w*h),components=[];let id=0;
 for(let i=0;i<w*h;i++) {
  if(labels[i]||data[i*4+3]<24)continue;
  id++;const queue=[i];labels[i]=id;let minX=w,minY=h,maxX=0,maxY=0;
  for(let k=0;k<queue.length;k++) {const p=queue[k],x=p%w,y=Math.floor(p/w);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
   for(const n of [x>0?p-1:-1,x<w-1?p+1:-1,p-w,p+w])if(n>=0&&n<w*h&&!labels[n]&&data[n*4+3]>=24){labels[n]=id;queue.push(n);}
  }
  components.push({id,count:queue.length,minX,minY,maxX,maxY});
 }
 const main=components.filter(c=>c.count>20000).sort((a,b)=>Math.floor((a.minY+a.maxY)/h)-Math.floor((b.minY+b.maxY)/h)||a.minX-b.minX);
 if(main.length!==4)throw new Error(`Expected 4 separate ${unit} drawings, got ${main.length}`);
 const names=unit==='hero'?['idle','fire','dash','strike']:['idle','guard','strike','hit'];
 for(let i=0;i<main.length;i++) {
  const c=main[i],left=Math.max(0,c.minX-5),top=Math.max(0,c.minY-5),width=Math.min(w,c.maxX+6)-left,height=Math.min(h,c.maxY+6)-top;
  const pixels=Buffer.alloc(width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
   const source=(y+top)*w+x+left,label=labels[source];
   if(label && main.some(other=>other.id===label&&other.id!==c.id))continue;
   data.copy(pixels,(y*width+x)*4,source*4,source*4+4);
  }
  await sharp(pixels,{raw:{width,height,channels:4}}).resize(768,768,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).webp({quality:94,alphaQuality:100}).toFile(`public/game/art/${unit}-${names[i]}.webp`);
 }
}
for (const name of ['orbit','impact']) await sharp(`source-art/${name}-v2.png`).resize(1920,1080,{fit:'cover'}).webp({quality:90}).toFile(`public/game/art/${name}.webp`);
console.log('8 transparent sprite poses and 2 cinematic paintings prepared. Source masters preserved.');
