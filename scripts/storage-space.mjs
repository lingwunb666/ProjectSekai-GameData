// Filesystem preflight only: not an OS reservation or a replacement for a caller's workspace budget.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

export const FREE_RESERVE=2n*1024n**3n;
export function existingDirectory(directory) {
  let nearest;
  for(let current=path.resolve(directory);;current=path.dirname(current)) {
    const stat=fs.lstatSync(current,{throwIfNoEntry:false});
    assert(!stat?.isSymbolicLink(),'linked storage path is forbidden');
    if(stat&&!nearest){assert(stat.isDirectory(),'storage parent is not a directory');nearest=current;}
    if(path.dirname(current)===current)break;
  }
  assert(nearest,'storage filesystem is unavailable');return nearest;
}

export function requireSpace(directory,pendingBytes) {
  assert(Number.isSafeInteger(pendingBytes)&&pendingBytes>=0,'invalid pending storage size');
  const current=existingDirectory(directory),stat=fs.statfsSync(current,{bigint:true});
  assert(typeof stat.bsize==='bigint'&&stat.bsize>0n&&typeof stat.bavail==='bigint'&&stat.bavail>=0n,
    'filesystem available space is unknown');
  const available=stat.bsize*stat.bavail,required=BigInt(pendingBytes)+FREE_RESERVE;
  assert(available>=required,`Insufficient image storage: need ${required} available bytes including 2 GiB reserve; found ${available}`);
}

export function requireDownloadSpace(directory,pendingBytes,restoreDirectory,restoreBytes=0) {
  if(!restoreDirectory){requireSpace(directory,pendingBytes);return;}
  const source=existingDirectory(directory),destination=existingDirectory(restoreDirectory);
  const same=fs.statSync(source,{bigint:true}).dev===fs.statSync(destination,{bigint:true}).dev;
  if(same)requireSpace(source,pendingBytes+restoreBytes);
  else {requireSpace(source,pendingBytes);requireSpace(destination,restoreBytes);}
}
