const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, delay, makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs-extra');
const { join } = require('path');

async function startBot(){
  const { state, saveCreds } = await useMultiFileAuthState('./session');
  const sock = makeWASocket({
    auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, pino({level:'silent'})) },
    logger: pino({level:'silent'}),
    browser: ['Maverick Premium','Chrome','1.0'],
    printQRInTerminal: false
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async ({messages})=>{
    try{
      const m = messages[0];
      if(!m.message) return;
      const from = m.key.remoteJid;
      const isGroup = from.endsWith('@g.us');
      const body = m.message.conversation || m.message.extendedTextMessage?.text || m.message.imageMessage?.caption || m.message.videoMessage?.caption || "";
      if(!body.startsWith(".")) return;
      
      const args = body.slice(1).trim().split(/ +/);
      const cmdName = args.shift().toLowerCase();
      const cmdPath = join(__dirname, 'commands', `${cmdName}.js`);
      
      if(fs.existsSync(cmdPath)){
        const cmd = require(cmdPath);
        await cmd(sock, m, args, {from, isGroup});
      } else if(cmdName === 'menu' || cmdName === 'list' || cmdName === 'allmenu'){
        // fallback if menu not exist
        const files = fs.readdirSync('./commands');
        await sock.sendMessage(from, {text: `*MAVERICK PREMIUM - ${files.length} COMMANDS*\n\n`+files.map(f=>`.${f.replace('.js','')}`).join('\n').slice(0,3500)});
      }
    }catch(e){ console.log("Cmd Error:", e.message); }
  });

  sock.ev.on('connection.update', async (u)=>{
    if(u.connection === 'close' && u.lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut){
      await delay(3000);
      startBot();
    }
    if(u.connection === 'open') console.log('✅ MAVERICK CONNECTED - READY FOR COMMANDS');
  });
}
startBot();
