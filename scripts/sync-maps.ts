import 'dotenv/config';
import {prisma} from '../src/lib/db.js';
import {syncValorantMaps} from '../src/services/map-sync.js';

try{
  const result=await syncValorantMaps();
  console.log(`Synchronized ${result.data.length} maps in en-US, zh-TW, and zh-CN.`);
}finally{
  await prisma.$disconnect();
}
