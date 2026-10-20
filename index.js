// ─────────────────────────────────────────────────────────────────
// GLOBAL CRASH PROTECTION
// Without these, a single unexpected error anywhere (a bad API
// response from a downloader, a Mongo hiccup, a malformed message,
// etc.) throws all the way up and kills the entire Node process —
// which instantly drops EVERY connected WhatsApp session at once.
// That is what shows up to users as "sessions closing" and "commands
// randomly not working" (the process crashed and is being restarted,
// or has died and nothing is left running). Logging and continuing
// keeps the bot alive; only the one message/request that errored is
// lost instead of the whole bot.
// ─────────────────────────────────────────────────────────────────
process.on('uncaughtException', (err) => {
    console.error('❌ [uncaughtException] Bot stayed alive, but this needs fixing:', err && err.stack || err);
});
process.on('unhandledRejection', (reason) => {
    console.error('❌ [unhandledRejection] Bot stayed alive, but this needs fixing:', reason && reason.stack || reason);
});

const { 
    downloadMediaMessage, 
    generateWAMessageFromContent, 
    proto 
} = require('@whiskeysockets/baileys');
const express = require('express');
const app = express();
__path = process.cwd()
const bodyParser = require("body-parser");
const PORT = process.env.PORT || 5000;
let code = require('./pair'); 

require('events').EventEmitter.defaultMaxListeners = 500;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/code', code);
app.use('/pair', async (req, res, next) => {
    res.sendFile(__path + '/pair.html')
});
app.use('/dashboard', async (req, res, next) => {
    res.sendFile(__path + '/dashboard.html')
});
app.use('/adminpanel', async (req, res, next) => {
    res.sendFile(__path + '/adminpanel.html')
});
app.use('/', async (req, res, next) => {
    res.sendFile(__path + '/main.html')
});

const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`
SAYURI MINI RUNNING ✅

░██    ░██         ░███
░██    ░██      ░██   ░██
░██████        ░██     ░██
░██    ░██      ░██   ░██
░██     ░██  ██   ░███    ██


Server running on http://localhost:` + PORT)
});

server.keepAliveTimeout = 120000;
server.headersTimeout = 125000;

// ─────────────────────────────────────────────────────────────────
// GRACEFUL SHUTDOWN — closes every live WhatsApp socket and releases
// the instance lock (see pair.js) the moment the platform asks this
// process to stop (redeploy, restart, manual restart, Ctrl+C). Without
// this, the OLD process keeps its sockets open during its shutdown
// grace period while the NEW process is already restoring the SAME
// sessions from Mongo — two live sockets on one WhatsApp session is
// exactly what causes "Bad MAC" and random session-close errors on
// every redeploy.
// ─────────────────────────────────────────────────────────────────
let __shuttingDown = false;
async function handleShutdown(signal) {
    if (__shuttingDown) return;
    __shuttingDown = true;
    console.log(`\n🛑 [SAYURI MINI] Received ${signal} — shutting down gracefully...`);
    try {
        if (typeof code.gracefulShutdown === 'function') {
            await code.gracefulShutdown();
        }
    } catch (e) {
        console.error('Shutdown error:', e);
    }
    server.close(() => process.exit(0));
    // Safety net in case something hangs (e.g. a slow Mongo call) — never
    // let a stuck shutdown block the host from restarting the app.
    setTimeout(() => process.exit(0), 5000).unref();
}
process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

setInterval(() => {
    const http = require('http');
    const req = http.get(`http://localhost:${PORT}/code/ping`, (res) => {
        res.resume();
    });
    req.on('error', () => {});
    req.end();
}, 4 * 60 * 1000);

module.exports = app;
