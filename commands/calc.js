module.exports = async (sock,m,args)=>{ await sock.sendMessage(m.key.remoteJid,{text:'calc working ✅'}) }
