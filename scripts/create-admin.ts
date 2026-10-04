import 'dotenv/config';
import readline from 'node:readline/promises';
import {stdin as input,stdout as output} from 'node:process';
import {prisma} from '../src/lib/db.js';
import {hashSecret} from '../src/lib/security.js';

async function hiddenPassword(prompt:string){
  if(!input.isTTY||typeof input.setRawMode!=='function')throw new Error('Password creation requires an interactive terminal');
  output.write(prompt);input.setRawMode(true);input.resume();input.setEncoding('utf8');let value='';
  return await new Promise<string>((resolve,reject)=>{const onData=(key:string)=>{if(key==='\u0003'){cleanup();reject(new Error('Cancelled'))}else if(key==='\r'||key==='\n'){cleanup();output.write('\n');resolve(value)}else if(key==='\u007f'||key==='\b'){if(value){value=value.slice(0,-1);output.write('\b \b')}}else if(key>=' '){value+=key;output.write('*')}};const cleanup=()=>{input.off('data',onData);input.setRawMode(false);input.pause()};input.on('data',onData)});
}

const rl=readline.createInterface({input,output});
const username=(await rl.question('Pulse Studio admin username: ')).trim();
rl.close();
const password=await hiddenPassword('Password (12+ characters): ');
if(username.length<3||password.length<12)throw new Error('Username or password is too short');
const passwordHash=await hashSecret(password);
await prisma.adminUser.upsert({where:{username},update:{passwordHash,disabledAt:null},create:{username,passwordHash}});
console.log('Pulse Studio administrator created.');
await prisma.$disconnect();
