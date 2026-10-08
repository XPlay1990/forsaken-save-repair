import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './save-fixture.mjs';

test('worker lists a collection larger than 1 GB without reading any save and applies the size limit only after selection',async()=>{
  const messages=[];globalThis.self={postMessage:message=>messages.push(message)};
  await import('../dist/worker.mjs');
  let reads=0;
  const fake=(path,size)=>({name:path.split('/').at(-1),webkitRelativePath:path,size,arrayBuffer(){reads++;throw Error('Unselected bytes must not be read');}});
  const files=[fake('ForsakenKingdom/small.w3z',10),fake('ForsakenKingdom/large.w3z',2*1024**3),fake('ForsakenKingdom/Blizzard/large/UndeadRE01.w3z',2*1024**3)];
  await self.onmessage({data:{type:'listFolder',files}});
  assert.equal(reads,0);assert.equal(messages.some(message=>message.type==='error'),false);
  assert.equal(messages.at(-1).type,'checkpoints');assert.equal(messages.at(-1).checkpoints.length,2);
  await self.onmessage({data:{type:'checkpoint',path:files[1].webkitRelativePath}});
  assert.equal(reads,0);assert.equal(messages.at(-1).type,'error');assert.match(messages.at(-1).message,/individual save exceeds/);
  await self.onmessage({data:{type:'analyze',files:[fake('campaign.zip',10)]}});
  assert.equal(reads,0);assert.equal(messages.at(-1).type,'error');assert.match(messages.at(-1).message,/Unknown operation/);
  const data=fixture().data;
  const unrecognizedPath=path=>({name:path.split('/').at(-1),webkitRelativePath:path,size:data.length,arrayBuffer:async()=>data.buffer});
  await self.onmessage({data:{type:'listFolder',files:[unrecognizedPath('ForsakenKingdom/save.w3z'),unrecognizedPath('ForsakenKingdom/Blizzard/save/UndeadRE01.w3z')]}});
  await self.onmessage({data:{type:'checkpoint',path:'ForsakenKingdom/save.w3z'}});
  await self.onmessage({data:{type:'export'}});
  assert.equal(messages.at(-1).type,'error');assert.match(messages.at(-1).message,/No supported saved folder references/);
  assert.equal(messages.some(message=>message.type==='exported'),false,'A main save with unrecognized path records must never export a renamed folder');
  delete globalThis.self;
});
