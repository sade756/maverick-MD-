const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, delay, makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs-extra');
const { join } = require('path');
const http = require('http');
const qs = require('querystring');

let PAIR_CODE = "";
let PAIR_STATUS = "Enter number below";
let CURRENT_SOCK = null;
let LAST_NUM = "";

async function getPairingCode(num){
  try{
    const { state, saveCreds } = await useMultiFileAuthState('./session');
    const sock = makeWASocket({
      auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, pino({level:'silent'})) },
      logger: pino({level:'silent'}),
      browser: ['Maverick Premium','Chrome','1.0'],
      printQRInTerminal: false
    });
    CURRENT_SOCK = sock;
    sock.ev.on('creds.update', saveCreds);
    if(state.creds.registered){
      PAIR_STATUS="✅ Already Connected!";
      PAIR_CODE="BOT CONNECTED";
      return;
    }
    await delay(2000);
    let code = await sock.requestPairingCode(num);
    code = code?.match(/.{1,4}/g)?.join('-') || code;
    PAIR_CODE = code;
    PAIR_STATUS = "✅ Code Ready!";
    
    sock.ev.on('connection.update', async (u)=>{
      if(u.connection==='open'){ PAIR_STATUS="✅ CONNECTED"; PAIR_CODE="CONNECTED ✅"; }
    });
  }catch(e){ PAIR_STATUS="❌ Error: "+e.message; }
}

const PORT = process.env.PORT || 3000;
http.createServer(async (req,res)=>{
  if(req.method==='POST'){
    let body=''; req.on('data',c=>body+=c);
    req.on('end', async ()=>{
      const data = qs.parse(body);
      const num = (data.number||'').replace(/[^0-9]/g,'');
      if(num){
        LAST_NUM=num;
        PAIR_CODE="Generating...";
        PAIR_STATUS="Generating for "+num.slice(0,3)+"****"+num.slice(-4);
        await getPairingCode(num);
      }
      res.writeHead(302,{Location:'/'});
      res.end();
    });
    return;
  }
  res.writeHead(200, {'Content-Type':'text/html'});
  res.end(`
  <html><head><meta name="viewport" content="width=device-width,initial-scale=1">
  <style>body{background:#0a0a0a;color:#fff;font-family:sans-serif;text-align:center;padding:20px}
  .box{background:#1a1a1a;border:2px solid #00ff88;border-radius:15px;padding:20px;margin:20px auto;max-width:420px}
  .code{font-size:32px;letter-spacing:5px;color:#00ff88;font-weight:bold;background:#000;padding:15px;border-radius:10px;margin:15px 0}
  input{width:90%;padding:12px;border-radius:8px;border:none;margin:10px 0;font-size:16px;text-align:center}
  .btn{background:#00ff88;color:#000;padding:12px 25px;border:none;border-radius:8px;font-weight:bold;font-size:16px;width:95%;cursor:pointer}
  </style></head><body>
  <h1>⚡ MAVERICK PREMIUM v4</h1>
  <div class="box">
  <h3>🔗 Pair Your WhatsApp</h3>
  <form method="POST">
  <input name="number" placeholder="Enter WhatsApp Number e.g 234805..." value="${LAST_NUM}" required>
  <button class="btn">Get Pairing Code</button>
  </form>
  <p>Status: ${PAIR_STATUS}</p>
  ${PAIR_CODE?`<h3>YOUR CODE:</h3><div class="code">${PAIR_CODE}</div><p>WhatsApp > Linked Devices > Link with phone number</p>`:''}
  <p style="font-size:12px;color:#888">Bot has 350+ Commands | .menu to start</p>
  </div>
  </body></html>
  `);
}).listen(PORT, ()=> console.log(`WEB OK ${PORT}`));

// Auto start if env has number
if(process.env.PHONE_NUMBER){
  LAST_NUM = process.env.PHONE_NUMBER;
  getPairingCode(process.env.PHONE_NUMBER.replace(/[^0-9]/g,''));
}

// Keep bot listening for commands after pairing
(async()=>{
  const { state, saveCreds } = await useMultiFileAuthState('./session');
  const sock = makeWASocket({
    auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, pino({level:'silent'})) },
    logger: pino({level:'silent'}),
    browser: ['Maverick','Chrome','1.0'],
    printQRInTerminal: false
  });
  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('messages.upsert', async ({messages})=>{
    const m = messages[0]; if(!m?.message) return;
    const from = m.key.remoteJid;
    const body = m.message.conversation || m.message.extendedTextMessage?.text || "";
    if(!body.startsWith(".")) return;
    const args = body.slice(1).trim().split(/ +/);
    const cmdName = args.shift().toLowerCase();
    const path = join(__dirname,'commands',`${cmdName}.js`);
    if(fs.existsSync(path)){
      try{ delete require.cache[require.resolve(path)]; const cmd = require(path); await cmd(sock,m,args,{from}); }catch(e){}
    }
  });
})();
