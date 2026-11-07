const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, delay, makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs-extra');
const { join } = require('path');
async function startBot(){
  const { state, saveCreds } = await useMultiFileAuthState('./session');
  const sock = makeWASocket({
    auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, pino({level:'silent'})) },
    logger: pino({level:'silent'}),
    browser: ['Chrome (Linux)','',''],
    printQRInTerminal: false
  });
  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('messages.upsert', async ({messages})=>{
    try{
      const m = messages[0];
      if(!m.message) return;
      const text = m.message.conversation || "";
      if(!text.startsWith(".")) return;
      if(text === ".ping") await sock.sendMessage(m.key.remoteJid, {text: "Maverick active ✅"});
      if(text === ".menu") await sock.sendMessage(m.key.remoteJid, {text: "MAVERICK PREMIUM\n.ping\n.menu"});
    }catch(e){}
  });
  sock.ev.on('connection.update', async (u)=>{
    if(u.connection === 'close' && u.lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut){
      await delay(3000);
      startBot();
    }
    if(u.connection === 'open') console.log('✅ MAVERICK CONNECTED');
  });
}
startBot();
