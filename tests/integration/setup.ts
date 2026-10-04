import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';

export default function setup(){
  const root=process.cwd(),db=path.resolve(root,'storage/database/integration.db');
  for(const suffix of ['','-wal','-shm']){const target=db+suffix;if(fs.existsSync(target))fs.rmSync(target)}
  new DatabaseSync(db).close();
  execFileSync(process.execPath,[path.resolve(root,'node_modules/prisma/build/index.js'),'migrate','deploy'],{cwd:root,env:{...process.env,DATABASE_URL:'file:../storage/database/integration.db'},stdio:'pipe'});
  return()=>{for(const suffix of ['','-wal','-shm']){const target=db+suffix;if(fs.existsSync(target))fs.rmSync(target)}};
}
