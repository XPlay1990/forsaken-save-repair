import {assertUniquePaths} from './repair.mjs';

// Allocate one name for both the main save and its companion directory.
export function planBundleNames(entries,rows,{reservedPaths=[],checkpointPath,companionFolder}={}){
  assertUniquePaths(entries);
  const paths=new Map(entries.map(entry=>[entry.path,entry.path]));
  const main=rows.find(row=>(!checkpointPath||row.path===checkpointPath)&&['repair','current'].includes(row.status)&&!row.path.split('/').slice(0,-1).some(part=>/^(blizzard|customsaves)$/i.test(part))&&row.path.split('/').at(-1).slice(0,-4).toLowerCase()!==row.mapId);
  if(!main)return {paths,renamed:[],migration:null};
  const parent=main.path.slice(0,main.path.lastIndexOf('/')+1),file=main.path.split('/').at(-1),stem=file.slice(0,-4),extension=file.slice(-4);
  if(!companionFolder){
    const original=stem.replace(/_repaired(?:_\d+)?$/i,'');
    const candidate=entries.find(entry=>[stem,original].some(name=>!/^zones$/i.test(name)&&entry.path.toLowerCase().startsWith(`${parent}Blizzard/${name}/`.toLowerCase())));
    if(candidate)companionFolder=candidate.path.slice(0,parent.length+9)+candidate.path.slice(parent.length+9).split('/')[0];
  }
  const occupied=new Set();
  for(const path of [...entries.map(entry=>entry.path),...reservedPaths]){const parts=path.toLowerCase().split('/');for(let i=1;i<=parts.length;i++)occupied.add(parts.slice(0,i).join('/'));}
  const paired=/_repaired(?:_\d+)?$/i.test(stem)&&companionFolder?.split('/').at(-1).toLowerCase()===stem.toLowerCase();
  const base=stem.replace(/_repaired(?:_\d+)?$/i,'')+'_repaired';let name=paired?stem:base,counter=2;
  const folderParent=companionFolder?companionFolder.slice(0,companionFolder.lastIndexOf('/')+1):`${parent}Blizzard/`;
  if(!paired)while(occupied.has(`${parent}${name}${extension}`.toLowerCase())||occupied.has(`${folderParent}${name}`.toLowerCase()))name=`${base}_${counter++}`;
  const outputFolder=folderParent+name;paths.set(main.path,`${parent}${name}${extension}`);
  if(companionFolder){const prefix=companionFolder+'/';for(const entry of entries)if(entry.path.toLowerCase().startsWith(prefix.toLowerCase()))paths.set(entry.path,outputFolder+'/'+entry.path.slice(prefix.length));}
  assertUniquePaths(Array.from(paths.values(),path=>({path})));
  const renamed=Array.from(paths,([from,to])=>({from,to})).filter(item=>item.from!==item.to);
  return {paths,renamed,migration:{from:companionFolder,to:outputFolder,targetName:name,mainPath:main.path}};
}
