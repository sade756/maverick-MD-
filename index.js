const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, delay, makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs-extra');
const { join } = require('path');
const http = require('http');

// === RENDER PORT FIX ===
const PORT = process.env.PORT || 3000;
http.createServer((req,res)=>{
  res.writeHead(200, {'Content-Type':'text/html'});
  res.end('<h1>MAVERICK PREMIUM v4 ✅</h1><p>Bot Active - 350+ Commands</p><p>Pairing Code in Logs</p>');
}).listen(PORT, ()=> console.log(`PORT ${PORT} OK`));

async function startBot(){
  const { state, saveCreds } = await useMultiFileAuthState('./session');
  const sock = makeWASocket({
    auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, pino({level:'silent'})) },
    logger: pino({level:'silent'}),
    browser: ['Maverick Premium','Chrome','1.0'],
    printQRInTerminal: false
  });

  // === BETTER PAIRING - NO READLINE ===
  if(!sock.authState.creds.registered){
    const num = (process.env.PHONE_NUMBER || '').replace(/[^0-9]/g,'');
    if(!num){
      console.log('❌ Set PHONE_NUMBER in Render Environment!');
      console.log('Example: 2348058569191');
      return;
    }
    await delay(3000);
    try{
      let code = await sock.requestPairingCode(num);
      code = code?.match(/.{1,4}/g)?.join('-') || code;
      console.log(`\n================================\n🔑 PAIRING CODE FOR ${num}: ${code}\n================================\n\n1. Open WhatsApp\n2. Linked Devices > Link with phone number\n3. Enter: ${code}\n\n`);
    }catch(e){
      console.log('Pairing error:', e.message, '- retry in 10s');
      await delay(10000);
      startBot();
    }
  }

  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('messages.upsert', async ({messages})=>{
    const m = messages[0]; if(!m.message) return;
    const from = m.key.remoteJid;
    const body = m.message.conversation || m.message.extendedTextMessage?.text || "";
    if(!body.startsWith(".")) return;
    const args = body.slice(1).trim().split(/ +/);
    const cmdName = args.shift().toLowerCase();
    const path = join(__dirname,'commands',`${cmdName}.js`);
    if(fs.existsSync(path)){
      try{
        delete require.cache[require.resolve(path)];
        const cmd = require(path);
        await cmd(sock,m,args,{from});
      }catch(e){console.log(e)}
    }
  });
  sock.ev.on('connection.update', async (u)=>{
    if(u.connection==='close' && u.lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut){ await delay(3000); startBot(); }
    if(u.connection==='open'){ console.log('✅ CONNECTED - Type .menu'); }
  });
}
startBot();
