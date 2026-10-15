import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';

// Packing only: preserve generated source masters and alpha; no painted content is fabricated here.
const parts = ['head','torso','pelvis','backpack','rear-upper-arm','rear-forearm','front-upper-arm','front-forearm','rear-thigh','rear-shin','front-thigh','front-shin','rifle','shield','saber','binder'];
const report = [];
for (const unit of ['hero','rival']) {
  const source = `source-art/sd-v3/${unit}-parts.png`;
  const metadata = await sharp(source).metadata();
  if (!metadata.hasAlpha) throw new Error(`${source} requires genuine alpha`);
  const width = metadata.width, height = metadata.height;
  const {data:pixels}=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const labels=new Int32Array(width*height),components=[];let serial=0;
  for(let i=0;i<width*height;i++){
    if(labels[i]||pixels[i*4+3]<=24)continue;
    serial++;const queue=[i];labels[i]=serial;let x0=width,y0=height,x1=0,y1=0;
    for(let k=0;k<queue.length;k++){
      const p=queue[k],x=p%width,y=Math.floor(p/width);x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);
      for(const n of [x?p-1:-1,x<width-1?p+1:-1,p-width,p+width])if(n>=0&&n<width*height&&!labels[n]&&pixels[n*4+3]>24){labels[n]=serial;queue.push(n);}
    }
    if(queue.length>1500)components.push({id:serial,count:queue.length,x0,y0,x1,y1});
  }
  const cells=new Map();
  for(const part of components){const cell=Math.min(3,Math.floor((part.x0+part.x1)/2/(width/4)))+4*Math.min(3,Math.floor((part.y0+part.y1)/2/(height/4)));if(!cells.has(cell)||cells.get(cell).count<part.count)cells.set(cell,part);}
  if(cells.size!==16)throw new Error(`${unit}: expected16 isolated parts, found ${cells.size} (${components.length} components)`);
  await mkdir(`public/game/sd/${unit}`, {recursive:true});
  for (const [i,part] of parts.entries()) {
    const c=cells.get(i),left=Math.max(0,c.x0-2),top=Math.max(0,c.y0-2),cropWidth=Math.min(width,c.x1+3)-left,cropHeight=Math.min(height,c.y1+3)-top;
    const data=Buffer.alloc(cropWidth*cropHeight*4);
    for(let y=0;y<cropHeight;y++)for(let x=0;x<cropWidth;x++){
      const p=(y+top)*width+x+left;
      if(labels[p]&&components.some(other=>other.id===labels[p]&&other.id!==c.id))continue;
      pixels.copy(data,(y*cropWidth+x)*4,p*4,p*4+4);
    }
    const out=`public/game/sd/${unit}/${part}.webp`;
    const result=await sharp(data,{raw:{width:cropWidth,height:cropHeight,channels:4}}).resize({width:256,height:256,fit:'inside',withoutEnlargement:true,kernel:'nearest'}).webp({lossless:true}).toFile(out);
    report.push({unit,part,file:out,width:result.width,height:result.height,bytes:result.size,sourceBounds:{left,top,width:cropWidth,height:cropHeight}});
  }
}
for(const unit of ['hero','rival'])await sharp(`source-art/sd-v3/pilot-${unit}.png`).resize(1600,900,{fit:'cover'}).webp({quality:94}).toFile(`public/game/sd/pilot-${unit}.webp`);
await sharp('source-art/sd-v3/battlefield.png').resize(1600,900,{fit:'cover'}).webp({quality:91}).toFile('public/game/sd/battlefield.webp');
await writeFile('public/game/sd/parts-manifest.json',JSON.stringify({version:3,parts:report},null,2));
console.log(`Prepared ${report.length} alpha rig parts, two action pilot cut-ins, one battle background.`);
