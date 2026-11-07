const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, delay, makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs-extra');
const { join } = require('path');
const http = require('http');
const readline = require('readline');

// === WEB SERVER FOR RENDER PORT ===
const PORT = process.env.PORT || 3000;
http.createServer((req,res)=>{
  res.writeHead(200, {'Content-Type':'text/plain'});
  res.end('MAVERICK PREMIUM v4 - 350+ CMDS ACTIVE ✅\nBot is running permanent!');
}).listen(PORT, ()=> console.log(`🌐 Server running on port ${PORT}`));

const rl = readline.createInterface({input: process.stdin, output: process.stdout});
const question = (t)=> new Promise(r=>rl.question(t,r));

async function startBot(){
  const { state, saveCreds } = await useMultiFileAuthState('./session');
  const sock = makeWASocket({
    auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, pino({level:'silent'})) },
    logger: pino({level:'silent'}),
    browser: ['Maverick Premium','Chrome','1.0'],
    printQRInTerminal: false
  });

  if(!sock.authState.creds.registered){
    try{
      const num = process.env.PHONE_NUMBER || await question("Enter WhatsApp number (234...): ");
      if(num){
        const code = await sock.requestPairingCode(num.trim());
        console.log(`\n🔑 PAIRING CODE: ${code}\nGo WhatsApp > Linked Devices > Link with phone number\n`);
      }
    }catch(e){ console.log("Pairing error:", e.message); }
  }

  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('messages.upsert', async ({messages})=>{
    try{
      const m = messages[0]; if(!m.message) return;
      const from = m.key.remoteJid;
      const body = m.message.conversation || m.message.extendedTextMessage?.text || "";
      if(!body.startsWith(".")) return;
      const args = body.slice(1).trim().split(/ +/);
      const cmdName = args.shift().toLowerCase();
      const path = join(__dirname,'commands',`${cmdName}.js`);
      if(fs.existsSync(path)){
        delete require.cache[require.resolve(path)];
        const cmd = require(path);
        await cmd(sock,m,args,{from});
      }
    }catch(e){console.log(e.message)}
  });
  sock.ev.on('connection.update', async (u)=>{
    if(u.connection==='close' && u.lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut){ await delay(3000); startBot(); }
    if(u.connection==='open'){ console.log('✅ MAVERICK CONNECTED - 350 CMDS READY'); }
  });
}
startBot();
