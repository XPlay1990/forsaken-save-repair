import {assertUniquePaths} from './repair.mjs';

// Serialized saves contain Blizzard/<original checkpoint> references.
// Only rename main files; retain every companion path and gameplay byte.
export function planBundleNames(entries,rows,{reservedPaths=[]}={}){
  assertUniquePaths(entries);
  const paths=new Map(entries.map(entry=>[entry.path,entry.path]));
  const occupied=new Set();
  for(const path of [...entries.map(entry=>entry.path),...reservedPaths]){
    const parts=path.toLowerCase().split('/');
    for(let i=1;i<=parts.length;i++)occupied.add(parts.slice(0,i).join('/'));
  }
  for(const row of rows){
    if(!['repair','current'].includes(row.status))continue;
    const parts=row.path.split('/');const file=parts.pop();
    if(parts.some(part=>/^(blizzard|customsaves)$/i.test(part)))continue;
    const stem=file.slice(0,-4);const extension=file.slice(-4);
    if(stem.toLowerCase()===row.mapId)continue;
    if(/_repaired(?:_\d+)?$/i.test(stem))continue;
    const parent=parts.length?parts.join('/')+'/':'';
    let name=`${stem}_repaired`,counter=2;
    while(occupied.has(`${parent}${name}${extension}`.toLowerCase()))name=`${stem}_repaired_${counter++}`;
    const output=`${parent}${name}${extension}`;
    paths.set(row.path,output);occupied.add(output.toLowerCase());
  }
  assertUniquePaths(Array.from(paths.values(),path=>({path})));
  const renamed=Array.from(paths,([from,to])=>({from,to})).filter(item=>item.from!==item.to);
  return {paths,renamed};
}
