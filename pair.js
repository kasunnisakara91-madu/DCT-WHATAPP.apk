
// ====================================================
// 𝘒𝘌𝘡𝘜 𝘕𝘌𝘞 𝘔𝘖𝘝𝘐𝘌 𝘉𝘖𝘛 𝘊𝘈𝘚𝘌 𝘊𝘖𝘓𝘓𝘌𝘊𝘛𝘐𝘖𝘕 (#𝘗𝘙𝘖𝘍𝘐𝘟 ) 𝘈𝘐
// ====================================================

const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const router = express.Router();

// ───────────────────── LAZY LOADER (RAM saver) ─────────────────
// Heavy libraries (Jimp, scrapers, downloaders) used to be loaded the
// moment the bot started, even if nobody ever used those commands. Each
// one costs tens of MB of RAM. Now they are only loaded on first use.
function lazyRequire(id) {
  let mod;
  const load = () => (mod === undefined ? (mod = require(id)) : mod);
  return new Proxy(function () {}, {
    get: (_, k) => load()[k],
    set: (_, k, v) => { load()[k] = v; return true; },
    has: (_, k) => k in load(),
    apply: (_, thisArg, args) => { const m = load(); return (typeof m === 'function' ? m : m.default).apply(thisArg, args); },
    construct: (_, args) => new (load())(...args)
  });
}
const pino = require('pino');
const moment = require('moment-timezone');
const Jimp = lazyRequire('jimp');
const crypto = require('crypto');
const axios = require('axios');
const FileType = lazyRequire('file-type');
const fetch = lazyRequire('node-fetch');
const yts = lazyRequire('yt-search');
const yt = lazyRequire('@vreden/youtube_scraper');
const getFbVideoInfo = (...a) => require('fb-downloader-scrapper').getFbVideoInfo(...a);
const getFBInfo = lazyRequire('@xaviabot/fb-downloader');
const TiktokDL = lazyRequire('@tobyg74/tiktok-api-dl');
const Pinterest = lazyRequire('@myno_21/pinterest-scraper');
const { MongoClient } = require('mongodb');
let cheerio;
try { cheerio = require('cheerio'); } catch (e) { cheerio = null; }
require('dotenv').config();

const {
  default: makeWASocket,
  useMultiFileAuthState,
  delay,
  getContentType,
  makeCacheableSignalKeyStore,
  Browsers,
  jidNormalizedUser,
  downloadContentFromMessage,
  generateWAMessageFromContent,
  proto,
  DisconnectReason,
  META_AI_JID,
  fetchLatestBaileysVersion,
  BufferJSON
} = require('@whiskeysockets/baileys');

// ───────────────────── FFMPEG SETUP ───────────────────────────
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(ffmpegPath);

// ───────────────────── DEFAULT CONFIG ───────────────────────────
const DEFAULT_BOT_NAME = 'SAYURI MINI';

const MAX_MEDIA_BYTES = 64 * 1024 * 1024; // hard cap for in-RAM downloads (one huge file can no longer crash the bot)

const config = {
  BOT_NAME: DEFAULT_BOT_NAME,
  PREFIX: '.',
  AUTO_VIEW_STATUS: 'true',
  AUTO_LIKE_STATUS: 'true',
  AUTO_RECORDING: 'false',
  AUTO_TYPING: 'false',
  ANTI_DELETE: 'off',
  AUTO_CHANNEL_REACT: 'false',
  ANTI_CALL: 'false',
  MODE: 'public', // public | private | inbox | group — sudo/owner numbers always bypass this
  AUTO_LIKE_EMOJI: ['🌙','🪻','🌷'],
  OWNER_NUMBER: process.env.OWNER_NUMBER || '94784420567',
  OWNER_NAME: '𝐊ᴇᴢᴜ𝚄 🪻||𝒑͠𝒂̶𝒃̶𝒍͟𝒐͟🌙⃘̬ٜٜٜ͠',
  NEWSLETTER_JID: '120363144038483540@newsletter',
  NEWSLETTER_NAME: 'SAYURI MINI Official',
  DEFAULT_LOGO: 'https://i.ibb.co/TxXq1FXN/file-0000000092588211a93a85f1bca9961c.png',
  BOT_FOOTER: '> *ᴘᴏᴡᴇʀᴇᴅ ʙʏ SAYU⃘̬ٜٜٜ*',
  API_YT_ALL_URL: 'https://nexoraapi.laksidunimsara.com/api/youtube/all',
  NEXORA_API_KEY: 'lakiya_46d6ceb9bed1f0de0181c9d6c91cbe05bdba0bb16d3498b46a61f118f4b40f37',
  API_MAIN_URL1: 'https://api.chamindu.site/',
  API_KEY_1:'chama_api_7f4ac9c10c749bcedbd4437a066009a2',
  MOVIE_FOOTER:"© SAYURI-MINI ",
  BOT_VERSION: 'PRO'
};

// ───────────────────── TRUTH / DARE / RPS DATA ───────────────────
const TRUTH_QUESTIONS = [
  'ඔයාගේ ලයිෆ් එකේ තියෙන පොඩිම සීක්‍රට් එක මොකක්ද?',
  'මේ වෙනකන් කරපු වඩාත්ම ලැජ්ජ දෙයක් මොකක්ද?',
  'ඔයාට කවදාහරි කෙනෙක්ට රහසින් ආදරෙයි කියලා තියෙනවද?',
  'ඔයාගේ phone එකේ password එක කියන්න පුළුවන්ද?',
  'ජීවිතේ කරපු වැරදිම තීරණය මොකක්ද?',
  'ඔයාට තියෙන වඩාත්ම විහිලු බියක් මොකක්ද?',
  'අන්තිමට කවුරුහරි ගැන බොරුවක් කිව්වේ කවදද, මොකක්ද?',
  'මේ group එකේ කාව හරිම ආදරෙයිද?',
  'ඔයා කවදාහරි කෙනෙක්ගේ message බලලා තියෙනවද?',
  'ඔයාගේ crush කවුද?'
];

const DARE_TASKS = [
  'ඊළඟට එවන message එකේ emoji විතරක් 20ක් යවන්න.',
  'ඔයාගේ status එකට හරිම විහිලු photo එකක් දාන්න.',
  'මේ group එකේ කෙනෙක්ට sweet voice message එකක් යවන්න.',
  '1 minute pura ඕන කෙනෙක්ට කතා නොකර ඉන්න.',
  'ඔයාගේ last 5 messages screenshot එකක් යවන්න.',
  'Group profile picture එකට 10 minutes funny photo එකක් දාන්න.',
  'Voice note එකෙන් ගීතයක් කියලා යවන්න.',
  '3 කෙනෙක්ට "ඔයාට කැමතියි" කියලා message යවන්න (විහිලුවට විතරයි 😂).',
  'ඔයාගේ phone gallery එකේ අන්තිම photo එක යවන්න.',
  'ඊළඟ 5 messages CAPS LOCK එකෙන් විතරක් type කරන්න.'
];

const RPS_CHOICES = { rock: '🪨', paper: '📄', scissors: '✂️' };
const RPS_ALIASES = {
  rock: 'rock', r: 'rock', '🪨': 'rock', ගල: 'rock',
  paper: 'paper', p: 'paper', '📄': 'paper', කඩදාසි: 'paper',
  scissors: 'scissors', s: 'scissors', '✂️': 'scissors', ඉකට්ටුව: 'scissors'
};

// ───────────────────── MONGO DATABASE SETUP ─────────────────────
const MONGO_URI = process.env.MONGO_URI;
const MONGO_DB = process.env.MONGO_DB;
let mongoClient, mongoDB;
let sessionsCol, numbersCol, configsCol, groupSettingsCol, customRepliesCol, locksCol;

const userConfigCache = new Map();
const USER_CONFIG_CACHE_TTL = 5 * 60 * 1000;

// Same idea as userConfigCache — avoids a MongoDB round-trip on every
// single incoming group message (this was the main cause of the bot
// feeling "slow" under load).
const groupSettingsCache = new Map();
const GROUP_SETTINGS_CACHE_TTL = 2 * 60 * 1000;

let _mongoReady = false;
async function initMongo() {
  if (_mongoReady) return;
  try {
    if (mongoClient?.topology?.isConnected?.()) {
      _mongoReady = true;
      return;
    }
  } catch(e){}
  if (!MONGO_URI) return;
  mongoClient = new MongoClient(MONGO_URI);
  await mongoClient.connect();
  mongoDB = mongoClient.db(MONGO_DB || 'sakura_bot_db');

  sessionsCol = mongoDB.collection('sessions');
  numbersCol = mongoDB.collection('numbers');
  configsCol = mongoDB.collection('configs');
  groupSettingsCol = mongoDB.collection('group_settings');
  customRepliesCol = mongoDB.collection('custom_replies');
  locksCol = mongoDB.collection('instance_lock');

  await sessionsCol.createIndex({ number: 1 }, { unique: true }).catch(()=>{});
  await numbersCol.createIndex({ number: 1 }, { unique: true }).catch(()=>{});
  await configsCol.createIndex({ number: 1 }, { unique: true }).catch(()=>{});
  await groupSettingsCol.createIndex({ jid: 1 }, { unique: true }).catch(()=>{});
  _mongoReady = true;
  console.log('✅ [SAYURI MINI DB] MongoDB connected and collections ready');
}

// ───────────────────── MONGO HELPERS ────────────────────────────
async function saveCredsToMongo(number, creds, keys = null, sessionPath = null) {
  try {
    await initMongo();
    const sanitized = number.replace(/[^0-9]/g, '');
    let files = {};
    if (sessionPath && fs.existsSync(sessionPath)) {
      const dirFiles = await fs.promises.readdir(sessionPath);
      // read in small batches so we never hold hundreds of reads at once
      for (let i = 0; i < dirFiles.length; i += 25) {
        await Promise.all(dirFiles.slice(i, i + 25).map(async (fname) => {
          try { files[fname] = await fs.promises.readFile(path.join(sessionPath, fname), 'utf8'); } catch(e) {}
        }));
      }
    }
    await sessionsCol.updateOne({ number: sanitized }, { $set: { number: sanitized, creds, keys, files, updatedAt: new Date() } }, { upsert: true });
  } catch (e) { console.error('saveCredsToMongo error:', e); }
}

async function loadCredsFromMongo(number) {
  try {
    await initMongo();
    return await sessionsCol.findOne({ number: number.replace(/[^0-9]/g, '') });
  } catch (e) { return null; }
}

async function removeSessionFromMongo(number) {
  try {
    await initMongo();
    const sanitized = number.replace(/[^0-9]/g, '');
    await sessionsCol.deleteOne({ number: sanitized });
    await numbersCol.deleteOne({ number: sanitized });
  } catch (e) {}
}

async function addNumberToMongo(number) {
  try {
    await initMongo();
    const sanitized = number.replace(/[^0-9]/g, '');
    await numbersCol.updateOne({ number: sanitized }, { $set: { number: sanitized } }, { upsert: true });
  } catch (e) {}
}

async function getAllNumbersFromMongo() {
  try {
    await initMongo();
    const docs = await numbersCol.find({}).toArray();
    return docs.map(d => d.number);
  } catch (e) { return []; }
}

async function setUserConfigInMongo(number, conf) {
  try {
    await initMongo();
    const sanitized = number.replace(/[^0-9]/g, '');
    await configsCol.updateOne({ number: sanitized }, { $set: { number: sanitized, config: conf, updatedAt: new Date() } }, { upsert: true });
    userConfigCache.set(sanitized, { config: conf, ts: Date.now() });
  } catch (e) {}
}

async function loadUserConfigFromMongo(number) {
  try {
    await initMongo();
    const sanitized = number.replace(/[^0-9]/g, '');
    const cached = userConfigCache.get(sanitized);
    if (cached && (Date.now() - (cached.ts || 0) < USER_CONFIG_CACHE_TTL)) return cached.config;
    const doc = await configsCol.findOne({ number: sanitized });
    const conf = doc ? doc.config : {};
    userConfigCache.set(sanitized, { config: conf, ts: Date.now() });
    return conf || {};
  } catch (e) { return {}; }
}

// ──────────────── GROUP SETTINGS MONGO HELPERS ──────────────────
async function getGroupSettings(jid) {
  const cached = groupSettingsCache.get(jid);
  if (cached && (Date.now() - (cached.ts || 0) < GROUP_SETTINGS_CACHE_TTL)) return cached.settings;
  try {
    await initMongo();
    const res = await groupSettingsCol.findOne({ jid });
    const settings = res || { jid, antilink: false, antibot: false, antibadword: false, badwords: [], welcome: false, goodbye: false };
    groupSettingsCache.set(jid, { settings, ts: Date.now() });
    return settings;
  } catch(e) {
    // If Mongo hiccups, fall back to the last known-good value instead of
    // stalling/blocking message handling for this group.
    if (cached) return cached.settings;
    return {};
  }
}

async function updateGroupSettings(jid, updateData) {
  groupSettingsCache.delete(jid); // force a fresh read next time so the change takes effect immediately
  try {
    await initMongo();
    await groupSettingsCol.updateOne({ jid }, { $set: updateData }, { upsert: true });
  } catch(e) {}
}

// ──────────────── CUSTOM AUTO REPLY HELPERS ─────────────────────
async function addAutoReply(number, trigger, type, content) {
  try {
    await initMongo();
    await customRepliesCol.updateOne(
      { number, trigger: trigger.toLowerCase() },
      { $set: { number, trigger: trigger.toLowerCase(), type, content, updatedAt: new Date() } },
      { upsert: true }
    );
  } catch(e) {}
}

async function removeAutoReply(number, trigger) {
  try {
    await initMongo();
    await customRepliesCol.deleteOne({ number, trigger: trigger.toLowerCase() });
  } catch(e) {}
}

async function getAutoReplies(number) {
  try {
    await initMongo();
    return await customRepliesCol.find({ number }).toArray();
  } catch(e) { return []; }
}

// ──────────────── GLOBAL MAPS & CACHES ──────────────────────────
const activeSockets = new Map();
const pendingSockets = new Map(); // sockets that exist but haven't finished pairing/connecting yet
const socketCreationTime = new Map();
const reconnectInProgress = new Set();
const pairingLock = new Set(); // prevents overlapping pairing attempts for the same number
const userMenuState = new Map(); // Stores { id: msgId, timestamp: Date.now() }
const messageStore = new Map();
const MESSAGE_STORE_MAX = 400;            // was 2000 full copies of every message
const MESSAGE_STORE_TTL = 30 * 60 * 1000; // anti-delete only needs recent messages
const HEAVY_MSG_KEYS = new Set(['jpegThumbnail', 'thumbnail', 'waveform', 'streamingSidecar', 'scansSidecar', 'midQualityFileSha256', 'highlyStructuredMessage']);

function rememberMessage(msg) {
  try {
    const json = JSON.stringify(msg, (k, v) => {
      if (HEAVY_MSG_KEYS.has(k)) return undefined;        // drop big useless blobs
      return BufferJSON ? BufferJSON.replacer(k, v) : v;  // Buffers -> compact base64 (not giant number arrays)
    });
    const copy = JSON.parse(json, BufferJSON ? BufferJSON.reviver : undefined);
    copy.__ts = Date.now();
    messageStore.delete(msg.key.id);
    messageStore.set(msg.key.id, copy);
    while (messageStore.size > MESSAGE_STORE_MAX) {
      messageStore.delete(messageStore.keys().next().value);
    }
  } catch (e) {}
}
const pendingInactivityTimers = new Map();

// ──────────────── SESSION CLEANUP HELPER ────────────────────────
// ─── AUTO-HEAL: PURGE SESSION THE MOMENT A "BAD MAC" ERROR HITS ────
// Some Baileys forks (incl. gifted-baileys) print libsignal decrypt
// failures straight to console.error/console.log, bypassing the pino
// logger entirely — so `logger: { level: 'silent' }` doesn't hide them.
// A single Bad MAC means that session's local signal keys are already
// out of sync with WhatsApp's servers (usually from an old duplicate-
// socket collision) — it will not self-heal, and WhatsApp just retries
// delivery forever. So instead of waiting for a burst, we purge the
// affected session the instant the first Bad MAC for it appears. The
// affected bot number is recoverable straight out of the error's own
// stack trace (Baileys names its internal async decrypt job after the
// local user's own id).
const badMacHealCooldown = new Set();

function extractSessionNumberFromLog(text) {
  const m = text.match(/at async (\d{7,15})\.\d+ \[as awaitable\]/);
  return m ? m[1] : null;
}

async function healBadMacSession(san) {
  if (badMacHealCooldown.has(san)) return;
  badMacHealCooldown.add(san);
  try {
    console.log(`⛔ [SAYURI MINI] Bad MAC detected on session ${san} — purging the corrupted session immediately. Re-pair with a fresh code to reconnect.`);
    await deleteEntireSession(san);
  } catch (e) {
    console.log('healBadMacSession error:', e.message);
  } finally {
    // Small cooldown just to swallow duplicate Bad MAC lines that fire
    // back-to-back for the same underlying failure, not to delay the purge.
    setTimeout(() => badMacHealCooldown.delete(san), 15000);
  }
}

const __origConsoleError = console.error.bind(console);
const __origConsoleLog = console.log.bind(console);

function __scanForBadMac(args) {
  try {
    const text = args.map(a => (typeof a === 'string' ? a : (a && a.stack) || '')).join(' ');
    if (text.includes('Bad MAC')) {
      const san = extractSessionNumberFromLog(text);
      if (san) healBadMacSession(san);
    }
  } catch (e) {}
}

console.error = (...args) => {
  __scanForBadMac(args);
  __origConsoleError(...args);
};
// Some forks log the "Bad MAC" / "Failed to decrypt..." lines via
// console.log instead of console.error — watch both streams.
console.log = (...args) => {
  __scanForBadMac(args);
  __origConsoleLog(...args);
};

// Fully detaches a socket: removes EVERY listener (not just 3 of them) and
// closes the websocket so the old socket + all its closures can be freed.
function killSocket(sock, reason = 'cleanup') {
  if (!sock) return;
  try { sock.ev.removeAllListeners(); } catch (e) {
    for (const ev of ['connection.update', 'messages.upsert', 'messages.update', 'creds.update', 'group-participants.update', 'call', 'groups.update', 'presence.update']) {
      try { sock.ev.removeAllListeners(ev); } catch (e2) {}
    }
  }
  try { sock.ws?.close(); } catch (e) {}
  try { sock.end?.(new Error(reason)); } catch (e) {}
}

async function deleteEntireSession(sanitizedNumber) {
  try {
    const san = sanitizedNumber.replace(/[^0-9]/g, '');
    
    if (pendingInactivityTimers.has(san)) {
      clearTimeout(pendingInactivityTimers.get(san));
      pendingInactivityTimers.delete(san);
    }

    if (activeSockets.has(san)) {
      try {
        killSocket(activeSockets.get(san), 'session_purged');
      } catch(e) {}
      activeSockets.delete(san);
    }
    if (pendingSockets.has(san)) {
      try {
        killSocket(pendingSockets.get(san), 'session_purged');
      } catch(e) {}
      pendingSockets.delete(san);
    }
    await removeSessionFromMongo(san);
    const sessionPath = path.join(os.tmpdir(), `sakura_session_${san}`);
    if (fs.existsSync(sessionPath)) {
      await fs.remove(sessionPath).catch(() => {});
    }
    console.log(`🗑️ [SAYURI MINI DB] Complete session purged for +${san}`);
  } catch(e) {
    console.error('deleteEntireSession error:', e);
  }
}

// ──────────────── CHANNEL / CONTEXT HELPER ──────────────────────
function getForwardedContext(cfg, customTitle = null) {
  return {
    forwardingScore: 9999,
    isForwarded: true,
    forwardedNewsletterMessageInfo: {
      newsletterJid: cfg?.NEWSLETTER_JID || config.NEWSLETTER_JID,
      newsletterName: customTitle || cfg?.NEWSLETTER_NAME || config.NEWSLETTER_NAME,
      serverMessageId: 100
    }
  };
}

async function sendFancyMsg(socket, to, content, quoted = null, cfg = {}) {
  const contextInfo = {
    ...getForwardedContext(cfg),
    ...(content.contextInfo || {})
  };
  if (content.mentions) contextInfo.mentionedJid = content.mentions;
  return await socket.sendMessage(to, { ...content, contextInfo }, { quoted });
}

// ──────────────── MEDIA BUFFER HELPERS ──────────────────────────
async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

// ──────────────── GROUP ADMIN PERMISSION HELPER ──────────────────
// WhatsApp now addresses group participants by LID (@lid) in many groups
// instead of by phone number (@s.whatsapp.net), and which one a given
// participant object uses depends on both accounts' privacy settings.
// Comparing only `p.id` against the bot's own `socket.user.id` therefore
// silently fails ("please promote me to admin" even though the bot IS
// admin) whenever the group lists the bot under its LID form (or vice
// versa). To be robust across Baileys fork versions, we collect every
// identifier-looking field we can find (id/jid/lid/phoneNumber) for both
// the bot and each participant, normalize them all, and check for any
// overlap instead of a single exact string match.
function safeNormJid(v) {
  if (!v) return null;
  try { return jidNormalizedUser(v); } catch (e) { return null; }
}

function getBotJidSet(socket) {
  const jids = new Set();
  [
    socket.user?.id,
    socket.user?.lid,
    socket.authState?.creds?.me?.id,
    socket.authState?.creds?.me?.lid
  ].forEach(v => { const n = safeNormJid(v); if (n) jids.add(n); });
  return jids;
}

function getParticipantJidCandidates(p) {
  const out = new Set();
  [p.id, p.jid, p.lid, p.phoneNumber].forEach(v => { const n = safeNormJid(v); if (n) out.add(n); });
  return out;
}

function participantMatches(p, targetJidSet) {
  if (!(p.admin === 'admin' || p.admin === 'superadmin')) return false;
  const candidates = getParticipantJidCandidates(p);
  for (const c of candidates) if (targetJidSet.has(c)) return true;
  return false;
}

async function checkGroupAdmin(socket, from, senderJid, isOwnerUser, senderAltJid) {
  const groupMeta = await socket.groupMetadata(from).catch(() => null);
  if (!groupMeta) return { groupMeta: null, isBotAdmin: false, isSenderAdmin: false };
  const participants = groupMeta.participants || [];
  const botJids = getBotJidSet(socket);
  const senderJids = new Set([senderJid, senderAltJid].map(safeNormJid).filter(Boolean));
  const isBotAdmin = participants.some(p => participantMatches(p, botJids));
  const isSenderAdmin = isOwnerUser || participants.some(p => participantMatches(p, senderJids));
  return { groupMeta, isBotAdmin, isSenderAdmin };
}

async function downloadMediaMessage(message) {
  let container = message;
  if (container.ephemeralMessage) container = container.ephemeralMessage.message;
  if (container.viewOnceMessageV2) container = container.viewOnceMessageV2.message;
  if (container.viewOnceMessageV2Extension) container = container.viewOnceMessageV2Extension.message;
  if (container.viewOnceMessage) container = container.viewOnceMessage.message;

  const type = getContentType(container);
  if (!type || !container[type]) {
    throw new Error('No downloadable media found in this message.');
  }
  const msg = container[type];
  const stream = await downloadContentFromMessage(msg, type.replace('Message', ''));
  return await streamToBuffer(stream);
}

// ──────────────── IMAGE → STATIC WEBP STICKER ──────────────────
async function imageBufferToWebpSticker(buffer) {
  const tmpId = crypto.randomBytes(6).toString('hex');
  const inPath = path.join(os.tmpdir(), `sakura_img_${tmpId}.png`);
  const outPath = path.join(os.tmpdir(), `sakura_img_${tmpId}.webp`);
  const jimpImg = await Jimp.read(buffer);
  await jimpImg.contain(512, 512, Jimp.HORIZONTAL_ALIGN_CENTER | Jimp.VERTICAL_ALIGN_MIDDLE);
  const normalizedBuf = await jimpImg.getBufferAsync(Jimp.MIME_PNG);
  await fs.writeFile(inPath, normalizedBuf);
  try {
    await new Promise((resolve, reject) => {
      ffmpeg(inPath)
        .on('error', reject)
        .on('end', resolve)
        .addOutputOptions([
          '-vcodec', 'libwebp',
          '-vf', 'scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:-1:-1:color=white@0.0',
          '-preset', 'default',
          '-an',
          '-vsync', '0'
        ])
        .toFormat('webp')
        .save(outPath);
    });
    return await fs.readFile(outPath);
  } finally {
    fs.remove(inPath).catch(() => {});
    fs.remove(outPath).catch(() => {});
  }
}

// ──────────────── IMAGE → "FULL SCREEN" (UNCROPPED) PROFILE DP ──
// WhatsApp force-crops profile pictures into a square from the centre,
// which cuts off the top/bottom of tall photos or the sides of wide
// ones. To make the whole photo visible ("full dp"), we pad it onto a
// square canvas first so WhatsApp's own square-crop has nothing left
// to cut off.
async function imageBufferToFullDp(buffer) {
  const jimpImg = await Jimp.read(buffer);
  const size = Math.max(jimpImg.bitmap.width, jimpImg.bitmap.height);
  const canvas = new Jimp(size, size, 0xffffffff);
  canvas.composite(
    jimpImg,
    Math.floor((size - jimpImg.bitmap.width) / 2),
    Math.floor((size - jimpImg.bitmap.height) / 2)
  );
  return await canvas.getBufferAsync(Jimp.MIME_JPEG);
}

// ──────────────── VIDEO → ANIMATED WEBP STICKER ──────────────────
async function videoBufferToWebpSticker(buffer) {
  const tmpId = crypto.randomBytes(6).toString('hex');
  const inPath = path.join(os.tmpdir(), `sakura_vid_${tmpId}.mp4`);
  const outPath = path.join(os.tmpdir(), `sakura_vid_${tmpId}.webp`);
  await fs.writeFile(inPath, buffer);
  try {
    await new Promise((resolve, reject) => {
      ffmpeg(inPath)
        .on('error', reject)
        .on('end', resolve)
        .addOutputOptions([
          '-vcodec', 'libwebp',
          '-vf', "scale='min(512,iw)':min'(512,ih)':force_original_aspect_ratio=decrease,fps=15,pad=512:512:-1:-1:color=white@0.0",
          '-loop', '0',
          '-preset', 'default',
          '-an',
          '-t', '6',
          '-vsync', '0'
        ])
        .toFormat('webp')
        .save(outPath);
    });
    return await fs.readFile(outPath);
  } finally {
    fs.remove(inPath).catch(() => {});
    fs.remove(outPath).catch(() => {});
  }
}

// ──────────────── STATUS SEEN & AUTO REACT ──────────────────────
const processedStatus = new Set();
const MAX_STATUS_CACHE = 1000;
const STATUS_REACTION_DELAY = 1500;

function setupStatusHandlers(socket, sessionNumber) {
  socket.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg?.key || msg.key.remoteJid !== 'status@broadcast' || !msg.key.participant) return;

    const botJid = socket.user?.id ? jidNormalizedUser(socket.user.id) : '';
    if (botJid && msg.key.participant === botJid) return;

    const statusId = `${msg.key.participant}_${msg.key.id}`;
    if (processedStatus.has(statusId)) return;

    try {
      const sanitized = (sessionNumber || '').replace(/[^0-9]/g, '');
      const userCfg = await loadUserConfigFromMongo(sanitized);

      const autoView = userCfg.AUTO_VIEW_STATUS ?? config.AUTO_VIEW_STATUS;
      const autoLike = userCfg.AUTO_LIKE_STATUS ?? config.AUTO_LIKE_STATUS;
      const autoRecording = userCfg.AUTO_RECORDING ?? config.AUTO_RECORDING;

      if (autoRecording === 'true') {
        await socket.sendPresenceUpdate("recording", msg.key.remoteJid).catch(() => {});
      }

      await delay(STATUS_REACTION_DELAY);

      if (autoView === 'true') {
        try {
          await socket.readMessages([msg.key]);
        } catch (error) {
          console.warn('⚠️ Failed to read status:', error.message);
        }
      }

      if (autoLike === 'true') {
        const emojis = userCfg.AUTO_LIKE_EMOJI || config.AUTO_LIKE_EMOJI;
        const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)] || '🌙';

        try {
          await socket.sendMessage(
            msg.key.remoteJid,
            { react: { text: randomEmoji, key: msg.key } },
            { statusJidList: [msg.key.participant] }
          );
        } catch (error) {
          console.warn('⚠️ Failed to react to status:', error.message);
        }
      }

      processedStatus.add(statusId);
      if (processedStatus.size > MAX_STATUS_CACHE) {
        const firstEntry = processedStatus.values().next().value;
        processedStatus.delete(firstEntry);
      }

    } catch (error) {
      console.error('❌ Error in status handler:', error.message);
    }
  });
}

// ─────────────── GROUP PARTICIPANTS (WELCOME / GOODBYE) ────────
function setupGroupParticipantHandlers(socket, sessionNumber) {
  socket.ev.on('group-participants.update', async (update) => {
    try {
      const { id, participants, action } = update;
      const gSettings = await getGroupSettings(id);
      const groupMeta = await socket.groupMetadata(id).catch(() => null);
      if (!groupMeta) return;

      for (const participant of participants) {
        if (action === 'add' && gSettings.welcome) {
          const welcomeTxt = `🌙 *WELCOME TO ${groupMeta.subject}!* 🌙\n\n👋 Hey @${participant.split('@')[0]}! Enjoy your stay and follow the group rules. ✨\n\n> 🤖 *${config.BOT_NAME}*`;
          await socket.sendMessage(id, { text: welcomeTxt, mentions: [participant] });
        } else if (action === 'remove' && gSettings.goodbye) {
          const byeTxt = `👋 *GOODBYE @${participant.split('@')[0]}!* We'll miss you. 🌙\n\n> 🤖 *${config.BOT_NAME}*`;
          await socket.sendMessage(id, { text: byeTxt, mentions: [participant] });
        }
      }
    } catch(e) {}
  });
}

// ─────────────── CHANNEL (NEWSLETTER) AUTO REACT ────────────────
const processedChannelMsgs = new Set();
const MAX_CHANNEL_CACHE = 1000;
const CHANNEL_REACT_EMOJIS = ['🌙', '🪻', '🌷', '❤️', '🔥', '✨'];

function setupChannelReactHandler(socket, sessionNumber) {
  socket.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg?.key?.remoteJid?.endsWith('@newsletter')) return;
    if (!msg.newsletterServerId) return;

    const cacheKey = `${msg.key.remoteJid}_${msg.newsletterServerId}`;
    if (processedChannelMsgs.has(cacheKey)) return;

    try {
      const sanitized = (sessionNumber || '').replace(/[^0-9]/g, '');
      const userCfg = await loadUserConfigFromMongo(sanitized);
      const autoChannelReact = userCfg.AUTO_CHANNEL_REACT ?? config.AUTO_CHANNEL_REACT ?? 'false';
      if (autoChannelReact !== 'true') return;

      const emoji = CHANNEL_REACT_EMOJIS[Math.floor(Math.random() * CHANNEL_REACT_EMOJIS.length)];
      if (typeof socket.newsletterReactMessage === 'function') {
        await socket.newsletterReactMessage(msg.key.remoteJid, String(msg.newsletterServerId), emoji).catch(() => {});
      }

      processedChannelMsgs.add(cacheKey);
      if (processedChannelMsgs.size > MAX_CHANNEL_CACHE) {
        const firstEntry = processedChannelMsgs.values().next().value;
        processedChannelMsgs.delete(firstEntry);
      }
    } catch (error) {
      console.error('❌ Error in channel react handler:', error.message);
    }
  });
}

// ─────────────── ANTI CALL (AUTO REJECT INCOMING CALLS) ─────────
function setupCallHandlers(socket, sessionNumber) {
  socket.ev.on('call', async (calls) => {
    try {
      const sanitized = (sessionNumber || '').replace(/[^0-9]/g, '');
      const userCfg = await loadUserConfigFromMongo(sanitized);
      const antiCall = userCfg.ANTI_CALL ?? config.ANTI_CALL ?? 'false';
      if (antiCall !== 'true') return;

      for (const call of calls) {
        if (call.status !== 'offer') continue;
        try {
          if (typeof socket.rejectCall === 'function') {
            await socket.rejectCall(call.id, call.from);
          }
          await socket.sendMessage(call.from, {
            text: `🚫 *${userCfg.botName || config.BOT_NAME}* auto-rejects calls. Please message instead. 🌙`
          }).catch(() => {});
        } catch (e) {
          console.error('Anti-call reject error:', e.message);
        }
      }
    } catch (error) {
      console.error('❌ Error in anti-call handler:', error.message);
    }
  });
}

// ──────────────── COMMAND & EVENT HANDLERS ──────────────────────
function setupCommandHandlers(socket, number) {
  const sanitizedNum = number.replace(/[^0-9]/g, '');

  socket.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg || !msg.message || msg.key.remoteJid === 'status@broadcast') return;

    if (msg.key?.id) {
      // Only keep a copy when this number actually uses Anti-Delete
      // (or when we don't know yet) — saves RAM for everyone else.
      const _cachedCfg = userConfigCache.get(sanitizedNum)?.config;
      if (!_cachedCfg || _cachedCfg.ANTI_DELETE === 'true') rememberMessage(msg);
    }

    let type = getContentType(msg.message);
    let messageContent = msg.message;
    if (type === 'ephemeralMessage') {
      messageContent = msg.message.ephemeralMessage.message;
      type = getContentType(messageContent);
    }

    const from = msg.key.remoteJid;
    const isGroup = from.endsWith('@g.us');
    const nowsender = msg.key.fromMe ? ((socket.user?.id ? socket.user.id.split(':')[0] : '') + '@s.whatsapp.net') : jidNormalizedUser(msg.key.participant || from);

    let senderNumber = (nowsender || '').split('@')[0];
    if (!msg.key.fromMe) {
      const altJidRaw = isGroup ? msg.key.participantAlt : msg.key.remoteJidAlt;
      if (altJidRaw) {
        const altNorm = jidNormalizedUser(altJidRaw);
        if (altNorm && altNorm.endsWith('@s.whatsapp.net')) {
          senderNumber = altNorm.split('@')[0];
        } else if (!nowsender?.endsWith('@s.whatsapp.net') && altNorm) {
          senderNumber = altNorm.split('@')[0];
        }
      }
    }

    const isBot = socket.user?.id ? socket.user.id.split(':')[0] === senderNumber : false;

    const masterOwners = config.OWNER_NUMBER.split(',').map(v => v.replace(/[^0-9]/g, ''));
    const isMasterOwner = masterOwners.includes(senderNumber);

    let body = '';
    if (type === 'conversation') body = messageContent.conversation || '';
    else if (type === 'extendedTextMessage') body = messageContent.extendedTextMessage?.text || '';
    else if (type === 'imageMessage') body = messageContent.imageMessage?.caption || '';
    else if (type === 'videoMessage') body = messageContent.videoMessage?.caption || '';
    body = String(body || '').trim();

    const userCfg = await loadUserConfigFromMongo(sanitizedNum);
    const prefix = userCfg.PREFIX || config.PREFIX;
    const botName = userCfg.botName || config.BOT_NAME;
    const botLogo = userCfg.logo || config.DEFAULT_LOGO;
    const botFooter = userCfg.footer || config.BOT_FOOTER;

    // ──────────────── SUDO USERS ────────────────
    const sudoNumbers = Array.isArray(userCfg.SUDO_NUMBERS) ? userCfg.SUDO_NUMBERS : [];
    const isSudoUser = sudoNumbers.includes(senderNumber);
    const isOwnerUser = isMasterOwner || isBot || isSudoUser;

    // ──────────────── BOT MODE (public / private / inbox / group) ────────────────
    const botMode = String(userCfg.MODE || 'public').toLowerCase();
    if (!isOwnerUser) {
      if (botMode === 'private') return;
      if (botMode === 'inbox' && isGroup) return;
      if (botMode === 'group' && !isGroup) return;
    }

    if (isGroup && !msg.key.fromMe) {
      const gSettings = await getGroupSettings(from);

      if (gSettings.antilink && /(chat\.whatsapp\.com\/|wa\.me\/)/i.test(body)) {
        if (!isOwnerUser) {
          await socket.sendMessage(from, { delete: msg.key });
          await socket.sendMessage(from, { text: `⚠️ Link detected and deleted! Links are not allowed here.` });
          return;
        }
      }

      if (gSettings.antibadword && Array.isArray(gSettings.badwords)) {
        const foundBad = gSettings.badwords.some(bw => body.toLowerCase().includes(bw.toLowerCase()));
        if (foundBad && !isOwnerUser) {
          await socket.sendMessage(from, { delete: msg.key });
          await socket.sendMessage(from, { text: `⚠️ Bad word removed! Maintain group decency.` });
          return;
        }
      }
      if (gSettings.antistmention && (body.includes('status@broadcast') || msg.message?.groupStatusMentionMessage || msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.includes('status@broadcast'))) {
        if (!isOwnerUser) {
          await socket.sendMessage(from, { delete: msg.key });
          await socket.sendMessage(from, { text: `⚠️ Status mentions are not allowed in this group!` });
          return;
        }
      }
    }

    if (!msg.key.fromMe && body) {
      const allReplies = await getAutoReplies(sanitizedNum);
      const matchReply = allReplies.find(r => r.trigger.toLowerCase() === body.toLowerCase());
      if (matchReply) {
        try {
          if (matchReply.type === 'text') {
            await sendFancyMsg(socket, from, { text: matchReply.content }, msg, userCfg);
          } else if (matchReply.type === 'voice' || matchReply.type === 'audio') {
            await socket.sendMessage(from, { audio: { url: matchReply.content }, mimetype: 'audio/ogg; codecs=opus', ptt: true }, { quoted: msg });
          } else if (matchReply.type === 'image') {
            await socket.sendMessage(from, { image: { url: matchReply.content }, caption: `✨ Auto Reply by ${botName}` }, { quoted: msg });
          } else if (matchReply.type === 'video') {
            await socket.sendMessage(from, { video: { url: matchReply.content }, caption: `✨ Auto Reply by ${botName}` }, { quoted: msg });
          } else if (matchReply.type === 'sticker') {
            await socket.sendMessage(from, { sticker: { url: matchReply.content } }, { quoted: msg });
          }
        } catch(e) {}
      }
    }

    if (userCfg.AUTO_TYPING === 'true') await socket.sendPresenceUpdate('composing', from);
    if (userCfg.AUTO_RECORDING === 'true') await socket.sendPresenceUpdate('recording', from);

    // ────────── NO-PREFIX "SEND SAVED STATUS TO NUMBER" SHORTCUT ──────────
    {
      const sendTriggerMatch = body.match(/^(දාපන්|දියන්|ඕන|send)\s+(\+?[0-9][0-9\s-]{6,})$/iu);
      const quotedForSend = messageContent?.extendedTextMessage?.contextInfo?.quotedMessage;
      if (sendTriggerMatch && quotedForSend && isOwnerUser) {
        try {
          const targetNumber = sendTriggerMatch[2].replace(/[^0-9]/g, '');
          const targetJid = `${targetNumber}@s.whatsapp.net`;
          let statusMsg = quotedForSend;
          if (statusMsg.viewOnceMessageV2) statusMsg = statusMsg.viewOnceMessageV2.message;
          if (statusMsg.viewOnceMessage) statusMsg = statusMsg.viewOnceMessage.message;
          const qType = Object.keys(statusMsg)[0];

          if (qType.includes('image')) {
            const buf = await downloadMediaMessage(statusMsg);
            await socket.sendMessage(targetJid, { image: buf, caption: statusMsg.imageMessage?.caption || '' });
          } else if (qType.includes('video')) {
            const buf = await downloadMediaMessage(statusMsg);
            await socket.sendMessage(targetJid, { video: buf, caption: statusMsg.videoMessage?.caption || '' });
          } else if (qType === 'conversation' || qType === 'extendedTextMessage') {
            const txt = statusMsg.conversation || statusMsg.extendedTextMessage?.text || '';
            await socket.sendMessage(targetJid, { text: txt });
          } else {
            await socket.sendMessage(from, { text: `❌ Can't forward this type of status.` }, { quoted: msg });
            return;
          }
          await socket.sendMessage(from, { text: `✅ Sent to +${targetNumber}.` }, { quoted: msg });
        } catch (e) {
          console.error('Status Forward Error:', e);
          await socket.sendMessage(from, { text: `❌ Failed to send: ${e.message}` }, { quoted: msg });
        }
        return;
      }
    }

    const quotedMsgId = messageContent?.extendedTextMessage?.contextInfo?.stanzaId;
    let isCmd = body.startsWith(prefix);
    let command = isCmd ? body.slice(prefix.length).trim().split(' ').shift().toLowerCase() : null;
    let args = body.trim().split(/ +/).slice(1);

    // ────────────── SMART CONFLICT-FREE NUMBER SELECTION ──────────────
    if (!isCmd && /^[0-9]+$/.test(body)) {
      const choice = body.trim();
      const movieSes = global.movieSessions?.[from];
      const pinSes = global.pinSessions?.[from];
      const menuSes = userMenuState.get(from);
      const cineSes = global.cineSessions?.[from];

      const isMovieValid = movieSes && (Date.now() - movieSes.timestamp < 5 * 60 * 1000);
      const isPinValid = pinSes && (Date.now() - pinSes.timestamp < 5 * 60 * 1000);
      const isMenuValid = menuSes && (Date.now() - (menuSes.timestamp || 0) < 5 * 60 * 1000);
      const isCineValid = cineSes && (Date.now() - (cineSes.timestamp || 0) < 5 * 60 * 1000);

      let targetAction = null;

      if (quotedMsgId) {
        if (isMovieValid && movieSes.messageId === quotedMsgId) {
          targetAction = 'movie';
        } else if (isPinValid && pinSes.messageId === quotedMsgId) {
          targetAction = 'pin';
        } else if (isCineValid && cineSes.messageId === quotedMsgId) {
          targetAction = 'cine';
        } else if (isMenuValid && menuSes.id === quotedMsgId) {
          targetAction = 'menu';
        }
      }

      if (!targetAction && !quotedMsgId) {
        const candidates = [];
        if (isMovieValid) candidates.push({ type: 'movie', time: movieSes.timestamp });
        if (isPinValid) candidates.push({ type: 'pin', time: pinSes.timestamp });
        if (isCineValid) candidates.push({ type: 'cine', time: cineSes.timestamp });
        if (isMenuValid) candidates.push({ type: 'menu', time: menuSes.timestamp });

        if (candidates.length > 0) {
          candidates.sort((a, b) => b.time - a.time);
          targetAction = candidates[0].type;
        }
      }

      if (targetAction === 'movie') {
        command = 'movie';
        args = [choice];
      } else if (targetAction === 'pin') {
        command = 'pin';
        args = [choice];
      } else if (targetAction === 'cine') {
        command = 'cine';
        args = [choice];
      } else if (targetAction === 'menu') {
        switch (choice) {
          case '1': command = 'dlmenu'; break;
          case '2': command = 'groupmenu'; break;
          case '3': command = 'utilmenu'; break;
          case '4': command = 'funmenu'; break;
          case '5': command = 'settingsmenu'; break;
          case '6': command = 'channelmenu'; break;
          case '7': command = 'customizemenu'; break;
          default: break;
        }
      }
    }

    if (!command) return;

    try {
      switch (command) {
      
        // ─────────────────────────────
        // ➕ ADD PARTICIPANT COMMAND
        // ─────────────────────────────
                  case 'cplay': {
          if (!args.length || !text.includes(',')) {
            return await socket.sendMessage(from, {
              text: `╭───〔 🎵 *CHANNEL MUSIC* 〕───⊷\n│ ⚠️ *Usage:* \`${prefix}cplay <newsletterJid>,<Song Name>\`\n│\n│ 💡 *Example:*\n│ • \`${prefix}cplay 120363xxxxxxxxxx@newsletter,sumudu sayane\`\n╰──────────────────────────⊷`
            }, { quoted: msg });
          }

          const rawText = args.join(' ');
          const [rawJid, ...songParts] = rawText.split(',');
          const newsletterJid = rawJid.trim();
          const query = songParts.join(',').trim();

          if (!newsletterJid.endsWith('@newsletter')) {
            return await socket.sendMessage(from, {
              text: `❌ *Invalid channel JID.* It must end with \`@newsletter\`.`
            }, { quoted: msg });
          }

          if (!query) {
            return await socket.sendMessage(from, {
              text: `❌ *Song name missing.* Usage: \`${prefix}cplay <newsletterJid>,<Song Name>\``
            }, { quoted: msg });
          }

          const API_BASE = 'https://api-siteh-22e22e4cb068.herokuapp.com/api/ytmp3';
          const API_KEY = 'lakiya_a48ffc8468c7d237a52ddc18d79c031285c63edc601fd84b738622596b2afb63';

          await socket.sendMessage(from, { react: { text: '⏳', key: msg.key } });

          try {
            let videoUrl = query;
            let songTitle = 'Unknown Music';

            const isUrl = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\//i.test(query);

            if (!isUrl) {
              const searchResults = await yts(query);
              const videos = searchResults?.videos;

              if (!videos || !videos.length) {
                await socket.sendMessage(from, { react: { text: '❌', key: msg.key } });
                return await socket.sendMessage(from, { text: `❌ *No results found for:* _${query}_` }, { quoted: msg });
              }

              const vid = videos[0];
              videoUrl = vid.url;
              songTitle = vid.title;
            }

            await socket.sendMessage(from, { react: { text: '📥', key: msg.key } });

            const res = await axios.get(API_BASE, {
              params: { url: videoUrl, api_key: API_KEY },
              timeout: 60000
            });

            const apiData = res.data?.data || res.data?.result || res.data;
            const downloadUrl = apiData?.download_url || apiData?.dl_url || apiData?.direct_url || apiData?.url || apiData?.downloadLink;

            if (apiData?.title) songTitle = apiData.title;

            if (!downloadUrl || typeof downloadUrl !== 'string' || !downloadUrl.startsWith('http')) {
              throw new Error(res.data?.message || 'Failed to retrieve download link from server.');
            }

            const audioBuffer = await axios.get(downloadUrl, {
              responseType: 'arraybuffer',
              maxContentLength: MAX_MEDIA_BYTES,
              maxBodyLength: MAX_MEDIA_BYTES,
              timeout: 90000,
              headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
            });

            // Channel (newsletter) එකට post කරන එක - audio only, voice-note නෙවෙයි
            await socket.sendMessage(newsletterJid, {
              audio: audioBuffer.data,
              mimetype: 'audio/mpeg',
              fileName: `${songTitle.replace(/[\\/:*?"<>|]/g, '')}.mp3`,
              ptt: false
            });

            await socket.sendMessage(from, { react: { text: '✅', key: msg.key } });
            await socket.sendMessage(from, {
              text: `✅ *"${songTitle}"* successfully posted to the channel!`
            }, { quoted: msg });

          } catch (err) {
            console.error('Channel Music Command Error:', err);
            await socket.sendMessage(from, { react: { text: '❌', key: msg.key } });
            await socket.sendMessage(from, { text: `❌ *Failed:* ${err.message}` }, { quoted: msg });
          }
          break;
                  }
       
        case 'antistmention':
        case 'antistatusmention':
        case 'antistatus': {
          if (!isGroup) {
            return await socket.sendMessage(from, { text: '❌ This command can only be used in groups!' }, { quoted: msg });
          }

          const { isBotAdmin, isSenderAdmin } = await checkGroupAdmin(socket, from, jidNormalizedUser(nowsender), isOwnerUser, msg.key.participantAlt);
          if (!isSenderAdmin) {
            return await socket.sendMessage(from, { text: '❌ Only Group Admins can use this command!' }, { quoted: msg });
          }
          if (!isBotAdmin) {
            return await socket.sendMessage(from, { text: '❌ Please promote me to Admin first!' }, { quoted: msg });
          }

          const opt = (args[0] || '').toLowerCase();
          if (opt === 'on' || opt === 'off') {
            await updateGroupSettings(from, { antistmention: opt === 'on' });
            await socket.sendMessage(from, { 
              text: `🛡️ *Anti-Status Mention* has been turned *${opt.toUpperCase()}* for this group.` 
            }, { quoted: msg });
          } else {
            await socket.sendMessage(from, { 
              text: `╭───〔 🛡️ *ANTI STATUS MENTION* 〕───⊷\n│ ⚠️ *Usage:* \`${prefix}antistmention <on|off>\`\n│\n│ 💡 *Examples:*\n│ • \`${prefix}antistmention on\`\n│ • \`${prefix}antistmention off\`\n╰──────────────────────────⊷` 
            }, { quoted: msg });
          }
          break;
        }
        case 'add': {
          if (!isGroup) {
            return await socket.sendMessage(from, { text: '❌ This command can only be used in groups!' }, { quoted: msg });
          }

          const { groupMeta, isBotAdmin, isSenderAdmin } = await checkGroupAdmin(socket, from, jidNormalizedUser(nowsender), isOwnerUser, msg.key.participantAlt);
          if (!groupMeta) {
            return await socket.sendMessage(from, { text: '❌ Failed to fetch group metadata.' }, { quoted: msg });
          }

          if (!isBotAdmin) {
            return await socket.sendMessage(from, { text: '❌ Please promote me to Admin first!' }, { quoted: msg });
          }

          if (!isSenderAdmin && !isOwnerUser) {
            return await socket.sendMessage(from, { text: '❌ Only Group Admins can use this command!' }, { quoted: msg });
          }

          let targets = [];
          const ctx = msg.message?.extendedTextMessage?.contextInfo;
          if (ctx?.mentionedJid && ctx.mentionedJid.length > 0) {
            targets.push(...ctx.mentionedJid);
          } else if (ctx?.participant) {
            targets.push(ctx.participant);
          } else if (args.length > 0) {
            const raw = args.join(' ').replace(/[^0-9,\s]/g, '').split(/[\s,]+/);
            for (const item of raw) {
              const num = item.trim();
              if (num.length >= 7) targets.push(num + '@s.whatsapp.net');
            }
          }

          targets = [...new Set(targets.map(t => jidNormalizedUser(t)))];

          if (targets.length === 0) {
            return await socket.sendMessage(from, {
              text: `╭───〔 ➕ *ADD PARTICIPANT* 〕───⊷\n│ ⚠️ *Usage:*\n│ • \`${prefix}add 947xxxxxxxx\`\n│ • \`${prefix}add @user\`\n│ • Reply to user message with \`${prefix}add\`\n╰──────────────────────────⊷`
            }, { quoted: msg });
          }

          await socket.sendMessage(from, { react: { text: '⏳', key: msg.key } });

          try {
            const response = await socket.groupParticipantsUpdate(from, targets, 'add');
            
            for (const resItem of response) {
              const userNumber = resItem.jid.split('@')[0];
              if (resItem.status === '200') {
                await socket.sendMessage(from, { text: `✅ Successfully added @${userNumber} to the group!`, mentions: [resItem.jid] }, { quoted: msg });
              } else if (resItem.status === '403') {
                await socket.sendMessage(from, { text: `⚠️ Couldn't add @${userNumber} due to their privacy settings. An invite link is required.`, mentions: [resItem.jid] }, { quoted: msg });
              } else if (resItem.status === '408') {
                await socket.sendMessage(from, { text: `⚠️ User @${userNumber} recently left the group. Try again later.`, mentions: [resItem.jid] }, { quoted: msg });
              } else if (resItem.status === '409') {
                await socket.sendMessage(from, { text: `ℹ️ @${userNumber} is already a member of this group.`, mentions: [resItem.jid] }, { quoted: msg });
              } else {
                await socket.sendMessage(from, { text: `❌ Failed to add @${userNumber} (Status Code: ${resItem.status}).`, mentions: [resItem.jid] }, { quoted: msg });
              }
            }
            await socket.sendMessage(from, { react: { text: '✅', key: msg.key } });
          } catch (err) {
            console.error('Add Error:', err);
            await socket.sendMessage(from, { react: { text: '❌', key: msg.key } });
            await socket.sendMessage(from, { text: `❌ Failed to add participant: ${err.message}` }, { quoted: msg });
          }
          break;
        }

        // ─────────────────────────────
        // 🚫 KICK / REMOVE COMMAND
        // ─────────────────────────────
        case 'kick':
        case 'remove': {
          if (!isGroup) {
            return await socket.sendMessage(from, { text: '❌ This command can only be used in groups!' }, { quoted: msg });
          }

          const { groupMeta, isBotAdmin, isSenderAdmin } = await checkGroupAdmin(socket, from, jidNormalizedUser(nowsender), isOwnerUser, msg.key.participantAlt);
          if (!groupMeta) {
            return await socket.sendMessage(from, { text: '❌ Failed to fetch group metadata.' }, { quoted: msg });
          }

          if (!isBotAdmin) {
            return await socket.sendMessage(from, { text: '❌ Please promote me to Admin first!' }, { quoted: msg });
          }

          if (!isSenderAdmin && !isOwnerUser) {
            return await socket.sendMessage(from, { text: '❌ Only Group Admins can use this command!' }, { quoted: msg });
          }

          let targets = [];
          const ctx = msg.message?.extendedTextMessage?.contextInfo;
          if (ctx?.mentionedJid && ctx.mentionedJid.length > 0) {
            targets.push(...ctx.mentionedJid);
          } else if (ctx?.participant) {
            targets.push(ctx.participant);
          } else if (args.length > 0) {
            const raw = args.join(' ').replace(/[^0-9,\s]/g, '').split(/[\s,]+/);
            for (const item of raw) {
              const num = item.trim();
              if (num.length >= 7) targets.push(num + '@s.whatsapp.net');
            }
          }

          targets = [...new Set(targets.map(t => jidNormalizedUser(t)))];

          if (targets.length === 0) {
            return await socket.sendMessage(from, {
              text: `╭───〔 🚫 *REMOVE PARTICIPANT* 〕───⊷\n│ ⚠️ *Usage:*\n│ • \`${prefix}kick @user\`\n│ • Reply to user message with \`${prefix}kick\`\n│ • \`${prefix}kick 947xxxxxxxx\`\n╰──────────────────────────⊷`
            }, { quoted: msg });
          }

          const ownerNumbers = config.OWNER_NUMBER.split(',').map(v => v.replace(/[^0-9]/g, ''));
          targets = targets.filter(t => {
            const num = t.split('@')[0];
            return !ownerNumbers.includes(num) && !botJids.has(t);
          });

          if (targets.length === 0) {
            return await socket.sendMessage(from, { text: '❌ Cannot remove the bot or bot owners!' }, { quoted: msg });
          }

          await socket.sendMessage(from, { react: { text: '⏳', key: msg.key } });

          try {
            await socket.groupParticipantsUpdate(from, targets, 'remove');
            const kickedMentions = targets.map(t => `@${t.split('@')[0]}`).join(', ');
            await socket.sendMessage(from, { text: `✅ Successfully removed ${kickedMentions} from the group.`, mentions: targets }, { quoted: msg });
            await socket.sendMessage(from, { react: { text: '✅', key: msg.key } });
          } catch (err) {
            console.error('Kick Error:', err);
            await socket.sendMessage(from, { react: { text: '❌', key: msg.key } });
            await socket.sendMessage(from, { text: `❌ Failed to remove participant: ${err.message}` }, { quoted: msg });
          }
          break;
        }
//==================================================####################
        case 'song':
        case 'audio': {
          if (!args.length) {
            return await socket.sendMessage(from, { 
              text: `╭───〔 🎵 *MUSIC DOWNLOADER* 〕───⊷\n│ ⚠️ *Usage:* \`${prefix}music <Song Name / YouTube Link>\`\n│\n│ 💡 *Examples:*\n│ • \`${prefix}music sumudu sayane\`\n│ • \`${prefix}music aj leon\`\n│ • \`${prefix}music https://youtu.be/xxxx\`\n╰──────────────────────────⊷` 
            }, { quoted: msg });
          }

          const query = args.join(' ');
          const API_BASE = 'https://api-siteh-22e22e4cb068.herokuapp.com/api/ytmp3';
          const API_KEY = 'lakiya_a48ffc8468c7d237a52ddc18d79c031285c63edc601fd84b738622596b2afb63';

          await socket.sendMessage(from, { react: { text: '⏳', key: msg.key } });

          try {
            let videoUrl = query;
            let songTitle = 'Unknown Music';
            let thumbnailUrl = config.DEFAULT_LOGO;
            let duration = '0:00';
            let channelName = 'YouTube';

            const isUrl = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\//i.test(query);

            if (!isUrl) {
              const searchResults = await yts(query);
              const videos = searchResults?.videos;

              if (!videos || !videos.length) {
                await socket.sendMessage(from, { react: { text: '❌', key: msg.key } });
                return await socket.sendMessage(from, { text: `❌ *No results found for:* _${query}_` }, { quoted: msg });
              }

              const vid = videos[0];
              videoUrl = vid.url;
              songTitle = vid.title;
              thumbnailUrl = vid.thumbnail || thumbnailUrl;
              duration = vid.timestamp || `${Math.floor(vid.seconds / 60)}:${String(vid.seconds % 60).padStart(2, '0')}`;
              channelName = vid.author?.name || channelName;
            }

            const infoCard = 
`╭───〔 🎵 *${(botName || 'MUSIC BOT').toUpperCase()}* 〕───⊷
│ 📌 *Title:* ${songTitle}
│ ⏱️ *Duration:* ${duration}
│ 👤 *Channel:* ${channelName}
╰──────────────────────────⊷
> 🪻 _Downloading Audio... Please wait._
${botFooter}`;

            const infoMsg = await socket.sendMessage(from, {
              image: { url: thumbnailUrl },
              caption: infoCard
            }, { quoted: msg });

            await socket.sendMessage(from, { react: { text: '📥', key: msg.key } });

            const res = await axios.get(API_BASE, {
              params: {
                url: videoUrl,
                api_key: API_KEY
              },
              timeout: 60000
            });

            const apiData = res.data?.data || res.data?.result || res.data;
            const downloadUrl = apiData?.download_url || apiData?.dl_url || apiData?.direct_url || apiData?.url || apiData?.downloadLink;
            
            if (apiData?.title) songTitle = apiData.title;

            if (!downloadUrl || typeof downloadUrl !== 'string' || !downloadUrl.startsWith('http')) {
              throw new Error(res.data?.message || 'Failed to retrieve download link from server.');
            }

            const audioBuffer = await axios.get(downloadUrl, {
              responseType: 'arraybuffer',
              maxContentLength: MAX_MEDIA_BYTES,
              maxBodyLength: MAX_MEDIA_BYTES,
              timeout: 90000,
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
              }
            });

            const cleanFileName = `${songTitle.replace(/[\\/:*?"<>|]/g, '')}.mp3`;

            await socket.sendMessage(from, {
              audio: audioBuffer.data,
              mimetype: 'audio/mpeg',
              fileName: cleanFileName,
              ptt: false
            }, { quoted: infoMsg });

            await socket.sendMessage(from, { react: { text: '✅', key: msg.key } });

          } catch (err) {
            console.error('Music Command Error:', err);
            await socket.sendMessage(from, { react: { text: '❌', key: msg.key } });
            await socket.sendMessage(from, { text: `❌ *Download Failed:* ${err.message}` }, { quoted: msg });
          }
          break;
        }

        case 'lid': {
          let target;
          const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
          const quoted = msg.message?.extendedTextMessage?.contextInfo?.participant;
          const bodyText = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
          const args = bodyText.trim().split(/\s+/).slice(1);
          const query = args.join(' ');

          if (mentioned && mentioned.length > 0) {
            target = mentioned[0];
          } else if (quoted) {
            target = quoted;
          } else if (query) {
            const cleanNumber = query.replace(/[^0-9]/g, '');
            if (cleanNumber) {
              target = `${cleanNumber}@s.whatsapp.net`;
            }
          } else {
            target = msg.key.participant || from;
          }

          if (!target) {
            return await socket.sendMessage(from, { 
              text: '❌ Please provide a number, mention (@user), or reply to a message.' 
            }, { quoted: msg });
          }

          try {
            const [result] = await socket.onWhatsApp(target);

            if (!result || !result.exists) {
              return await socket.sendMessage(from, { 
                text: '❌ This number is not registered on WhatsApp.' 
              }, { quoted: msg });
            }

            const lid = result.lid || 'LID not found.';
            await socket.sendMessage(from, { 
              text: `🆔 *LID:* \`${lid}\`` 
            }, { quoted: msg });

          } catch (error) {
            await socket.sendMessage(from, { 
              text: `❌ Error: ${error.message}` 
            }, { quoted: msg });
          }
          break;
        }

        case 'cine':
        case 'cinesubz': {
          const rawInput = args.join(' ').trim();
          const SESSION_TIMEOUT = 5 * 60 * 1000;
          const CINE_API_BASE = 'https://apis.laksidu.site';

          const getCineFooter = () => `💞 ${botName} 𝒎𝒐𝒗𝒊𝒆 𝒅𝒐𝒘𝒏𝒍𝒐𝒂𝒅𝒆𝒓...\n> 💞 𝒑𝒐𝒘𝒆𝒓𝒆𝒅 𝒃𝒚 𝒌𝒆𝒛𝒖.`;

          const parseDownloads = (data) => {
            if (data.download && Array.isArray(data.download)) {
              return data.download.map(item => ({
                quality: item.name || 'HD',
                size: item.size || 'N/A',
                link: item.url || item.link,
                type: item.type || 'Direct'
              }));
            } else if (data.download_links && Array.isArray(data.download_links)) {
              return data.download_links.map(item => ({
                quality: item.meta || item.type || 'HD',
                size: item.size || 'N/A',
                link: item.url || item.link,
                type: item.type || 'Direct'
              }));
            } else if (data.downloads && Array.isArray(data.downloads)) {
              return data.downloads.map(item => ({
                quality: item.quality || item.name || 'HD',
                size: item.size || item.filesize || 'N/A',
                link: item.url || item.link,
                type: item.type || 'Direct'
              }));
            }
            return [];
          };

          if (!rawInput) {
            const usageText = 
`𝒚𝒐𝒖𝒓 𝒇𝒊𝒍𝒎 𝒓𝒆𝒂𝒅𝒚 𝒕𝒐 𝒘𝒂𝒕𝒄𝒉.🙈
💗${botName} 𝒇𝒊𝒍𝒎 𝒅𝒐𝒘𝒏𝒍𝒐𝒂𝒅𝒆𝒓
╭════˪💞 𝒄𝒊𝒏𝒆 𝒉𝒆𝒍𝒑 ˥═══─┈
┃
┃ 🛟 *Search:* \`${prefix}cine <movie/series name>\`
┃ 🛟 *Select:* \`${prefix}cine <number>\` (e.g. \`${prefix}cine 1\`)
┃
┃ 💡 *Example:* \`${prefix}cine Spider Man\`
╰═══════════════─┈
${getCineFooter()}`;
            return await socket.sendMessage(from, { text: usageText }, { quoted: msg });
          }

          if (!global.cineSessions) global.cineSessions = {};
          const session = global.cineSessions[from];

          const numMatch = rawInput.match(/\d+/);
          const selectedNum = numMatch ? parseInt(numMatch[0], 10) : NaN;
          const isNumericSelection = !isNaN(selectedNum) && selectedNum > 0;

          if (isNumericSelection && session) {
            const elapsed = Date.now() - session.timestamp;
            if (elapsed > SESSION_TIMEOUT) {
              delete global.cineSessions[from];
              const expText = 
`𝒚𝒐𝒖𝒓 𝒇𝒊𝒍𝒎 𝒓𝒆𝒂𝒅𝒚 𝒕𝒐 𝒘𝒂𝒕𝒄𝒉.🙈
💗${botName} 𝒇𝒊𝒍𝒎 𝒅𝒐𝒘𝒏𝒍𝒐𝒂𝒅𝒆𝒓
╭════˪💞 𝒔𝒆𝒔𝒔𝒊𝒐𝒏 𝒆𝒙𝒑𝒊𝒓𝒆𝒅 ˥═══─┈
┃
┃ ⚠️ Session expired! Search again: \`${prefix}cine <name>\`
╰═══════════════─┈
${getCineFooter()}`;
              return await socket.sendMessage(from, { text: expText }, { quoted: msg });
            }

            if (session.step === 'SELECT_ITEM') {
              const choice = selectedNum - 1;
              if (choice < 0 || choice >= session.results.length) {
                return await socket.sendMessage(from, {
                  text: `❌ Invalid! Choose 1-${session.results.length}`
                }, { quoted: msg });
              }

              const selectedItem = session.results[choice];
              const itemUrl = selectedItem.link || selectedItem.url;
              const isTvShow = (itemUrl && itemUrl.includes('/tvshows/')) || selectedItem.type === 'tvshows';

              await socket.sendMessage(from, { react: { text: '⏳', key: msg.key } });

              try {
                if (isTvShow) {
                  const res = await axios.get(`${CINE_API_BASE}/cinesubz/tvshow?url=${encodeURIComponent(itemUrl)}`, { timeout: 30000 });
                  const tvData = res.data?.data || res.data?.result || res.data || {};
                  
                  let episodes = tvData.episodes?.list || tvData.episodes || tvData.episode_list || tvData.links || [];
                  
                  if (tvData.episodes && tvData.episodes.list && Array.isArray(tvData.episodes.list)) {
                    episodes = tvData.episodes.list;
                  }

                  if (!episodes || !episodes.length) {
                    return await socket.sendMessage(from, {
                      text: `❌ No episodes found for this TV Series!`
                    }, { quoted: msg });
                  }

                  const posterUrl = tvData.poster || tvData.image || tvData.thumbnail || selectedItem.poster || selectedItem.image || botLogo;
                  
                  let tvText = `𝒚𝒐𝒖𝒓 𝒇𝒊𝒍𝒎 𝒓𝒆𝒂𝒅𝒚 𝒕𝒐 𝒘𝒂𝒕𝒄𝒉.🙈\n`;
                  tvText += `💗${botName} 𝒇𝒊𝒍𝒎 𝒅𝒐𝒘𝒏𝒍𝒐𝒂𝒅𝒆𝒓\n`;
                  tvText += `╭════˪💞 𝒄𝒊𝒏𝒆 𝒆𝒑𝒊𝒔𝒐𝒅𝒆𝒔 ˥═══─┈\n┃\n`;
                  tvText += `┃ 🎬 *Title:* ${tvData.title || selectedItem.title}\n`;
                  tvText += `┃ ⭐ *IMDB:* ${tvData.rating?.score || tvData.imdb_rating || tvData.imdb || tvData.rating || 'N/A'}\n`;
                  tvText += `┃ 📺 *Episodes:* ${episodes.length}\n┃\n`;

                  episodes.forEach((ep, i) => {
                    const num = (i + 1) < 10 ? `0${i + 1}` : `${i + 1}`;
                    const epTitle = ep.title || ep.name || `Episode ${ep.number || i + 1}`;
                    tvText += `┃ 🛟 ${num} : ${epTitle}\n`;
                  });

                  tvText += `┃\n┃ 💡 *Reply:* \`${prefix}cine <number>\`\n`;
                  tvText += `╰═══════════════─┈\n${getCineFooter()}`;

                  const sentTvMsg = await socket.sendMessage(from, {
                    image: { url: posterUrl },
                    caption: tvText
                  }, { quoted: msg });

                  global.cineSessions[from] = {
                    step: 'SELECT_EPISODE',
                    tvData,
                    episodes,
                    messageId: sentTvMsg?.key?.id,
                    timestamp: Date.now()
                  };
                  return;
                } else {
                  const res = await axios.get(`${CINE_API_BASE}/cinesubz/details?url=${encodeURIComponent(itemUrl)}`, { timeout: 30000 });
                  const movieInfo = res.data?.data || res.data?.result || res.data || {};
                  
                  let validDownloads = parseDownloads(movieInfo);

                  if (!validDownloads.length) {
                    return await socket.sendMessage(from, {
                      text: `❌ No download links found for this movie!`
                    }, { quoted: msg });
                  }

                  const posterUrl = movieInfo.poster || movieInfo.image || movieInfo.thumbnail || selectedItem.poster || selectedItem.image || botLogo;
                  
                  let movieDetailsText = `𝒚𝒐𝒖𝒓 𝒇𝒊𝒍𝒎 𝒓𝒆𝒂𝒅𝒚 𝒕𝒐 𝒘𝒂𝒕𝒄𝒉.🙈\n`;
                  movieDetailsText += `💗${botName} 𝒇𝒊𝒍𝒎 𝒅𝒐𝒘𝒏𝒍𝒐𝒂𝒅𝒆𝒓\n`;
                  movieDetailsText += `╭════˪💞 𝒄𝒊𝒏𝒆 𝒒𝒖𝒂𝒍𝒊𝒕𝒚 ˥═══─┈\n┃\n`;
                  movieDetailsText += `┃ 🎬 *Title:* ${movieInfo.title || selectedItem.title}\n`;
                  movieDetailsText += `┃ ⭐ *IMDB:* ${movieInfo.imdb_rating || movieInfo.imdb || movieInfo.rating || 'N/A'}\n`;
                  movieDetailsText += `┃ 📅 *Year:* ${movieInfo.year || 'N/A'}\n`;
                  movieDetailsText += `┃ ⏳ *Runtime:* ${movieInfo.runtime || movieInfo.duration || 'N/A'}\n`;
                  
                  if (movieInfo.genres && Array.isArray(movieInfo.genres)) {
                    movieDetailsText += `┃ 🎭 *Genres:* ${movieInfo.genres.join(', ')}\n`;
                  }
                  movieDetailsText += `┃\n`;

                  validDownloads.forEach((dl, i) => {
                    const num = (i + 1) < 10 ? `0${i + 1}` : `${i + 1}`;
                    const qName = dl.quality || 'HD';
                    const qSize = dl.size || 'N/A';
                    movieDetailsText += `┃ 🛟 ${num} : ${qName} [${qSize}]\n`;
                  });

                  movieDetailsText += `┃\n┃ 💡 *Reply:* \`${prefix}cine <number>\`\n`;
                  movieDetailsText += `╰═══════════════─┈\n${getCineFooter()}`;

                  const sentQualityMsg = await socket.sendMessage(from, {
                    image: { url: posterUrl },
                    caption: movieDetailsText
                  }, { quoted: msg });

                  global.cineSessions[from] = {
                    step: 'SELECT_QUALITY',
                    itemInfo: movieInfo,
                    selectedItem,
                    downloads: validDownloads,
                    messageId: sentQualityMsg?.key?.id,
                    timestamp: Date.now()
                  };
                  return;
                }

              } catch (err) {
                console.error('Cinesubz Info Error:', err);
                return await socket.sendMessage(from, {
                  text: `❌ Error: ${err.message}`
                }, { quoted: msg });
              }
            }

            if (session.step === 'SELECT_EPISODE') {
              const epChoice = selectedNum - 1;
              if (epChoice < 0 || epChoice >= session.episodes.length) {
                return await socket.sendMessage(from, {
                  text: `❌ Invalid! Choose 1-${session.episodes.length}`
                }, { quoted: msg });
              }

              const selectedEp = session.episodes[epChoice];
              const epUrl = selectedEp.url || selectedEp.link;

              await socket.sendMessage(from, { react: { text: '⏳', key: msg.key } });

              try {
                const res = await axios.get(`${CINE_API_BASE}/api/episode?url=${encodeURIComponent(epUrl)}`, { timeout: 30000 });
                const epData = res.data?.data || res.data?.result || res.data || {};
                
                let validDownloads = parseDownloads(epData);

                if (!validDownloads.length) {
                  return await socket.sendMessage(from, {
                    text: `❌ No download links for this episode!`
                  }, { quoted: msg });
                }

                const epTitle = selectedEp.title || `Episode ${selectedNum}`;
                
                let epDetailsText = `𝒚𝒐𝒖𝒓 𝒇𝒊𝒍𝒎 𝒓𝒆𝒂𝒅𝒚 𝒕𝒐 𝒘𝒂𝒕𝒄𝒉.🙈\n`;
                epDetailsText += `💗${botName} 𝒇𝒊𝒍𝒎 𝒅𝒐𝒘𝒏𝒍𝒐𝒂𝒅𝒆𝒓\n`;
                epDetailsText += `╭════˪💞 𝒄𝒊𝒏𝒆 𝒒𝒖𝒂𝒍𝒊𝒕𝒚 ˥═══─┈\n┃\n`;
                epDetailsText += `┃ 📺 *Series:* ${session.tvData?.title || 'TV Series'}\n`;
                epDetailsText += `┃ 🎬 *Episode:* ${epTitle}\n┃\n`;

                validDownloads.forEach((dl, i) => {
                  const num = (i + 1) < 10 ? `0${i + 1}` : `${i + 1}`;
                  const qName = dl.quality || 'HD';
                  const qSize = dl.size || 'N/A';
                  epDetailsText += `┃ 🛟 ${num} : ${qName} [${qSize}]\n`;
                });

                epDetailsText += `┃\n┃ 💡 *Reply:* \`${prefix}cine <number>\`\n`;
                epDetailsText += `╰═══════════════─┈\n${getCineFooter()}`;

                const sentEpQualityMsg = await socket.sendMessage(from, {
                  image: { url: session.tvData?.poster || session.tvData?.image || botLogo },
                  caption: epDetailsText
                }, { quoted: msg });

                global.cineSessions[from] = {
                  step: 'SELECT_QUALITY',
                  itemInfo: { ...session.tvData, episodeTitle: epTitle },
                  downloads: validDownloads,
                  messageId: sentEpQualityMsg?.key?.id,
                  timestamp: Date.now()
                };
                return;

              } catch (err) {
                console.error('Episode Fetch Error:', err);
                return await socket.sendMessage(from, {
                  text: `❌ Error: ${err.message}`
                }, { quoted: msg });
              }
            }

            if (session.step === 'SELECT_QUALITY') {
              const qChoice = selectedNum - 1;
              if (qChoice < 0 || qChoice >= session.downloads.length) {
                return await socket.sendMessage(from, {
                  text: `❌ Invalid! Choose 1-${session.downloads.length}`
                }, { quoted: msg });
              }

              const selectedDl = session.downloads[qChoice];
              const itemInfo = session.itemInfo || {};
              const title = itemInfo.episodeTitle ? `${itemInfo.title || 'TV Series'} - ${itemInfo.episodeTitle}` : (itemInfo.title || 'Movie');
              const dlQuality = selectedDl.quality || 'HD';
              const targetUrl = selectedDl.link || selectedDl.url;

              await socket.sendMessage(from, { react: { text: '⏳', key: msg.key } });

              const progressText = 
`𝒚𝒐𝒖𝒓 𝒇𝒊𝒍𝒎 𝒓𝒆𝒂𝒅𝒚 𝒕𝒐 𝒘𝒂𝒕𝒄𝒉.🙈
💗${botName} 𝒇𝒊𝒍𝒎 𝒅𝒐𝒘𝒏𝒍𝒐𝒂𝒅𝒆𝒓
╭════˪💞 𝒅𝒐𝒘𝒏𝒍𝒐𝒂𝒅𝒊𝒏𝒈 ˥═══─┈
┃
┃ 🎬 *Title:* ${title}
┃ 💎 *Quality:* ${dlQuality}
┃ ⏳ Resolving...
╰═══════════════─┈
${getCineFooter()}`;

              await socket.sendMessage(from, { text: progressText }, { quoted: msg });

              try {
                const dlRes = await axios.get(`${CINE_API_BASE}/dl/cinesubz?url=${encodeURIComponent(targetUrl)}`, { timeout: 40000 });
                const dlData = dlRes.data?.data || dlRes.data || {};

                let directUrls = [];
                if (dlData.download && Array.isArray(dlData.download)) {
                  directUrls = dlData.download.map(d => d.url).filter(u => u && u.startsWith('http'));
                } else if (dlData.url) {
                  directUrls = [dlData.url];
                } else if (dlData.dl_link) {
                  directUrls = [dlData.dl_link];
                }

                if (!directUrls.length) {
                  throw new Error('No direct download URLs found');
                }

                const cleanFileName = `${title.replace(/[\\/:*?"<>|]/g, '').substring(0, 50)} (${dlQuality}).mp4`;
                const directUrl = directUrls[0];
                
                await socket.sendMessage(from, { react: { text: '📤', key: msg.key } });

                const captionText = 
`𝒚𝒐𝒖𝒓 𝒇𝒊𝒍𝒎 𝒓𝒆𝒂𝒅𝒚 𝒕𝒐 𝒘𝒂𝒕𝒄𝒉.🙈
💗${botName} 𝒇𝒊𝒍𝒎 𝒅𝒐𝒘𝒏𝒍𝒐𝒂𝒅𝒆𝒓
╭════˪💞 𝒄𝒊𝒏𝒆 𝒇𝒊𝒍𝒆 ˥═══─┈
┃
┃ 🎬 *Title:* ${title}
┃ 💎 *Quality:* ${dlQuality}
┃ 🌙 *Source:* CINESUBZ
╰═══════════════─┈
${getCineFooter()}`;

                try {
                  await socket.sendMessage(from, {
                    document: { url: directUrl },
                    mimetype: 'video/mp4',
                    fileName: cleanFileName,
                    caption: captionText
                  }, { quoted: msg });
                  await socket.sendMessage(from, { react: { text: '✅', key: msg.key } });
                } catch (e) {
                  const fallbackText = 
`𝒚𝒐𝒖𝒓 𝒇𝒊𝒍𝒎 𝒓𝒆𝒂𝒅𝒚 𝒕𝒐 𝒘𝒂𝒕𝒄𝒉.🙈
💗${botName} 𝒇𝒊𝒍𝒎 𝒅𝒐𝒘𝒏𝒍𝒐𝒂𝒅𝒆𝒓
╭════˪💞 𝒅𝒊𝒓𝒆𝒄𝒕 𝒍𝒊𝒏𝒌 ˥═══─┈
┃
┃ ⚠️ File too large for WhatsApp
┃ 🎬 *Title:* ${title}
┃
┃ 🔗 *Download:* ${directUrl}
╰═══════════════─┈
${getCineFooter()}`;
                  await socket.sendMessage(from, { text: fallbackText }, { quoted: msg });
                }

              } catch (err) {
                console.error('DL Error:', err);
                await socket.sendMessage(from, { react: { text: '❌', key: msg.key } });
                await socket.sendMessage(from, {
                  text: `❌ Download failed: ${err.message}`
                }, { quoted: msg });
              }

              delete global.cineSessions[from];
              return;
            }
          }

          const query = rawInput;
          await socket.sendMessage(from, { react: { text: '🔍', key: msg.key } });

          try {
            const searchRes = await axios.get(`${CINE_API_BASE}/cinesubz/search?query=${encodeURIComponent(query)}`, { timeout: 20000 });
            let results = searchRes.data?.results || searchRes.data?.data || searchRes.data?.result || [];

            if (!Array.isArray(results) || results.length === 0) {
              await socket.sendMessage(from, { react: { text: '❌', key: msg.key } });
              return await socket.sendMessage(from, { 
                text: `❌ No results for: *${query}*` 
              }, { quoted: msg });
            }

            let listText = `𝒚𝒐𝒖𝒓 𝒇𝒊𝒍𝒎 𝒓𝒆𝒂𝒅𝒚 𝒕𝒐 𝒘𝒂𝒕𝒄𝒉.🙈\n`;
            listText += `💗${botName} 𝒇𝒊𝒍𝒎 𝒅𝒐𝒘𝒏𝒍𝒐𝒂𝒅𝒆𝒓\n`;
            listText += `╭════˪💞 𝒄𝒊𝒏𝒆 𝒓𝒆𝒔𝒖𝒍𝒕𝒔 ˥═══─┈\n┃\n`;

            results.forEach((item, index) => {
              const typeTag = (item.link || item.url || '').includes('/tvshows/') ? '📺' : '🎥';
              const num = (index + 1) < 10 ? `0${index + 1}` : `${index + 1}`;
              const cleanTitle = (item.title || 'Untitled').substring(0, 42);
              listText += `┃ 🛟 ${num} : ${typeTag} ${cleanTitle}\n`;
            });

            listText += `┃\n┃ 💡 *Reply:* \`${prefix}cine <number>\`\n`;
            listText += `┃ ⏰ *Session:* 5 minutes\n`;
            listText += `╰═══════════════─┈\n${getCineFooter()}`;

            const sentCineMsg = await socket.sendMessage(from, {
              image: { url: botLogo },
              caption: listText
            }, { quoted: msg });

            global.cineSessions[from] = {
              step: 'SELECT_ITEM',
              results: results,
              messageId: sentCineMsg?.key?.id,
              timestamp: Date.now()
            };

            await socket.sendMessage(from, { react: { text: '✅', key: msg.key } });

          } catch (err) {
            console.error('Search Error:', err);
            await socket.sendMessage(from, { react: { text: '❌', key: msg.key } });
            await socket.sendMessage(from, { 
              text: `❌ Search error: ${err.message}` 
            }, { quoted: msg });
          }
          break;
        }

        case 'cid':
        case 'channelid': {
          await socket.sendMessage(from, { react: { text: '📢', key: msg.key } });

          try {
            const input = args.join(' ').trim();
            let targetJid = null;
            let inviteCode = null;

            const quotedCtx = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.contextInfo ||
                              msg.message?.extendedTextMessage?.contextInfo;
            const forwardedNewsletter = quotedCtx?.forwardedNewsletterMessageInfo;

            const channelLinkMatch = input.match(/whatsapp\.com\/channel\/([0-9A-Za-z]+)/i);

            if (channelLinkMatch) {
              inviteCode = channelLinkMatch[1];
            } else if (input.endsWith('@newsletter')) {
              targetJid = input;
            } else if (forwardedNewsletter?.newsletterJid) {
              targetJid = forwardedNewsletter.newsletterJid;
            } else if (from.endsWith('@newsletter')) {
              targetJid = from;
            }

            let metadata = null;

            if (inviteCode) {
              metadata = await socket.newsletterMetadata('invite', inviteCode);
            } else if (targetJid) {
              metadata = await socket.newsletterMetadata('jid', targetJid);
            } else {
              return await socket.sendMessage(from, {
                text: `╭───〔 📢 *CHANNEL ID / INFO* 〕───⊷\n│ ⚠️ *Usage:*\n│ • \`${prefix}cid <Channel Link>\`\n│ • \`${prefix}cid <Channel JID>\`\n│ • Inside the channel: \`${prefix}cid\`\n│ • Reply to a channel post: \`${prefix}cid\`\n│\n│ 💡 *Ex:* \`${prefix}cid https://whatsapp.com/channel/0029Va...\`\n╰──────────────────────────⊷`
              }, { quoted: msg });
            }

            if (!metadata) {
              return await socket.sendMessage(from, { 
                text: '❌ Unable to get channel details. Please check if the link or JID is correct.' 
              }, { quoted: msg });
            }

            const chId = metadata.id || targetJid || 'N/A';
            const chName = metadata.name || metadata.thread_metadata?.name?.text || 'Unknown Channel';
            const chSubs = metadata.subscribers || metadata.subscribers_count || metadata.thread_metadata?.subscribers_count || 'N/A';
            const chDesc = metadata.description || metadata.thread_metadata?.description?.text || 'No description';
            const chRole = metadata.viewer_metadata?.role || 'VIEWER';
            const chCreation = metadata.creation_time ? moment(metadata.creation_time * 1000).tz('Asia/Colombo').format('YYYY-MM-DD HH:mm:ss') : 'N/A';
            
            let ppUrl = null;
            try {
              if (metadata.picture || metadata.thread_metadata?.picture?.direct_path) {
                ppUrl = await socket.profilePictureUrl(chId, 'image');
              }
            } catch (e) {
              ppUrl = null;
            }

            const infoText = `〔 📢 *CHANNEL DETAILS* 〕
            
│ 🏷️ *Name:* ${chName}
│ 🆔 *JID:* \`${chId}\`
│ 👥 *Followers:* ${chSubs}
│ 👑 *Your Role:* ${chRole}
│ 📅 *Created:* ${chCreation}
│ 📝 *About:* ${chDesc}

${botFooter}`;

            if (ppUrl) {
              await sendFancyMsg(socket, from, {
                image: { url: ppUrl },
                caption: infoText
              }, msg, userCfg);
            } else {
              await sendFancyMsg(socket, from, {
                text: infoText
              }, msg, userCfg);
            }

            await socket.sendMessage(from, { react: { text: '✅', key: msg.key } });

          } catch (err) {
            console.error('CID Command Error:', err);
            await socket.sendMessage(from, { react: { text: '❌', key: msg.key } });
            await socket.sendMessage(from, { text: `❌ *An error occurred:* ${err.message}` }, { quoted: msg });
          }
          break;
        }

        case 'gjid':
        case 'getjid':
        case 'groupjid': {
          await socket.sendMessage(from, { react: { text: '🔍', key: msg.key } });

          try {
            const input = args.join(' ').trim().toLowerCase();

            if (input === 'all' || input === 'list') {
              const getGroups = await socket.groupFetchAllParticipating();
              const groups = Object.values(getGroups);

              const validGroups = groups.filter(g => g.id && g.id.endsWith('@g.us') && !g.id.includes('@lid'));

              if (validGroups.length === 0) {
                await socket.sendMessage(from, { react: { text: '⚠️', key: msg.key } });
                return await socket.sendMessage(from, { text: '⚠️ No groups found.' }, { quoted: msg });
              }

              let responseText = `╭───────────────━⊷\n│ 👥 *ALL GROUP JIDs (${validGroups.length})*\n╰───────────────━⊷\n\n`;

              validGroups.forEach((g, index) => {
                responseText += `🔹 *${index + 1}. ${g.subject}*\n`;
                responseText += `   📍 *JID:* \`${g.id}\`\n\n`;
              });

              await socket.sendMessage(from, { text: responseText.trim() }, { quoted: msg });
              await socket.sendMessage(from, { react: { text: '✅', key: msg.key } });
              break;
            }

            if (from.endsWith('@g.us') && !from.includes('@lid')) {
              let groupName = 'Group';
              try {
                const metadata = await socket.groupMetadata(from);
                groupName = metadata.subject;
              } catch (e) {}

              const responseText = `╭───────────────━⊷\n│ 👥 *GROUP JID INFO*\n╰───────────────━⊷\n│ 🏷️ *Name:* ${groupName}\n│ 📍 *JID:* \`${from}\`\n╰───────────────━⊷\n\n💡 _To get JIDs of all groups, use \`${prefix}gjid all\`_`;

              await socket.sendMessage(from, { text: responseText }, { quoted: msg });
              await socket.sendMessage(from, { react: { text: '✅', key: msg.key } });

            } else {
              await socket.sendMessage(from, { react: { text: '⚠️', key: msg.key } });
              await socket.sendMessage(from, { 
                text: `╭───────────────━⊷\n│ ⚠️ *This is not a group!*\n│\n│ 🔹 To get a group's JID, use \`${prefix}gjid\` inside the group.\n│ 🔹 To get JIDs of all groups, use \`${prefix}gjid all\`.\n╰───────────────━⊷` 
              }, { quoted: msg });
            }

          } catch (err) {
            console.error('GJID Error:', err);
            await socket.sendMessage(from, { react: { text: '❌', key: msg.key } });
            await socket.sendMessage(from, { text: `❌ Failed to get JID: ${err.message}` }, { quoted: msg });
          }
          break;
        }

        case 'jsend':
        case 'sendjid': {
          const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
          const ctxInfo = msg.message?.extendedTextMessage?.contextInfo;

          if (!quoted) {
            return await socket.sendMessage(from, { 
              text: `╭───────────────━⊷\n│ ⚠️ *Usage:* Reply to any message/media with:\n│ 🔹 \`${prefix}jsend <Target JID(s)>\`\n│\n│ 📌 *Examples:*\n│ • Group: \`${prefix}jsend 12036302482394@g.us\`\n│ • Channel: \`${prefix}jsend 12036302482394@newsletter\`\n│ • User: \`${prefix}jsend 94771234567@s.whatsapp.net\`\n│ • LID: \`${prefix}jsend 12345678901234@lid\`\n│\n│ 💡 _Separate multiple JIDs using commas (,)._\n╰───────────────━⊷` 
            }, { quoted: msg });
          }

          const input = args.join(' ').trim();
          if (!input && (!ctxInfo?.mentionedJid || ctxInfo.mentionedJid.length === 0)) {
            return await socket.sendMessage(from, { 
              text: `❌ Please provide a target JID!\nExample: \`${prefix}jsend 12036302482394@g.us\`` 
            }, { quoted: msg });
          }

          await socket.sendMessage(from, { react: { text: '⚡', key: msg.key } });

          try {
            let targetJids = [];

            if (ctxInfo?.mentionedJid && ctxInfo.mentionedJid.length > 0) {
              targetJids.push(...ctxInfo.mentionedJid);
            }

            if (input) {
              const rawList = input.split(/[\s,]+/);
              for (let item of rawList) {
                let cleanItem = item.trim();
                if (!cleanItem) continue;

                if (cleanItem.endsWith('@us')) {
                  cleanItem = cleanItem.replace(/@us$/, '@s.whatsapp.net');
                } else if (cleanItem.endsWith('@c.us')) {
                  cleanItem = cleanItem.replace(/@c.us$/, '@s.whatsapp.net');
                }

                if (
                  cleanItem.endsWith('@s.whatsapp.net') ||
                  cleanItem.endsWith('@g.us') ||
                  cleanItem.endsWith('@newsletter') ||
                  cleanItem.endsWith('@lid')
                ) {
                  targetJids.push(cleanItem);
                } else {
                  const cleanNum = cleanItem.replace(/[^0-9-]/g, '');
                  if (cleanNum.includes('-') || cleanNum.length > 15) {
                    targetJids.push(`${cleanNum}@g.us`);
                  } else if (cleanNum.length >= 7) {
                    targetJids.push(`${cleanNum}@s.whatsapp.net`);
                  }
                }
              }
            }

            targetJids = [...new Set(targetJids)];

            if (targetJids.length === 0) {
              await socket.sendMessage(from, { react: { text: '❌', key: msg.key } });
              return await socket.sendMessage(from, { text: `❌ No valid JID found!` }, { quoted: msg });
            }

            let cleanQuoted = quoted;
            if (cleanQuoted.ephemeralMessage) cleanQuoted = cleanQuoted.ephemeralMessage.message;
            if (cleanQuoted.viewOnceMessageV2) cleanQuoted = cleanQuoted.viewOnceMessageV2.message;
            if (cleanQuoted.viewOnceMessage) cleanQuoted = cleanQuoted.viewOnceMessage.message;
            if (cleanQuoted.documentWithCaptionMessage) cleanQuoted = cleanQuoted.documentWithCaptionMessage.message;

            const fwdContext = {
              ...(typeof getForwardedContext === 'function' ? getForwardedContext(userCfg) : {}),
              forwardingScore: 9999,
              isForwarded: true
            };

            let successCount = 0;
            let failedCount = 0;

            for (const target of targetJids) {
              try {
                await socket.sendMessage(target, {
                  forward: {
                    key: {
                      remoteJid: from,
                      id: ctxInfo?.stanzaId || msg.key.id,
                      fromMe: !ctxInfo?.participant,
                      participant: ctxInfo?.participant || undefined
                    },
                    message: cleanQuoted
                  },
                  contextInfo: fwdContext
                });
                successCount++;
              } catch (sendErr) {
                console.error(`Failed to forward to ${target}:`, sendErr);
                failedCount++;
              }
            }

            if (successCount > 0) {
              await socket.sendMessage(from, { react: { text: '✅', key: msg.key } });
            } else {
              await socket.sendMessage(from, { react: { text: '❌', key: msg.key } });
              await socket.sendMessage(from, { 
                text: `❌ Forwarding failed for all target JIDs.` 
              }, { quoted: msg });
            }

          } catch (err) {
            console.error('JSend Error:', err);
            await socket.sendMessage(from, { react: { text: '❌', key: msg.key } });
            await socket.sendMessage(from, { text: `❌ Error: ${err.message}` }, { quoted: msg });
          }
          break;
        }

        case 'rename':
        case 'rn':
        case 'renamefile': {
          const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
          let newName = args.join(' ').trim();

          if (!quoted) {
            return await socket.sendMessage(from, {
              text: `╭───────────────━⊷\n│ ⚠️ *Usage:*\n│ Reply to any Document/File with:\n│ 🔹 \`${prefix}rename <new name>\`\n│\n│ 📝 *Ex:* \`${prefix}rename Episode 01.mkv\`\n╰───────────────━⊷`
            }, { quoted: msg });
          }

          if (!newName) {
            return await socket.sendMessage(from, {
              text: `❌ Please enter the new name for the file.\n*Ex:* \`${prefix}rename Sample Document.pdf\``
            }, { quoted: msg });
          }

          let cleanQuoted = quoted;
          if (cleanQuoted.ephemeralMessage) cleanQuoted = cleanQuoted.ephemeralMessage.message;
          if (cleanQuoted.viewOnceMessageV2) cleanQuoted = cleanQuoted.viewOnceMessageV2.message;
          if (cleanQuoted.viewOnceMessage) cleanQuoted = cleanQuoted.viewOnceMessage.message;

          const targetDoc = cleanQuoted.documentWithCaptionMessage?.message?.documentMessage 
            || cleanQuoted.documentMessage 
            || cleanQuoted.videoMessage 
            || cleanQuoted.audioMessage 
            || cleanQuoted.imageMessage;

          if (!targetDoc) {
            return await socket.sendMessage(from, {
              text: '❌ Please reply to a valid Document or File.'
            }, { quoted: msg });
          }

          await socket.sendMessage(from, { react: { text: '⏳', key: msg.key } });

          try {
            const origFileName = targetDoc.fileName || '';
            const mimetype = targetDoc.mimetype || 'application/octet-stream';

            let origExt = '';
            if (origFileName && origFileName.includes('.')) {
              origExt = '.' + origFileName.split('.').pop();
            }

            if (origExt && !newName.toLowerCase().endsWith(origExt.toLowerCase()) && !newName.includes('.')) {
              newName += origExt;
            }

            const cleanFileName = newName.replace(/[\\/:*?"<>|]/g, '');

            const buffer = await downloadMediaMessage(cleanQuoted);

            if (!buffer || buffer.length === 0) {
              throw new Error('Failed to download the file.');
            }

            await socket.sendMessage(from, {
              document: buffer,
              mimetype: mimetype,
              fileName: cleanFileName,
              caption: `📄 *Renamed File:* \`${cleanFileName}\`\n\n${botFooter}`
            }, { quoted: msg });

            await socket.sendMessage(from, { react: { text: '✅', key: msg.key } });

          } catch (err) {
            console.error('Rename Error:', err);
            await socket.sendMessage(from, { react: { text: '❌', key: msg.key } });
            await socket.sendMessage(from, { text: `❌ *Rename Error:* ${err.message}` }, { quoted: msg });
          }
          break;
        }

        // ====================================================
        // 🎬 MOVIE SEARCH & DOWNLOADER (KEZU / CHAMA API)
        // ====================================================
        case 'movie':
        case 'm': {
          const input = args.join(' ').trim();
          const SESSION_TIMEOUT = 5 * 60 * 1000;
          const API_BASE = config.API_MAIN_URL1 ? config.API_MAIN_URL1.replace(/\/$/, '') : 'https://chama-movie-api-new.koyeb.app';
          const API_KEY = config.API_KEY_1 || 'chama_api_7f4ac9c10c749bcedbd4437a066009a2';

          if (!input) {
            return await socket.sendMessage(from, {
              text: `╭───〔 🎬 *MOVIE DOWNLOADER* 〕───⊷\n│ ⚠️ *help:*\n│ • \`${prefix}movie <name>\` (to search)\n│ • \`1, 2, 3...\` (reply a number)\n│\n│ 💡 *Ex:* \`${prefix}movie avatar\`\n╰──────────────────────────⊷`
            }, { quoted: msg });
          }

          if (!global.movieSessions) global.movieSessions = {};
          const session = global.movieSessions[from];

          const selectedNum = parseInt(input);
          const isSelection = !isNaN(selectedNum) && String(selectedNum) === input;

          if (isSelection && session) {
            const elapsed = Date.now() - session.timestamp;
            if (elapsed > SESSION_TIMEOUT) {
              delete global.movieSessions[from];
              return await socket.sendMessage(from, { 
                text: `⌛ *Session has expired.* Please search again using \`${prefix}movie <name>\`.` 
              }, { quoted: msg });
            }

            if (session.step === 'SELECT_MOVIE') {
              const choice = selectedNum - 1;
              if (choice < 0 || choice >= session.results.length) {
                return await socket.sendMessage(from, { 
                  text: `❌ Please provide a valid number between 1 and ${session.results.length}.` 
                }, { quoted: msg });
              }

              const selectedItem = session.results[choice];
              const site = selectedItem.site;

              await socket.sendMessage(from, { react: { text: '⏳', key: msg.key } });

              try {
                const infoEndpoint = site === 'moviebox' ? 'info' : 'infodl';
                const detailsUrl = `${API_BASE}/api/v1/movie/${site}/${infoEndpoint}?q=${encodeURIComponent(selectedItem.link)}&api_key=${API_KEY}`;
                const detailsResponse = await axios.get(detailsUrl, { timeout: 30000 });
                const movieInfo = detailsResponse.data?.data || {};
                const validDownloads = movieInfo.downloads || [];

                if (!validDownloads.length) {
                  return await socket.sendMessage(from, { 
                    text: `❌ *No direct downloads found for this title!*\nTry selecting from a different source.` 
                  }, { quoted: msg });
                }

                const posterUrl = movieInfo.image || selectedItem.image || config.DEFAULT_LOGO;
                let movieDetailsText = `╭───〔 🎬 *${(botName || 'MOVIE BOT').toUpperCase()} DETAILS* 〕───⊷\n`;
                movieDetailsText += `│ 🎬 *Title:* ${movieInfo.title || selectedItem.title}\n`;
                movieDetailsText += `│ ⭐ *IMDB:* ★ ${movieInfo.imdb || movieInfo.rating || 'N/A'}\n`;
                movieDetailsText += `│ 📅 *Year:* ${movieInfo.year || 'N/A'}\n`;
                movieDetailsText += `│ ⏳ *Duration:* ${movieInfo.duration || 'N/A'}\n`;
                movieDetailsText += `│ 🎭 *Genres:* ${Array.isArray(movieInfo.genres) ? movieInfo.genres.join(', ') : (movieInfo.genres || 'N/A')}\n`;
                movieDetailsText += `│ 🗿 *Source:* ${site.toUpperCase()}\n`;
                movieDetailsText += `╰──────────────────────────⊷\n\n`;
                movieDetailsText += `*👇 SELECT QUALITY NUMBER 👇*\n\n`;

                validDownloads.forEach((dl, i) => {
                  const num = (i + 1) < 10 ? `0${i + 1}` : `${i + 1}`;
                  movieDetailsText += `*${num}* ➜ 💎 _${dl.quality || dl.name || 'HD'}_ 💾 _${dl.size || 'N/A'}_\n`;
                });

                movieDetailsText += `\n> 💡 *Reply with just the number to download (e.g.: 1)*`;
                movieDetailsText += `\n${botFooter}`;

                const sentQualityMsg = await socket.sendMessage(from, {
                  image: { url: posterUrl },
                  caption: movieDetailsText
                }, { quoted: msg });

                global.movieSessions[from] = {
                  step: 'SELECT_QUALITY',
                  movieInfo,
                  selectedItem,
                  downloads: validDownloads,
                  messageId: sentQualityMsg?.key?.id,
                  timestamp: Date.now()
                };

              } catch (err) {
                console.error('Movie Info Error:', err);
                await socket.sendMessage(from, { 
                  text: `❌ *An error occurred while fetching details:* ${err.message}` 
                }, { quoted: msg });
              }
              return;
            }

            if (session.step === 'SELECT_QUALITY') {
              const qChoice = selectedNum - 1;
              if (qChoice < 0 || qChoice >= session.downloads.length) {
                return await socket.sendMessage(from, { 
                  text: `❌ Please provide a quality number between 1 and ${session.downloads.length}.` 
                }, { quoted: msg });
              }

              const selectedDl = session.downloads[qChoice];
              const movieInfo = session.movieInfo || {};
              const title = movieInfo.title || session.selectedItem?.title || 'Movie';
              const dlQuality = selectedDl.quality || selectedDl.name || 'HD';
              const cleanFileName = `${title.replace(/[\\/:*?"<>|]/g, '')} (${dlQuality}).mp4`;

              await socket.sendMessage(from, { react: { text: '📤', key: msg.key } });
              await socket.sendMessage(from, { 
                text: `🎬 *Downloading & Uploading:* _${title} (${dlQuality})_...\n⏳ Please wait.` 
              }, { quoted: msg });

              try {
                await socket.sendMessage(from, {
                  document: { url: selectedDl.link },
                  mimetype: 'video/mp4',
                  fileName: cleanFileName,
                  caption: `🎬 *${title}*\n📊 *Quality:* ${dlQuality}\n${botFooter}`
                }, { quoted: msg });

                await socket.sendMessage(from, { react: { text: '✅', key: msg.key } });
              } catch (e) {
                await socket.sendMessage(from, { 
                  text: `⚠️ *The file is too large to upload directly via WhatsApp.*\n\n📌 *Direct Download Link:*\n${selectedDl.link}\n\n${botFooter}` 
                }, { quoted: msg });
              }

              delete global.movieSessions[from];
              return;
            }
          }

          const query = input;
          await socket.sendMessage(from, { react: { text: '🔍', key: msg.key } });
          await socket.sendMessage(from, { text: `🔍 *Searching across all Movie Sources for:* _${query}_...` }, { quoted: msg });

          const sites = ["cinesubz", "sinhalasub", "thenkiri", "moviesublk", "baiscope", "cineru"];
          const promises = sites.map(site =>
            axios.get(`${API_BASE}/api/v1/movie/${site}/search?q=${encodeURIComponent(query)}&api_key=${API_KEY}`, { timeout: 15000 })
              .then(res => (res.data?.status && Array.isArray(res.data?.data)) ? res.data.data.map(item => ({ ...item, site })) : [])
              .catch(() => [])
          );

          const resultsArrays = await Promise.all(promises);
          let results = [];
          const maxLen = Math.max(...resultsArrays.map(arr => arr.length), 0);
          for (let i = 0; i < maxLen; i++) {
            for (const arr of resultsArrays) {
              if (i < arr.length) results.push(arr[i]);
            }
          }

          if (results.length === 0) {
            await socket.sendMessage(from, { react: { text: '❌', key: msg.key } });
            return await socket.sendMessage(from, { text: `😞 *No movie results found for:* _${query}_` }, { quoted: msg });
          }

          let listText = `╭───〔 🍿 *${(botName || 'MOVIE BOT').toUpperCase()} SEARCH* 🍿 〕───⊷\n`;
          listText += `│ 🎯 *Query:* _${query}_\n`;
          listText += `│ 📊 *Results:* _${results.length} Items_\n`;
          listText += `╰──────────────────────────⊷\n\n`;
          listText += `*👇 SELECT A MOVIE NUMBER 👇*\n\n`;

          results.forEach((item, index) => {
            const siteTag = item.site ? item.site.toUpperCase() : 'SITE';
            const typeIcon = item.type === 'tvshows' ? '📺' : '🎥';
            const num = (index + 1) < 10 ? `0${index + 1}` : `${index + 1}`;
            const cleanTitle = (item.title || 'Untitled').substring(0, 40);
            listText += `*${num}.* ${typeIcon} [_${siteTag}_] _${cleanTitle}_\n`;
          });

          listText += `\n> 💡 *Reply with just the number of the movie you want (e.g.: 1)*`;
          listText += `\n> ⏰ _Valid for: 5 minutes_`;
          listText += `\n${botFooter}`;

          const sentMovieMsg = await socket.sendMessage(from, {
            image: { url: botLogo },
            caption: listText
          }, { quoted: msg });

          global.movieSessions[from] = {
            step: 'SELECT_MOVIE',
            results: results,
            messageId: sentMovieMsg?.key?.id,
            timestamp: Date.now()
          };

          await socket.sendMessage(from, { react: { text: '✅', key: msg.key } });
          break;
        }

        case 'ping':
        case 'p': {
          const start = Date.now();
          await socket.sendMessage(from, { react: { text: '⚡', key: msg.key } });
          const latency = Date.now() - start;
          const uptime = process.uptime();
          const runtime = `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`;
          const ram = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);

          let speedTier = '🚀 LIGHTNING';
          if (latency > 250) speedTier = '⚡ ULTRA FAST';
          if (latency > 600) speedTier = '🐢 NORMAL';

          const moddedPing = "```" + `
「 🌙 ${(botName || 'BOT').toUpperCase()} SPEED 🌙 」
╭─────────────────○◦
│ 🪻 SPEED   : ${latency}ms [${speedTier}]
╰─────────────────○◦
│ ⏱️ RUNTIME : ${runtime}
│ 💾 RAM     : ${ram} MB
│ 🌷 BOT     : ${botName}
│ 👑 MASTER  : ${config.OWNER_NAME}
╰─────────────────○◦
` + "```";

          await socket.sendMessage(from, { text: moddedPing.trim() }, { quoted: msg });
          break;
        }

        case 'menu':
        case 'help':
        case 'panel': {
          await socket.sendMessage(from, { react: { text: "🌙", key: msg.key } });
          const uptime = process.uptime();
          const runtime = `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`;
          const ramUsage = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);

          const mainText = `*│*  *${botName}* 
*╭─────────────···▸*
*│* 👤 *User:* @${senderNumber}
*│* ⏱️ *Uptime:* ${runtime}
*│* 💾 *RAM:* ${ramUsage} MB
*│* 🔣 *Prefix:* \`${prefix}\`
*╰──────────────···▸*

🔢 *REPLY WITH A CATEGORY NUMBER:*

*╭─『 📚 ALL CATEGORIES 』*
*│ [1]* 📥 *Downloaders* 
*│ [2]* 👥 *Group Admin & Protection*
*│ [3]* 🛠️ *Utilities & Tools* 
*│ [4]* 🎭 *Fun & Games*
*│ [5]* ⚙️ *Settings & Bot Toggles*
*│ [6]* 📢 *Channel & Newsletter Suite*
*│ [7]* 🎨 *Bot Customization*
*╰────────────────────*

🌼 𝒉𝒆𝒍𝒍𝒐 𝒊 𝒂𝒎 ${botName}.🌙
🍃 *check bot speed, type ${prefix}ping*

> 💡 *Quick Action:* Reply directly with *1*, *2*, *3*, *4*, *5*, *6*, or *7* to view commands.
${botFooter}`.trim();

          const sentMenu = await sendFancyMsg(socket, from, {
            image: { url: botLogo },
            caption: mainText,
            mentions: [nowsender]
          }, msg, userCfg);

          if (sentMenu?.key?.id) {
            userMenuState.set(from, { id: sentMenu.key.id, timestamp: Date.now() });
          }
          break;
        }

        case 'dlmenu': {
          const dlText = `
*╭───❰ 📥 DOWNLOAD MENU ❱───*
*│* 🎵 \`${prefix}song <name/url>\` - Download MP3
*│* 🎬 \`${prefix}video <name/url>\` - Download MP4
*│* 🎵 \`${prefix}tiktok <url>\` - TikTok No Watermark
*│* 📘 \`${prefix}fb <url>\` - Facebook Video
*│* 📷 \`${prefix}ig <url>\` - Instagram Downloader
*│* 📌 \`${prefix}pin <query>\` - Pinterest Downloader
*│* 🌐 \`${prefix}tourl\` - File to Direct Link
*│* 🌙 \`${prefix}movie <name>\` - 23 Site Movie Hub
*│* 👀 \`${prefix}cine <name>\` - cinesubz movie
*╰────────────────────────*
${botFooter}`;
          await sendFancyMsg(socket, from, { image: { url: botLogo }, caption: dlText }, msg, userCfg);
          break;
        }

        case 'groupmenu': {
          const gText = `
*╭───❰ 👥 GROUP COMMANDS ❱───*
*│* 🛡️ \`${prefix}antilink on/off\` - Auto delete invite links
*│* 🤖 \`${prefix}antibot on/off\` - Auto kick other bots
*│* 🤬 \`${prefix}antibadword on/off\` - Filter bad words
*│* ➕ \`${prefix}addbadword <word>\` - Add word to list
*│* ➖ \`${prefix}delbadword <word>\` - Remove bad word
*│* 👋 \`${prefix}welcome on/off\` - New member greetings
*│* 🚪 \`${prefix}goodbye on/off\` - Leaving member message
*│* 📢 \`${prefix}tagall <text>\` - Mention everyone
*│* 👻 \`${prefix}hidetag <text>\` - Ghost mention
*│* 👑 \`${prefix}promote @user\` - Give Admin
*│* 👤 \`${prefix}demote @user\` - Remove Admin
*│* 🚫 \`${prefix}kick @user\` - Remove participant
*│* 🔒 \`${prefix}mute\` / \`${prefix}unmute\` - Group chat lock
*│* 🔗 \`${prefix}glink\` - Get Group Invite Link
*│* 🌙 \`${prefix}antistatus\` - auto status delete
*│* 🚫 \`${prefix}anticall\` - no call allowed
*╰────────────────────────*
${botFooter}`;
          await sendFancyMsg(socket, from, { image: { url: botLogo }, caption: gText }, msg, userCfg);
          break;
        }

        case 'utilmenu': {
          const uText = `
*╭───❰ 🛠️ UTILITY COMMANDS ❱───*
*│* 👁️ \`${prefix}vv\` / \`${prefix}readviewonce\` - Retrieve View-Once Media
*│* 🐇 \`${prefix}logout <name>\` - remove the bot
*│* 📥 \`${prefix}savestatus\` / \`${prefix}ss\` - Save quoted Status
*│* 🎨 \`${prefix}sticker\` / \`${prefix}s\` - Make Sticker from Photo/Video
*│* 🏷️ \`${prefix}take <pack> | <author>\` - Rename Sticker
*│* 🆔 \`${prefix}jid\` - Get Chat or User JID
*│* 🌙 \`${prefix}gjid\` - group jid
*│* 🫠 \`${prefix}cid <name>\` - channel jid
*│* 🍃 \`${prefix}lid\` - contact lid
*│* 👤 \`${prefix}userinfo @user\` - Get User Profile & DP
*│* 🚪 \`${prefix}logout\` - Log Out & Clear Session
*│* ➕ \`${prefix}addreply <text|audio|image|video>|<word>|<content/url>\`
*│* ➖ \`${prefix}delreply <trigger_word>\`
*│* 📋 \`${prefix}listreply\` - View custom auto-replies
*╰────────────────────────*
${botFooter}`;
          await sendFancyMsg(socket, from, { image: { url: botLogo }, caption: uText }, msg, userCfg);
          break;
        }

        case 'funmenu': {
          const fText = `
*╭───❰ 🎭 FUN & GAMES ❱───*
*│* 💖 \`${prefix}ship @user1 @user2\` - Love Compatibility %
*│* 😂 \`${prefix}joke\` - Random Funny Joke
*│* 💡 \`${prefix}fact\` - Interesting Random Fact
*│* 🔥 \`${prefix}dare\` - Random Dare challenge
*│* 🤫 \`${prefix}truth\` - Random Truth question
*│* ✊ \`${prefix}rps <rock|paper|scissors>\` - Mini Game
*╰────────────────────────*
${botFooter}`;
          await sendFancyMsg(socket, from, { image: { url: botLogo }, caption: fText }, msg, userCfg);
          break;
        }

        case 'settingsmenu':
        case 'settings': {
          const sText = `
*╭───❰ ⚙️ SETTINGS PANEL ❱───*
*│* 👁️ *Auto Status View:* ${userCfg.AUTO_VIEW_STATUS || 'true'}
*│* ❤️ *Auto Status React:* ${userCfg.AUTO_LIKE_STATUS || 'true'}
*│* ✍️ *Auto Typing:* ${userCfg.AUTO_TYPING || 'false'}
*│* 🎙️ *Auto Recording:* ${userCfg.AUTO_RECORDING || 'false'}
*│* 🗑️ *Anti Delete:* ${userCfg.ANTI_DELETE || 'off'}
*│* 🌐 *Bot Mode:* ${userCfg.MODE || 'public'}
*│* 🔣 *Current Prefix:* \`${prefix}\`
*│* 🌙 *Status Emojis:* ${(userCfg.AUTO_LIKE_EMOJI || config.AUTO_LIKE_EMOJI).join(' ')}
*╰────────────────────────*

*🔧 TOGGLE SHORTCUTS:*
• \`${prefix}autostatusview on/off\`
• \`${prefix}autostatusreact on/off\`
• \`${prefix}autotyping on/off\`
• \`${prefix}autorecording on/off\`
• \`${prefix}antidelete on/off\`
• \`${prefix}addsudo on/off\`
• \`${prefix}delsudo on/off\`
• \`${prefix}mode <public|private|inbox|group>\`
• \`${prefix}setstatusemoji <emojis>\`


${botFooter}`;
          await sendFancyMsg(socket, from, { image: { url: botLogo }, caption: sText }, msg, userCfg);
          break;
        }

        case 'channelmenu': {
          const chText = `
*╭───❰ 📢 CHANNEL COMMANDS ❱───*
*│* ℹ️ \`${prefix}channelinfo <jid/url>\` - Newsletter Info
*│* 💖 \`${prefix}channelreact <jid> <server_msg_id> <emoji>\`
*│* 🚀 \`${prefix}channelpost <jid> <message>\` - Post to Channel
*╰────────────────────────*
${botFooter}`;
          await sendFancyMsg(socket, from, { image: { url: botLogo }, caption: chText }, msg, userCfg);
          break;
        }

        case 'customizemenu': {
          const cText = `
*╭───❰ 🎨 CUSTOMIZE BOT ❱───*
*│* 🏷️ \`${prefix}setbotname <New Name>\`
*│* 🖼️ \`${prefix}setlogo <Image Direct URL>\`
*│* 🔣 \`${prefix}setprefix <symbol>\`
*│* 📜 \`${prefix}setfooter <Footer Text>\`
*│* 🌙 \`${prefix}setstatusemoji <emoji1,emoji2>\`
*│* ⚡ \`${prefix}ping\` - Check Latency
*│* 🖥️ \`${prefix}system\` - Host Stats
*│* 👑 \`${prefix}owner\` - Owner Contact Info
*│* 📍 \`${prefix}alive\` - Bot Status
*╰────────────────────────*
${botFooter}`;
          await sendFancyMsg(socket, from, { image: { url: botLogo }, caption: cText }, msg, userCfg);
          break;
        }

        case 'forward':
        case 'fwd':
        case 'sendto': {
          const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
          const ctxInfo = msg.message?.extendedTextMessage?.contextInfo;

          if (!quoted) {
            return await socket.sendMessage(from, { 
              text: `╭───────────────━⊷\n│ ⚠️ *Usage:* Reply to any Message/File with:\n│ 🔹 \`${prefix}forward <Number / Group JID>\`\n│ 🔹 \`${prefix}forward @user\`\n│ 🔹 \`${prefix}forward\` (to forward to this same chat)\n│ 💡 _You can also send to multiple recipients at once using commas (,)._\n╰───────────────━⊷` 
            }, { quoted: msg });
          }

          await socket.sendMessage(from, { react: { text: '⚡', key: msg.key } });

          try {
            let targetJids = [];
            const input = args.join(' ').trim();

            if (ctxInfo?.mentionedJid && ctxInfo.mentionedJid.length > 0) {
              targetJids.push(...ctxInfo.mentionedJid);
            } else if (input) {
              const rawList = input.split(/[\s,]+/);
              for (let item of rawList) {
                item = item.trim();
                if (!item) continue;

                if (item.endsWith('@s.whatsapp.net') || item.endsWith('@g.us') || item.endsWith('@newsletter')) {
                  targetJids.push(item);
                } else {
                  const cleanNum = item.replace(/[^0-9]/g, '');
                  if (cleanNum.length >= 7) {
                    targetJids.push(cleanNum + '@s.whatsapp.net');
                  }
                }
              }
            }

            if (targetJids.length === 0) {
              targetJids.push(from);
            }

            let cleanQuoted = quoted;
            if (cleanQuoted.ephemeralMessage) cleanQuoted = cleanQuoted.ephemeralMessage.message;
            if (cleanQuoted.viewOnceMessageV2) cleanQuoted = cleanQuoted.viewOnceMessageV2.message;
            if (cleanQuoted.viewOnceMessage) cleanQuoted = cleanQuoted.viewOnceMessage.message;

            const fwdContext = {
              ...getForwardedContext(userCfg),
              forwardingScore: 9999,
              isForwarded: true
            };

            for (const target of targetJids) {
              await socket.sendMessage(target, {
                forward: {
                  key: {
                    remoteJid: from,
                    id: ctxInfo.stanzaId,
                    fromMe: !ctxInfo.participant,
                    participant: ctxInfo.participant
                  },
                  message: cleanQuoted
                },
                contextInfo: fwdContext
              });
            }

            await socket.sendMessage(from, { react: { text: '✅', key: msg.key } });

          } catch (err) {
            console.error('Forward Error:', err);
            await socket.sendMessage(from, { react: { text: '❌', key: msg.key } });
            await socket.sendMessage(from, { text: `❌ Forward Failed: ${err.message}` }, { quoted: msg });
          }
          break;
        }

        case 'sessions':
        case 'listsessions':
        case 'bots': {
          if (!isMasterOwner) return await socket.sendMessage(from, { text: '❌ This command can only be used by the Main Bot Owner.' }, { quoted: msg });
          const allDbNums = await getAllNumbersFromMongo();
          const activeList = Array.from(activeSockets.keys());
          
          let text = `╭─〔 🤖 *ALL REGISTERED SESSIONS* 〕──⊷\n`;
          text += `│ 🟢 *Active Bots:* ${activeList.length}\n`;
          text += `│ 📦 *Total in Database:* ${allDbNums.length}\n╰────────────────────────⊷\n\n`;
          
          if (!allDbNums.length) {
            text += `_No sessions found._`;
          } else {
            allDbNums.forEach((n, idx) => {
              const isActive = activeSockets.has(n);
              text += `*${idx + 1}.* +${n} ➔ ${isActive ? '🟢 Active' : '🔴 Offline'}\n`;
            });
          }
          text += `\n> 💡 *Update any bot:* \`${prefix}setbotcfg <number> <key> <value>\``;
          await socket.sendMessage(from, { text }, { quoted: msg });
          break;
        }

        case 'setbotcfg':
        case 'setbotconfig': {
          if (!isOwnerUser) return await socket.sendMessage(from, { text: '❌ This command can only be used by the Bot Owner or a sudo user.' }, { quoted: msg });
          if (args.length < 3) {
            return await socket.sendMessage(from, {
              text: `╭───────────────━⊷\n│ ⚠️ *Usage:* \`${prefix}setbotcfg <number> <key> <value>\`\n│ 💡 *Keys:* \`prefix\`, \`botname\`, \`autoview\`, \`autolike\`, \`autotyping\`, \`autorecording\`, \`antidelete\`, \`mode\`, \`logo\`, \`footer\`\n│ 📝 *e.g.:* \`${prefix}setbotcfg 94789088223 mode private\`\n╰───────────────━⊷`
            }, { quoted: msg });
          }
          const targetNum = args[0].replace(/[^0-9]/g, '');
          const key = args[1].toLowerCase();
          const val = args.slice(2).join(' ').trim();

          const targetCfg = await loadUserConfigFromMongo(targetNum);

          if (key === 'prefix') targetCfg.PREFIX = val;
          else if (key === 'botname') targetCfg.botName = val;
          else if (key === 'logo') targetCfg.logo = val;
          else if (key === 'footer') targetCfg.footer = `> *${val}*`;
          else if (key === 'autoview' || key === 'autostatusview') targetCfg.AUTO_VIEW_STATUS = (val === 'on' || val === 'true') ? 'true' : 'false';
          else if (key === 'autolike' || key === 'autostatusreact') targetCfg.AUTO_LIKE_STATUS = (val === 'on' || val === 'true') ? 'true' : 'false';
          else if (key === 'autotyping') targetCfg.AUTO_TYPING = (val === 'on' || val === 'true') ? 'true' : 'false';
          else if (key === 'autorecording') targetCfg.AUTO_RECORDING = (val === 'on' || val === 'true') ? 'true' : 'false';
          else if (key === 'antidelete') targetCfg.ANTI_DELETE = (val === 'on' || val === 'true') ? 'true' : 'off';
          else if (key === 'mode') {
            const m = val.toLowerCase();
            if (!['public', 'private', 'inbox', 'group'].includes(m)) {
              return await socket.sendMessage(from, { text: `❌ *mode* must be one of: public, private, inbox, group.` }, { quoted: msg });
            }
            targetCfg.MODE = m;
          }
          else {
            return await socket.sendMessage(from, { text: `❌ Please provide a valid key.` }, { quoted: msg });
          }

          await setUserConfigInMongo(targetNum, targetCfg);
          await socket.sendMessage(from, { text: `✅ The *${key}* setting for +${targetNum} was successfully updated to *${val}*.` }, { quoted: msg });
          break;
        }

        case 'addsudo': {
          if (!isMasterOwner && !isBot) return await socket.sendMessage(from, { text: '❌ This command can only be used by the Bot Owner.' }, { quoted: msg });
          const target = (args[0] || '').replace(/[^0-9]/g, '');
          if (!target) {
            return await socket.sendMessage(from, { text: `❌ *Usage:* \`${prefix}addsudo <number>\`` }, { quoted: msg });
          }
          const cfgList = Array.isArray(userCfg.SUDO_NUMBERS) ? [...userCfg.SUDO_NUMBERS] : [];
          if (cfgList.includes(target)) {
            return await socket.sendMessage(from, { text: `⚠️ +${target} is already a sudo user.` }, { quoted: msg });
          }
          cfgList.push(target);
          userCfg.SUDO_NUMBERS = cfgList;
          await setUserConfigInMongo(sanitizedNum, userCfg);
          await socket.sendMessage(from, { text: `✅ +${target} added as a sudo user. They now have full owner-level settings access from any chat (inbox, group, anywhere).` }, { quoted: msg });
          break;
        }

        case 'delsudo':
        case 'removesudo': {
          if (!isMasterOwner && !isBot) return await socket.sendMessage(from, { text: '❌ This command can only be used by the Bot Owner.' }, { quoted: msg });
          const target = (args[0] || '').replace(/[^0-9]/g, '');
          if (!target) {
            return await socket.sendMessage(from, { text: `❌ *Usage:* \`${prefix}delsudo <number>\`` }, { quoted: msg });
          }
          const cfgList = (Array.isArray(userCfg.SUDO_NUMBERS) ? userCfg.SUDO_NUMBERS : []).filter(n => n !== target);
          userCfg.SUDO_NUMBERS = cfgList;
          await setUserConfigInMongo(sanitizedNum, userCfg);
          await socket.sendMessage(from, { text: `✅ +${target} removed from sudo users.` }, { quoted: msg });
          break;
        }

        case 'sudolist':
        case 'listsudo': {
          if (!isOwnerUser) return;
          const cfgList = Array.isArray(userCfg.SUDO_NUMBERS) ? userCfg.SUDO_NUMBERS : [];
          const listText = cfgList.length
            ? `╭───〔 👑 *SUDO USERS* 〕───⊷\n${cfgList.map((n, i) => `│ ${i + 1}. +${n}`).join('\n')}\n╰──────────────────────────⊷`
            : `👑 No sudo users added yet. Use \`${prefix}addsudo <number>\`.`;
          await socket.sendMessage(from, { text: listText }, { quoted: msg });
          break;
        }

        case 'mode':
        case 'setmode': {
          if (!isOwnerUser) return;
          const validModes = ['public', 'private', 'inbox', 'group'];
          const wanted = (args[0] || '').toLowerCase();
          if (!validModes.includes(wanted)) {
            return await socket.sendMessage(from, {
              text: `╭───────────────━⊷\n│ ⚠️ *Usage:* \`${prefix}mode <public|private|inbox|group>\`\n│\n│ 🌐 *public*  - Bot replies to everyone, everywhere\n│ 🔒 *private* - Bot replies only to owner/sudo users\n│ 📥 *inbox*   - Bot replies only in DM/inbox chats\n│ 👥 *group*   - Bot replies only inside groups\n│\n│ 👑 Sudo/owner numbers always bypass this, in any mode.\n│ ⚙️ *Current mode:* ${botMode}\n╰───────────────━⊷`
            }, { quoted: msg });
          }
          userCfg.MODE = wanted;
          await setUserConfigInMongo(sanitizedNum, userCfg);
          await socket.sendMessage(from, { text: `✅ Bot mode set to *${wanted}*. Sudo/owner numbers can still use every command from any chat regardless of this mode.` }, { quoted: msg });
          break;
        }

        case 'setstatusemoji':
        case 'setstatusemojis': {
          if (!isOwnerUser) return;
          const emojisInput = args.join(' ').trim();
          if (!emojisInput) {
            return await socket.sendMessage(from, { text: `╭───────────────━⊷\n│ ⚠️ *Usage:* \`${prefix}setstatusemoji <emojis, comma separated>\`\n│ 💡 *e.g.:* \`${prefix}setstatusemoji 🌙,🪻,🌷,❤️\`\n╰───────────────━⊷` }, { quoted: msg });
          }
          const emojiList = emojisInput.split(/[\s,]+/).filter(Boolean);
          if (!emojiList.length) return await socket.sendMessage(from, { text: '❌ Please provide valid emojis.' }, { quoted: msg });
          
          userCfg.AUTO_LIKE_EMOJI = emojiList;
          await setUserConfigInMongo(sanitizedNum, userCfg);
          await socket.sendMessage(from, { text: `✅ Status reaction emojis updated: ${emojiList.join(' ')}` }, { quoted: msg });
          break;
        }

        case 'logout':
        case 'delsession':
        case 'clearsession': {
          if (!isOwnerUser) return;
          await socket.sendMessage(from, { text: '🗑️ *Deleting bot session and disconnecting...*' }, { quoted: msg });
          await delay(1500);
          await deleteEntireSession(sanitizedNum);
          break;
        }

        case 'pin':
        case 'pinterest': {
          const input = args.join(' ').trim();
          const SESSION_TIMEOUT = 5 * 60 * 1000;

          if (!input) {
            return await socket.sendMessage(from, { 
              text: `╭───────────────━⊷\n│ ⚠️ *Usage:* \`${prefix}pin <search term>\`\n│ 💡 _After searching, reply with the number (e.g.: 1)_\n╰───────────────━⊷` 
            }, { quoted: msg });
          }

          const selectedNum = parseInt(input);
          const isSelection = !isNaN(selectedNum) && String(selectedNum) === input;

          if (isSelection) {
            const session = global.pinSessions?.[from];

            if (!session || !session.results?.length) {
              return await socket.sendMessage(from, { text: `❌ Search first using \`${prefix}pin <word>\`.` }, { quoted: msg });
            }

            const elapsed = Date.now() - session.timestamp;
            if (elapsed > SESSION_TIMEOUT) {
              delete global.pinSessions[from];
              return await socket.sendMessage(from, { text: `⌛ Session has expired. Please search again.` }, { quoted: msg });
            }

            if (selectedNum < 1 || selectedNum > session.results.length) {
              return await socket.sendMessage(from, { text: `❌ Enter a number between 1 and ${session.results.length}.` }, { quoted: msg });
            }

            await socket.sendMessage(from, { react: { text: '📥', key: msg.key } });

            try {
              const selected = session.results[selectedNum - 1];
              const mediaUrl = selected.image || selected.url || selected.post;

              if (!mediaUrl) throw new Error('This item has no download link.');

              const isVideo = mediaUrl.includes('.mp4') || mediaUrl.match(/video/i);

              const buffer = await axios.get(mediaUrl, {
                responseType: 'arraybuffer',
              maxContentLength: MAX_MEDIA_BYTES,
              maxBodyLength: MAX_MEDIA_BYTES,
                timeout: 60000,
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
              });

              if (isVideo) {
                await socket.sendMessage(from, {
                  video: buffer.data,
                  mimetype: 'video/mp4',
                  caption: `✅ *Pinterest Video* | 🌙 ${botName}`
                }, { quoted: msg });
              } else {
                await socket.sendMessage(from, {
                  image: buffer.data,
                  mimetype: 'image/jpeg',
                  caption: `✅ *Pinterest Image* | 🌙 ${botName}`
                }, { quoted: msg });
              }

              await socket.sendMessage(from, { react: { text: '✅', key: msg.key } });
              delete global.pinSessions[from];

            } catch (err) {
              console.error('Pinterest Download Error:', err);
              await socket.sendMessage(from, { react: { text: '❌', key: msg.key } });
              await socket.sendMessage(from, { text: `❌ Download failed: ${err.message}` }, { quoted: msg });
            }

          } else {
            await socket.sendMessage(from, { react: { text: '🔍', key: msg.key } });

            try {
              const Pinterest = require('@myno_21/pinterest-scraper');
              const results = await Pinterest.search(input);

              if (!results || !results.length) {
                return await socket.sendMessage(from, { text: '❌ Nothing found.' }, { quoted: msg });
              }

              const limited = results.slice(0, 25);
              if (!global.pinSessions) global.pinSessions = {};

              let listText = `╭───〔 📌 *PINTEREST RESULTS* 〕───⊷\n│ 🔎 *Query:* ${input}\n╰──────────────────────────⊷\n\n`;
              limited.forEach((item, i) => {
                const title = item.title || item.image || `Result ${i + 1}`;
                listText += `*${i + 1}.* ${title.substring(0, 45)}\n`;
              });
              listText += `\n> 💬 *Reply with just the number you want (1-${limited.length})*`;

              const sentPinMsg = await socket.sendMessage(from, { text: listText }, { quoted: msg });
              global.pinSessions[from] = { 
                results: limited, 
                messageId: sentPinMsg?.key?.id,
                timestamp: Date.now()
              };

              await socket.sendMessage(from, { react: { text: '✅', key: msg.key } });

            } catch (err) {
              console.error('Pinterest Search Error:', err);
              await socket.sendMessage(from, { react: { text: '❌', key: msg.key } });
              await socket.sendMessage(from, { text: `❌ *An error occurred:* ${err.message}` }, { quoted: msg });
            }
          }
          break;
        }

        case 'url':
        case 'upload':
        case 'tourl': {
          const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
          const targetMsg = quoted
            ? { message: quoted, key: { ...msg.key, id: msg.message.extendedTextMessage.contextInfo.stanzaId } }
            : msg;

          const mediaType = quoted
            ? Object.keys(quoted)[0]
            : Object.keys(msg.message || {})[0];

          const isMedia = ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'stickerMessage']
            .includes(mediaType);

          if (!isMedia) {
            return await socket.sendMessage(from, {
              text: `❌ *Usage:* reply to an image/video/voice message and use \`${prefix}url\` `
            }, { quoted: msg });
          }

          await socket.sendMessage(from, { react: { text: '⏳', key: msg.key } });

          try {
            const { downloadMediaMessage } = require('@whiskeysockets/baileys');
            const buffer = await downloadMediaMessage(targetMsg, 'buffer', {});

            if (!buffer || buffer.length === 0) throw new Error('Failed to download media.');

            const extMap = {
              imageMessage: 'jpg',
              videoMessage: 'mp4',
              audioMessage: 'mp3',
              documentMessage: 'pdf',
              stickerMessage: 'webp'
            };
            const ext = extMap[mediaType] || 'bin';
            const fileName = `upload_${Date.now()}.${ext}`;

            const FormData = require('form-data');

            const sources = [
              async () => {
                const form = new FormData();
                form.append('reqtype', 'fileupload');
                form.append('fileToUpload', buffer, fileName);
                const res = await axios.post('https://catbox.moe/user/api.php', form, {
                  headers: form.getHeaders(),
                  timeout: 60000
                });
                const url = typeof res.data === 'string' ? res.data.trim() : null;
                return url && url.startsWith('http') ? url : null;
              },
              async () => {
                const form = new FormData();
                form.append('file', buffer, fileName);
                const res = await axios.post('https://0x0.st', form, {
                  headers: form.getHeaders(),
                  timeout: 60000
                });
                const url = typeof res.data === 'string' ? res.data.trim() : null;
                return url && url.startsWith('http') ? url : null;
              },
              async () => {
                const form = new FormData();
                form.append('files[]', buffer, fileName);
                const res = await axios.post('https://uguu.se/upload', form, {
                  headers: form.getHeaders(),
                  timeout: 60000
                });
                const url = res.data?.files?.[0]?.url;
                return url || null;
              }
            ];

            let finalUrl = null;
            let usedService = '';
            const names = ['Catbox', '0x0.st', 'Uguu'];

            for (let i = 0; i < sources.length; i++) {
              try {
                const url = await sources[i]();
                if (url) {
                  finalUrl = url;
                  usedService = names[i];
                  break;
                }
              } catch (e) {}
            }

            if (!finalUrl) throw new Error('Upload services are unavailable.');

            await socket.sendMessage(from, { react: { text: '✅', key: msg.key } });
            await socket.sendMessage(from, {
              text: `✅ *Upload Success!*\n\n🔗 *URL:* ${finalUrl}\n🌐 *Service:* ${usedService}\n🌙 ${botName}`
            }, { quoted: msg });

          } catch (err) {
            console.error('Upload Error:', err);
            await socket.sendMessage(from, { react: { text: '❌', key: msg.key } });
            await socket.sendMessage(from, { text: `❌ Upload failed: ${err.message}` }, { quoted: msg });
          }
          break;
        }

        case 'ig':
        case 'instagram': {
          if (!args.length) {
            return await socket.sendMessage(from, { text: `❌ *Usage:* \`${prefix}ig <Instagram Post/Reel Link>\`` }, { quoted: msg });
          }

          const igUrl = args[0];
          if (!igUrl.includes('instagram.com')) {
            return await socket.sendMessage(from, { text: '❌ Enter a valid Instagram Link.' }, { quoted: msg });
          }

          await socket.sendMessage(from, { react: { text: '⏳', key: msg.key } });

          try {
            const sources = [
              async () => {
                const { ndown } = require('nayan-media-downloader');
                const res = await ndown(igUrl);
                const data = res?.data;
                if (!data) return null;
                const list = Array.isArray(data) ? data : [data];
                return list.map(m => m.url).filter(Boolean);
              },
              async () => {
                const { instagramdl, instagramdlv2 } = require('@bochilteam/scraper');
                const res = await instagramdl(igUrl).catch(() => instagramdlv2(igUrl));
                const data = res?.data || res?.result || res;
                if (!data) return null;
                const list = Array.isArray(data) ? data : [data];
                return list.map(m => m.url || m.download_url || m).filter(Boolean);
              },
              async () => {
                const res = await axios.get(`https://api.siputzx.my.id/api/d/igdl?url=${encodeURIComponent(igUrl)}`, { timeout: 20000 });
                const media = res.data?.data;
                if (Array.isArray(media)) return media.map(m => m.url || m);
                return null;
              }
            ];

            let mediaUrls = null;
            for (const getMedia of sources) {
              try {
                const urls = await getMedia();
                if (urls && urls.length > 0) {
                  mediaUrls = urls;
                  break;
                }
              } catch (e) {}
            }

            if (!mediaUrls) throw new Error('🌷 Sorry download error');

            await socket.sendMessage(from, { react: { text: '📥', key: msg.key } });

            for (const mediaUrl of mediaUrls) {
              const isVideo = mediaUrl.includes('.mp4') || mediaUrl.match(/video/i);

              const buffer = await axios.get(mediaUrl, {
                responseType: 'arraybuffer',
              maxContentLength: MAX_MEDIA_BYTES,
              maxBodyLength: MAX_MEDIA_BYTES,
                timeout: 60000,
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
              });

              if (isVideo) {
                await socket.sendMessage(from, {
                  video: buffer.data,
                  mimetype: 'video/mp4',
                  caption: `✅ *Instagram Video* | 🌙 ${botName}`
                }, { quoted: msg });
              } else {
                await socket.sendMessage(from, {
                  image: buffer.data,
                  mimetype: 'image/jpeg',
                  caption: `✅ *Instagram Photo* | 🌙 ${botName}`
                }, { quoted: msg });
              }
            }

            await socket.sendMessage(from, { react: { text: '✅', key: msg.key } });

          } catch (err) {
            console.error('Instagram Error:', err);
            await socket.sendMessage(from, { react: { text: '❌', key: msg.key } });
            await socket.sendMessage(from, { text: `❌ Instagram download failed: ${err.message}` }, { quoted: msg });
          }
          break;
        }

        case 'tiktok':
        case 'tt': {
          if (!args.length) {
            return await socket.sendMessage(from, { text: `❌ *Usage:*\n\`${prefix}tiktok <TikTok Link / Search Query>\`` }, { quoted: msg });
          }

          const query = args.join(' ');
          const isLink = query.includes('tiktok.com');
          await socket.sendMessage(from, { react: { text: '⏳', key: msg.key } });

          try {
            let videoUrl = query;
            let videoTitle = 'TikTok Video';
            let author = '';

            if (!isLink) {
              await socket.sendMessage(from, { react: { text: '🔍', key: msg.key } });

              let searchResult = null;

              try {
                const res = await axios.get(`https://www.tikwm.com/api/feed/search?keywords=${encodeURIComponent(query)}&count=1`, { timeout: 20000 });
                const item = res.data?.data?.videos?.[0];
                if (item) {
                  searchResult = {
                    url: `https://www.tiktok.com/@${item.author?.unique_id}/video/${item.video_id}`,
                    title: item.title,
                    author: item.author?.nickname
                  };
                }
              } catch (e) {}

              if (!searchResult) {
                try {
                  const TiktokDL = require('@tobyg74/tiktok-api-dl');
                  const res = await TiktokDL.Search(query, { type: 'video', page: 1 });
                  const item = res?.result?.videos?.[0] || res?.result?.[0];
                  if (item) {
                    searchResult = {
                      url: item?.video?.playAddr?.[0] ? null : `https://www.tiktok.com/@${item?.author?.username}/video/${item?.id}`,
                      title: item?.title || item?.desc,
                      author: item?.author?.nickname
                    };
                  }
                } catch (e) {}
              }

              if (!searchResult || !searchResult.url) {
                return await socket.sendMessage(from, { text: '❌ Not found.' }, { quoted: msg });
              }

              videoUrl = searchResult.url;
              videoTitle = searchResult.title || videoTitle;
              author = searchResult.author || '';
            }

            await socket.sendMessage(from, { react: { text: '🎬', key: msg.key } });

            const sources = [
              async () => {
                const TiktokDL = require('@tobyg74/tiktok-api-dl');
                const result = await TiktokDL.Downloader(videoUrl, { version: 'v1' });
                if (result?.status !== 'success') throw new Error('v1 failed');
                if (result?.result?.desc) videoTitle = result.result.desc;
                if (result?.result?.author?.nickname) author = result.result.author.nickname;
                const videos = result?.result?.videoHD || result?.result?.video || result?.result?.videoSD;
                return Array.isArray(videos) ? videos[0] : videos;
              },
              async () => {
                const res = await axios.get(`https://www.tikwm.com/api/?url=${encodeURIComponent(videoUrl)}`, { timeout: 20000 });
                if (res.data?.data?.title) videoTitle = res.data.data.title;
                if (res.data?.data?.author?.nickname) author = res.data.data.author.nickname;
                return res.data?.data?.hdplay || res.data?.data?.play;
              }
            ];

            let downloadUrl = null;
            for (const getVideo of sources) {
              try {
                const url = await getVideo();
                if (url && typeof url === 'string' && url.startsWith('http')) {
                  downloadUrl = url;
                  break;
                }
              } catch (e) {}
            }

            if (!downloadUrl) throw new Error('Video download failed');

            const videoBuffer = await axios.get(downloadUrl, {
              responseType: 'arraybuffer',
              maxContentLength: MAX_MEDIA_BYTES,
              maxBodyLength: MAX_MEDIA_BYTES,
              timeout: 60000,
              headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
            });

            await socket.sendMessage(from, {
              video: videoBuffer.data,
              mimetype: 'video/mp4',
              caption: `✅ *${videoTitle}*${author ? `\n👤 ${author}` : ''}\n🌙 ${botName}`
            }, { quoted: msg });

            await socket.sendMessage(from, { react: { text: '✅', key: msg.key } });

          } catch (err) {
            console.error('TikTok Error:', err);
            await socket.sendMessage(from, { react: { text: '❌', key: msg.key } });
            await socket.sendMessage(from, { text: `❌ TikTok download failed: ${err.message}` }, { quoted: msg });
          }
          break;
        }

        case 'fb':
        case 'facebook': {
          if (!args.length) {
            return await socket.sendMessage(from, { text: `❌ *Usage:* \`${prefix}fb <Facebook Video Link>\`` }, { quoted: msg });
          }

          const fbUrl = args[0];
          if (!fbUrl.includes('facebook.com') && !fbUrl.includes('fb.watch')) {
            return await socket.sendMessage(from, { text: '❌ Invalid Facebook URL.' }, { quoted: msg });
          }

          await socket.sendMessage(from, { react: { text: '⏳', key: msg.key } });

          try {
            const sources = [
              async () => {
                const { getFbVideoInfo } = require('fb-downloader-scrapper');
                const data = await getFbVideoInfo(fbUrl);
                return data?.hd || data?.sd;
              },
              async () => {
                const getFBInfo = require('@xaviabot/fb-downloader');
                const data = await getFBInfo(fbUrl);
                return data?.hd || data?.sd;
              },
              async () => {
                const res = await axios.get(`https://api.siputzx.my.id/api/d/facebook?url=${encodeURIComponent(fbUrl)}`, { timeout: 20000 });
                return res.data?.data?.[0]?.url || res.data?.data?.hd || res.data?.data?.sd;
              }
            ];

            let downloadUrl = null;
            for (const getVideo of sources) {
              try {
                const url = await getVideo();
                if (url && typeof url === 'string' && url.startsWith('http')) {
                  downloadUrl = url;
                  break;
                }
              } catch (e) {}
            }

            if (!downloadUrl) throw new Error('Download link not found.');

            const videoBuffer = await axios.get(downloadUrl, {
              responseType: 'arraybuffer',
              maxContentLength: MAX_MEDIA_BYTES,
              maxBodyLength: MAX_MEDIA_BYTES,
              timeout: 60000,
              headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
            });

            await socket.sendMessage(from, {
              video: videoBuffer.data,
              mimetype: 'video/mp4',
              caption: `✅ *Facebook Video* | 🌙 ${botName}`
            }, { quoted: msg });

            await socket.sendMessage(from, { react: { text: '✅', key: msg.key } });

          } catch (err) {
            console.error('FB Download Error:', err);
            await socket.sendMessage(from, { react: { text: '❌', key: msg.key } });
            await socket.sendMessage(from, { text: `❌ Facebook download failed: ${err.message}` }, { quoted: msg });
          }
          break;
        }

        case 'ytmp4':
        case 'mp4':
        case 'video':
        case 'ytv': {
          if (!args.length) {
            return await socket.sendMessage(from, { 
              text: `╭───────────────━⊷\n│ ⚠️ *Usage:* \`${prefix}video <video name / Link>\`\n╰───────────────━⊷` 
            }, { quoted: msg });
          }

          const query = args.join(' ');
          const CHAMA_API = 'chama_api_7f4ac9c10c749bcedbd4437a066009a2';
          const CHAMA_BASE = 'https://api.chamindu.site/api/v1';

          await socket.sendMessage(from, { react: { text: '⏳', key: msg.key } });

          try {
            const isUrl = query.startsWith('http://') || query.startsWith('https://');
            let videoUrl = query;
            let songTitle = 'Unknown Video';
            let thumbnailUrl = 'https://i.ibb.co/Lz68N877/ping-1.jpg';
            let duration = 'N/A';
            let channelName = 'YouTube';

            if (!isUrl) {
              const searchRes = await axios.get(`${CHAMA_BASE}/media/youtube/search`, {
                params: { q: query, api_key: CHAMA_API },
                timeout: 20000
              });

              const results = searchRes.data?.data;
              if (!searchRes.data?.status || !Array.isArray(results) || !results.length) {
                return await socket.sendMessage(from, { text: '❌ No video found.' }, { quoted: msg });
              }

              const vid = results[0];
              videoUrl = vid.youtube_url;
              songTitle = vid.title;
              thumbnailUrl = vid.thumbnail || thumbnailUrl;
              channelName = vid.uploader || channelName;

              const mins = Math.floor(vid.duration / 60);
              const secs = String(vid.duration % 60).padStart(2, '0');
              duration = `${mins}:${secs}`;
            }

            const infoText = 
`╭───〔 🎬 *VIDEO DOWNLOADER* 〕───⊷
│ 📌 *𝑻𝒊𝒕𝒍𝒆:* ${songTitle}
│ ⏱️ *𝑻𝒊𝒎𝒆:* ${duration}
│ 👤 *𝑪𝒉𝒂𝒏𝒏𝒆𝒍:* ${channelName}
╰──────────────────────────⊷
> 🪻 _𝑫𝒐𝒘𝒏𝒍𝒐𝒂𝒅𝒊𝒏𝒈..._`;

            const infoMsg = await socket.sendMessage(from, {
              image: { url: thumbnailUrl },
              caption: infoText
            }, { quoted: msg });

            await socket.sendMessage(from, { react: { text: '🎬', key: msg.key } });

            const mp4Res = await axios.get(`${CHAMA_BASE}/youtube/mp4`, {
              params: {
                url: videoUrl,
                quality: '720p',
                source: 'auto',
                api_key: CHAMA_API
              },
              timeout: 60000
            });

            if (!mp4Res.data?.status || !mp4Res.data?.data?.direct_url) {
              throw new Error(mp4Res.data?.message || 'Failed to get MP4 link.');
            }

            const mp4Data = mp4Res.data.data;
            if (mp4Data.title) songTitle = mp4Data.title;
            const downloadUrl = mp4Data.direct_url;

            const videoBuffer = await axios.get(downloadUrl, {
              responseType: 'arraybuffer',
              maxContentLength: MAX_MEDIA_BYTES,
              maxBodyLength: MAX_MEDIA_BYTES,
              timeout: 120000,
              headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
            });

            const cleanTitle = songTitle.replace(/[\\/:*?"<>|]/g, '');

            await socket.sendMessage(from, {
              video: videoBuffer.data,
              mimetype: 'video/mp4',
              fileName: `${cleanTitle}.mp4`,
              caption: `✅ *${songTitle}*`
            }, { quoted: infoMsg });

            await socket.sendMessage(from, { react: { text: '✅', key: msg.key } });

          } catch (err) {
            console.error('Video Error:', err);
            await socket.sendMessage(from, { react: { text: '❌', key: msg.key } });
            await socket.sendMessage(from, { text: `❌ *An error occurred:* ${err.message}` }, { quoted: msg });
          }
          break;
        }

        case 'userinfo':
        case 'whois':
        case 'getdp': {
          try {
            let target;
            const ctxInfo = msg.message?.extendedTextMessage?.contextInfo;
            const mentioned = ctxInfo?.mentionedJid;
            const quotedSender = ctxInfo?.participant;
            const inputNum = args.join(' ').trim();

            if (mentioned && mentioned.length > 0) {
              target = mentioned[0];
            } else if (quotedSender) {
              target = quotedSender;
            } else if (inputNum) {
              const cleanNum = inputNum.replace(/[^0-9]/g, '');
              if (!cleanNum) {
                return await socket.sendMessage(from, { text: '❌ Please provide a valid WhatsApp number.' }, { quoted: msg });
              }
              target = cleanNum + '@s.whatsapp.net';
            } else {
              return await socket.sendMessage(from, {
                text: `❌ *USER INFO USAGE*\n\n• \`${prefix}userinfo @user\`\n• Reply to a message with \`${prefix}userinfo\`\n• \`${prefix}userinfo 947xxxxxxxx\``
              }, { quoted: msg });
            }

            target = jidNormalizedUser(target);

            let userJid = target;
            try {
              if (typeof socket.onWhatsApp === 'function') {
                const result = await socket.onWhatsApp(target);
                if (!result || result.length === 0 || result[0]?.exists === false) {
                  return await socket.sendMessage(from, { text: '❌ This number is not registered on WhatsApp.' }, { quoted: msg });
                }
                if (result[0]?.jid) {
                  userJid = jidNormalizedUser(result[0].jid);
                }
              }
            } catch (e) {
              userJid = target;
            }

            const number = userJid.split('@')[0].split(':')[0];

            let contactName = 'Unknown';
            try {
              if (typeof socket.getName === 'function') {
                const name = await socket.getName(userJid);
                if (name) contactName = name;
              }
            } catch (e) {}

            if (contactName === 'Unknown' && ctxInfo?.pushName) {
              contactName = ctxInfo.pushName;
            }

            let userBio = 'Hidden / Not set';
            let bioDate = 'Unknown';
            try {
              if (typeof socket.fetchStatus === 'function') {
                let statusRes = await socket.fetchStatus(userJid);
                if (Array.isArray(statusRes)) statusRes = statusRes[0];
                
                if (statusRes) {
                  if (typeof statusRes.status === 'string' && statusRes.status.trim() !== '') {
                    userBio = statusRes.status;
                  }
                  if (statusRes.setAt) {
                    bioDate = moment(statusRes.setAt).tz('Asia/Colombo').format('YYYY-MM-DD');
                  }
                }
              }
            } catch (e) {}

            let ppUrl = null;
            try {
              if (typeof socket.profilePictureUrl === 'function') {
                try {
                  ppUrl = await socket.profilePictureUrl(userJid, 'image');
                } catch {
                  ppUrl = await socket.profilePictureUrl(userJid, 'preview');
                }
              }
            } catch (e) {
              ppUrl = null;
            }

            let accountType = 'Standard Account';
            try {
              if (typeof socket.getBusinessProfile === 'function') {
                const business = await socket.getBusinessProfile(userJid);
                if (business) accountType = 'Business Account';
              }
            } catch (e) {}

            const infoText = `╭━━━〔 👤 *USER INFO* 〕━━━╮
┃
┃ 👤 *Name:* ${contactName}
┃ 📞 *Number:* +${number}
┃ 🆔 *JID:* \`${userJid}\`
┃
┃ 📝 *About:* ${userBio}
┃ 📅 *About Date:* ${bioDate}
┃ 🏢 *Account:* ${accountType}
┃
╰━━━━━━━━━━━━━━━━━━╯
${botFooter}`;

            if (ppUrl) {
              await sendFancyMsg(socket, from, {
                image: { url: ppUrl },
                caption: infoText,
                mentions: [userJid]
              }, msg, userCfg);
            } else {
              await sendFancyMsg(socket, from, {
                text: infoText,
                mentions: [userJid]
              }, msg, userCfg);
            }

          } catch (err) {
            console.error('❌ USERINFO ERROR:', err);
            await socket.sendMessage(from, { text: `❌ *USERINFO ERROR*\n\n${err?.message || err}` }, { quoted: msg });
          }
          break;
        }

        case 'vv':
        case 'readviewonce': {
          const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
          if (!quoted) return await socket.sendMessage(from, { text: '❌ Please reply to a View-Once image/video!' }, { quoted: msg });
          
          let vo = quoted.viewOnceMessageV2?.message || quoted.viewOnceMessage?.message || quoted;
          let mtype = Object.keys(vo)[0];

          if (!mtype || (!mtype.includes('image') && !mtype.includes('video') && !mtype.includes('audio'))) {
            return await socket.sendMessage(from, { text: '❌ That message is not a View-Once media!' }, { quoted: msg });
          }

          const stream = await downloadContentFromMessage(vo[mtype], mtype.replace('Message', ''));
          const buffer = await streamToBuffer(stream);

          if (mtype.includes('image')) {
            await socket.sendMessage(from, { image: buffer, caption: `🔓 *View-Once Image Recovered!*` }, { quoted: msg });
          } else if (mtype.includes('video')) {
            await socket.sendMessage(from, { video: buffer, caption: `🔓 *View-Once Video Recovered!*` }, { quoted: msg });
          } else if (mtype.includes('audio')) {
            await socket.sendMessage(from, { audio: buffer, mimetype: 'audio/mp4' }, { quoted: msg });
          }
          break;
        }

        case 's':
        case 'sticker': {
          let targetMsg = messageContent?.extendedTextMessage?.contextInfo?.quotedMessage || messageContent;

          if (targetMsg?.viewOnceMessageV2?.message) targetMsg = targetMsg.viewOnceMessageV2.message;
          else if (targetMsg?.viewOnceMessageV2Extension?.message) targetMsg = targetMsg.viewOnceMessageV2Extension.message;
          else if (targetMsg?.viewOnceMessage?.message) targetMsg = targetMsg.viewOnceMessage.message;
          else if (targetMsg?.ephemeralMessage?.message) targetMsg = targetMsg.ephemeralMessage.message;

          const mType = getContentType(targetMsg);

          try {
            if (mType === 'imageMessage') {
              await socket.sendMessage(from, { react: { text: '⏳', key: msg.key } });
              const buf = await downloadMediaMessage(targetMsg);
              const outBuf = await imageBufferToWebpSticker(buf);
              await socket.sendMessage(from, { sticker: outBuf }, { quoted: msg });
              await socket.sendMessage(from, { react: { text: '✅', key: msg.key } });
            } else if (mType === 'videoMessage') {
              await socket.sendMessage(from, { react: { text: '⏳', key: msg.key } });
              const buf = await downloadMediaMessage(targetMsg);
              const outBuf = await videoBufferToWebpSticker(buf);
              await socket.sendMessage(from, { sticker: outBuf }, { quoted: msg });
            } else if (mType === 'stickerMessage') {
              const buf = await downloadMediaMessage(targetMsg);
              await socket.sendMessage(from, { sticker: buf }, { quoted: msg });
            } else {
              await socket.sendMessage(from, { text: `❌ Reply to an image, a short video, or a sticker with \`${prefix}sticker\`` }, { quoted: msg });
            }
          } catch (e) {
            console.error('Sticker Error:', e);
            await socket.sendMessage(from, { text: `❌ Failed to create sticker: ${e.message}` }, { quoted: msg });
          }
          break;
        }

        case 'take':
        case 'wm': {
          const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
          if (!quoted || !quoted.stickerMessage) {
            return await socket.sendMessage(from, { text: '❌ Reply to a sticker to rename watermark!' }, { quoted: msg });
          }
          const buf = await downloadMediaMessage(quoted);
          await socket.sendMessage(from, { sticker: buf }, { quoted: msg });
          break;
        }

        case 'ss':
        case 'savestatus': {
          const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
          if (!quoted) return await socket.sendMessage(from, { text: '❌ Reply to a status to save it!' }, { quoted: msg });
          const buf = await downloadMediaMessage(quoted);
          const qType = Object.keys(quoted)[0];
          if (qType.includes('image')) {
            await socket.sendMessage(from, { image: buf, caption: `🌙 Saved Status by ${botName}` }, { quoted: msg });
          } else if (qType.includes('video')) {
            await socket.sendMessage(from, { video: buf, caption: `🌙 Saved Status by ${botName}` }, { quoted: msg });
          }
          break;
        }

        case 'jid': {
          const target = msg.message?.extendedTextMessage?.contextInfo?.participant || from;
          await socket.sendMessage(from, { text: `🆔 *JID:* \`${target}\`` }, { quoted: msg });
          break;
        }

        case 'addreply':
        case 'addautoreply': {
          if (!isOwnerUser) return;
          const content = args.join(' ');
          const parts = content.split('|').map(s => s.trim());
          if (parts.length < 3) {
            return await socket.sendMessage(from, {
              text: `❌ *Format Error!*\n*Usage:* \`${prefix}addreply <type>|<trigger_word>|<text_or_url>\`\n*Types:* \`text\`, \`voice\`, \`image\`, \`video\`, \`sticker\``
            }, { quoted: msg });
          }
          const [rtype, rtrig, rcnt] = parts;
          await addAutoReply(sanitizedNum, rtrig, rtype.toLowerCase(), rcnt);
          await socket.sendMessage(from, { text: `✅ Auto Reply added for trigger: *"${rtrig}"* [${rtype.toUpperCase()}]` }, { quoted: msg });
          break;
        }

        case 'delreply':
        case 'delautoreply': {
          if (!isOwnerUser) return;
          const trig = args.join(' ').trim();
          if (!trig) return await socket.sendMessage(from, { text: `❌ Provide the trigger word to delete.` }, { quoted: msg });
          await removeAutoReply(sanitizedNum, trig);
          await socket.sendMessage(from, { text: `🗑️ Auto Reply deleted for: *"${trig}"*` }, { quoted: msg });
          break;
        }

        case 'listreply': {
          const list = await getAutoReplies(sanitizedNum);
          if (!list.length) return await socket.sendMessage(from, { text: 'ℹ️ No custom auto replies set yet.' }, { quoted: msg });
          let listTxt = `📋 *ACTIVE CUSTOM AUTO REPLIES (${list.length})*\n\n`;
          list.forEach((r, idx) => {
            listTxt += `*${idx + 1}.* 🎯 *Trigger:* \`${r.trigger}\` | 🏷️ *Type:* \`${r.type}\`\n`;
          });
          await socket.sendMessage(from, { text: listTxt }, { quoted: msg });
          break;
        }

        case 'tagall': {
          if (!isGroup) return;
          const groupMeta = await socket.groupMetadata(from);
          const members = groupMeta.participants.map(p => p.id);
          const txt = args.join(' ') || 'Attention Everyone!';
          let mentionText = `📢 *TAG ALL EVENT*\n📝 *Message:* ${txt}\n\n`;
          members.forEach((m, i) => { mentionText += `${i + 1}. @${m.split('@')[0]}\n`; });
          await socket.sendMessage(from, { text: mentionText, mentions: members }, { quoted: msg });
          break;
        }

        case 'hidetag': {
          if (!isGroup) return;
          const groupMeta = await socket.groupMetadata(from);
          const members = groupMeta.participants.map(p => p.id);
          const txt = args.join(' ') || 'Attention!';
          await socket.sendMessage(from, { text: txt, mentions: members });
          break;
        }

        case 'antilink': {
          if (!isGroup || !isOwnerUser) return;
          const opt = (args[0] || '').toLowerCase();
          if (opt === 'on' || opt === 'off') {
            await updateGroupSettings(from, { antilink: opt === 'on' });
            await socket.sendMessage(from, { text: `🛡️ Anti-Link has been turned *${opt.toUpperCase()}* for this group.` }, { quoted: msg });
          }
          break;
        }

        case 'antibot': {
          if (!isGroup) return;
          const { isSenderAdmin } = await checkGroupAdmin(socket, from, jidNormalizedUser(nowsender), isOwnerUser, msg.key.participantAlt);
          if (!isSenderAdmin) return await socket.sendMessage(from, { text: '❌ Only Group Admins can use this command!' }, { quoted: msg });
          const opt = (args[0] || '').toLowerCase();
          if (opt === 'on' || opt === 'off') {
            await updateGroupSettings(from, { antibot: opt === 'on' });
            await socket.sendMessage(from, { text: `🤖 Anti-Bot has been turned *${opt.toUpperCase()}*.` }, { quoted: msg });
          } else {
            await socket.sendMessage(from, { text: `⚠️ *Usage:* \`${prefix}antibot <on|off>\`` }, { quoted: msg });
          }
          break;
        }

        case 'antibadword': {
          if (!isGroup) return;
          const { isSenderAdmin } = await checkGroupAdmin(socket, from, jidNormalizedUser(nowsender), isOwnerUser, msg.key.participantAlt);
          if (!isSenderAdmin) return await socket.sendMessage(from, { text: '❌ Only Group Admins can use this command!' }, { quoted: msg });
          const opt = (args[0] || '').toLowerCase();
          if (opt === 'on' || opt === 'off') {
            await updateGroupSettings(from, { antibadword: opt === 'on' });
            await socket.sendMessage(from, { text: `🤬 Anti-Badword has been turned *${opt.toUpperCase()}*.` }, { quoted: msg });
          } else {
            await socket.sendMessage(from, { text: `⚠️ *Usage:* \`${prefix}antibadword <on|off>\`` }, { quoted: msg });
          }
          break;
        }

        case 'addbadword': {
          if (!isGroup) return;
          const { isSenderAdmin } = await checkGroupAdmin(socket, from, jidNormalizedUser(nowsender), isOwnerUser, msg.key.participantAlt);
          if (!isSenderAdmin) return await socket.sendMessage(from, { text: '❌ Only Group Admins can use this command!' }, { quoted: msg });
          const word = args.join(' ').trim().toLowerCase();
          if (!word) return await socket.sendMessage(from, { text: `⚠️ *Usage:* \`${prefix}addbadword <word>\`` }, { quoted: msg });
          const gSettings = await getGroupSettings(from);
          const cur = Array.isArray(gSettings.badwords) ? gSettings.badwords : [];
          if (!cur.includes(word)) cur.push(word);
          await updateGroupSettings(from, { badwords: cur });
          await socket.sendMessage(from, { text: `✅ Added *"${word}"* to badword filter list.` }, { quoted: msg });
          break;
        }

        case 'welcome':
        case 'goodbye': {
          if (!isGroup) return;
          const { isSenderAdmin } = await checkGroupAdmin(socket, from, jidNormalizedUser(nowsender), isOwnerUser, msg.key.participantAlt);
          if (!isSenderAdmin) return await socket.sendMessage(from, { text: '❌ Only Group Admins can use this command!' }, { quoted: msg });
          const opt = (args[0] || '').toLowerCase();
          if (opt === 'on' || opt === 'off') {
            await updateGroupSettings(from, { [command]: opt === 'on' });
            await socket.sendMessage(from, { text: `🌙 Group ${command} messages turned *${opt.toUpperCase()}*.` }, { quoted: msg });
          } else {
            await socket.sendMessage(from, { text: `⚠️ *Usage:* \`${prefix}${command} <on|off>\`` }, { quoted: msg });
          }
          break;
        }

        case 'promote': {
          if (!isGroup) return;
          const senderJid = jidNormalizedUser(nowsender);
          const { isBotAdmin, isSenderAdmin } = await checkGroupAdmin(socket, from, senderJid, isOwnerUser);
          if (!isBotAdmin) return await socket.sendMessage(from, { text: '❌ Please promote me to Admin first!' }, { quoted: msg });
          if (!isSenderAdmin) return await socket.sendMessage(from, { text: '❌ Only Group Admins can use this command!' }, { quoted: msg });
          const ctx = msg.message?.extendedTextMessage?.contextInfo;
          const target = (ctx?.mentionedJid && ctx.mentionedJid[0]) || ctx?.participant || ((args[0] || '').replace(/[^0-9]/g, '') ? (args[0] || '').replace(/[^0-9]/g, '') + '@s.whatsapp.net' : null);
          if (!target) return await socket.sendMessage(from, { text: `⚠️ *Usage:* \`${prefix}promote @user\` or reply to their message.` }, { quoted: msg });
          try {
            await socket.groupParticipantsUpdate(from, [target], 'promote');
            await socket.sendMessage(from, { text: `✅ Promoted @${target.split('@')[0]} to admin.`, mentions: [target] }, { quoted: msg });
          } catch (e) {
            await socket.sendMessage(from, { text: `❌ Failed to promote: ${e.message}` }, { quoted: msg });
          }
          break;
        }

        case 'demote': {
          if (!isGroup) return;
          const senderJid = jidNormalizedUser(nowsender);
          const { isBotAdmin, isSenderAdmin } = await checkGroupAdmin(socket, from, senderJid, isOwnerUser);
          if (!isBotAdmin) return await socket.sendMessage(from, { text: '❌ Please promote me to Admin first!' }, { quoted: msg });
          if (!isSenderAdmin) return await socket.sendMessage(from, { text: '❌ Only Group Admins can use this command!' }, { quoted: msg });
          const ctx = msg.message?.extendedTextMessage?.contextInfo;
          const target = (ctx?.mentionedJid && ctx.mentionedJid[0]) || ctx?.participant || ((args[0] || '').replace(/[^0-9]/g, '') ? (args[0] || '').replace(/[^0-9]/g, '') + '@s.whatsapp.net' : null);
          if (!target) return await socket.sendMessage(from, { text: `⚠️ *Usage:* \`${prefix}demote @user\` or reply to their message.` }, { quoted: msg });
          try {
            await socket.groupParticipantsUpdate(from, [target], 'demote');
            await socket.sendMessage(from, { text: `✅ Demoted @${target.split('@')[0]} from admin.`, mentions: [target] }, { quoted: msg });
          } catch (e) {
            await socket.sendMessage(from, { text: `❌ Failed to demote: ${e.message}` }, { quoted: msg });
          }
          break;
        }

        case 'mute': {
          if (!isGroup) return;
          const { isBotAdmin, isSenderAdmin } = await checkGroupAdmin(socket, from, jidNormalizedUser(nowsender), isOwnerUser, msg.key.participantAlt);
          if (!isBotAdmin) return await socket.sendMessage(from, { text: '❌ Please promote me to Admin first!' }, { quoted: msg });
          if (!isSenderAdmin) return await socket.sendMessage(from, { text: '❌ Only Group Admins can use this command!' }, { quoted: msg });
          try {
            await socket.groupSettingUpdate(from, 'announcement');
            await socket.sendMessage(from, { text: '🔒 Group chat muted (Admins only).' }, { quoted: msg });
          } catch (e) {
            await socket.sendMessage(from, { text: `❌ Failed to mute group: ${e.message}` }, { quoted: msg });
          }
          break;
        }

        case 'unmute': {
          if (!isGroup) return;
          const { isBotAdmin, isSenderAdmin } = await checkGroupAdmin(socket, from, jidNormalizedUser(nowsender), isOwnerUser, msg.key.participantAlt);
          if (!isBotAdmin) return await socket.sendMessage(from, { text: '❌ Please promote me to Admin first!' }, { quoted: msg });
          if (!isSenderAdmin) return await socket.sendMessage(from, { text: '❌ Only Group Admins can use this command!' }, { quoted: msg });
          try {
            await socket.groupSettingUpdate(from, 'not_announcement');
            await socket.sendMessage(from, { text: '🔓 Group chat unmuted (All members can send messages).' }, { quoted: msg });
          } catch (e) {
            await socket.sendMessage(from, { text: `❌ Failed to unmute group: ${e.message}` }, { quoted: msg });
          }
          break;
        }

        case 'glink': {
          if (!isGroup) return;
          const code = await socket.groupInviteCode(from);
          await socket.sendMessage(from, { text: `🔗 *Group Link:* https://chat.whatsapp.com/${code}` }, { quoted: msg });
          break;
        }

        case 'ship': {
          const rand = Math.floor(Math.random() * 100) + 1;
          await sendFancyMsg(socket, from, { text: `💖 *LOVE COMPATIBILITY:* *${rand}%* 💞\n\n> 🌙 Match rating by ${botName}` }, msg, userCfg);
          break;
        }

        case 'joke': {
          const res = await axios.get('https://official-joke-api.appspot.com/random_joke').catch(() => null);
          const jTxt = res?.data ? `😂 *${res.data.setup}*\n\n👉 *${res.data.punchline}*` : 'Why do programmers prefer dark mode? Because light attracts bugs!';
          await sendFancyMsg(socket, from, { text: jTxt }, msg, userCfg);
          break;
        }

        case 'fact': {
          const res = await axios.get('https://uselessfacts.jsph.pl/random.json?language=en').catch(() => null);
          const fTxt = res?.data?.text ? `💡 *Random Fact:* ${res.data.text}` : 'Honey never spoils; archaeologists found 3000-year-old edible honey in Egyptian tombs!';
          await sendFancyMsg(socket, from, { text: fTxt }, msg, userCfg);
          break;
        }

        case 'setbotname': {
          if (!isOwnerUser) return;
          const newName = args.join(' ').trim();
          if (!newName) return await socket.sendMessage(from, { text: '❌ Provide the new bot name.' }, { quoted: msg });
          userCfg.botName = newName;
          await setUserConfigInMongo(sanitizedNum, userCfg);
          await socket.sendMessage(from, { text: `✅ Bot Name updated to: *${newName}*` }, { quoted: msg });
          break;
        }

        case 'setlogo': {
          if (!isOwnerUser) return;
          const newLogo = args[0]?.trim();
          if (!newLogo || !newLogo.startsWith('http')) return await socket.sendMessage(from, { text: '❌ Provide a direct image URL.' }, { quoted: msg });
          userCfg.logo = newLogo;
          await setUserConfigInMongo(sanitizedNum, userCfg);
          await socket.sendMessage(from, { text: `✅ Bot Logo updated successfully!` }, { quoted: msg });
          break;
        }

        case 'setprefix': {
          if (!isOwnerUser) return;
          const newP = args[0]?.trim();
          if (!newP) return;
          userCfg.PREFIX = newP;
          await setUserConfigInMongo(sanitizedNum, userCfg);
          await socket.sendMessage(from, { text: `✅ Prefix set to: *${newP}*` }, { quoted: msg });
          break;
        }

        case 'setfooter': {
          if (!isOwnerUser) return;
          const newFooter = args.join(' ').trim();
          if (!newFooter) return;
          userCfg.footer = `> *${newFooter}*`;
          await setUserConfigInMongo(sanitizedNum, userCfg);
          await socket.sendMessage(from, { text: `✅ Bot footer updated!` }, { quoted: msg });
          break;
        }

        case 'autotyping':
        case 'autorecording':
        case 'antidelete':
        case 'autostatusview':
        case 'autostatusreact':
        case 'autochannelreact':
        case 'anticall': {
          if (!isOwnerUser) return;
          const opt = (args[0] || '').toLowerCase();
          if (opt === 'on' || opt === 'off') {
            const keyMap = {
              autotyping: 'AUTO_TYPING',
              autorecording: 'AUTO_RECORDING',
              antidelete: 'ANTI_DELETE',
              autostatusview: 'AUTO_VIEW_STATUS',
              autostatusreact: 'AUTO_LIKE_STATUS',
              autochannelreact: 'AUTO_CHANNEL_REACT',
              anticall: 'ANTI_CALL'
            };
            const dbKey = keyMap[command];
            userCfg[dbKey] = opt === 'on' ? 'true' : 'false';
            await setUserConfigInMongo(sanitizedNum, userCfg);
            await socket.sendMessage(from, { text: `✅ *${command.toUpperCase()}* is now *${opt.toUpperCase()}*` }, { quoted: msg });
          } else {
            await socket.sendMessage(from, { text: `⚠️ *Usage:* \`${prefix}${command} on\` or \`${prefix}${command} off\`` }, { quoted: msg });
          }
          break;
        }

        case 'alive': {
          await socket.sendMessage(from, { react: { text: "🌙", key: msg.key } });
          const uptime = process.uptime();
          const hours = Math.floor(uptime / 3600);
          const minutes = Math.floor((uptime % 3600) / 60);

          const aliveCard = `
╭───「 🌙 *${botName} ALIVE* 」───◆
│ 👋 *Hey! I am running seamlessly.*
│
│ 👤 *User:* @${senderNumber}
│ 👑 *Master:* ${config.OWNER_NAME}
│ ⏳ *Uptime:* ${hours}h ${minutes}m
│ 🚀 *Version:* ${config.BOT_VERSION}
╰─────────────────────────────◆
*𝘏𝘦𝘭𝘭𝘰͠ 𝘩𝘦𝘭𝘭𝘰 ─⃞ 𝘐'𝘮 𝘴𝘵𝘪𝘭𝘭 𝘰𝘯𝘭𝘪𝘯𝘦 🌙⃘̬ٜٜ𝘳𝘪𝘨𝘩𝘵 𝘯𝘰𝘸ٜ͠🍃⃘̬͞⃝🦋》*
${botFooter}`.trim();

          await sendFancyMsg(socket, from, {
            image: { url: botLogo },
            caption: aliveCard,
            mentions: [nowsender]
          }, msg, userCfg);
          break;
        }

        case 'owner': {
          const ownerClean = config.OWNER_NUMBER.split(',')[0].replace(/[^0-9]/g, '');
          const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${config.OWNER_NAME}\nORG:${botName};\nTEL;type=CELL;type=VOICE;waid=${ownerClean}:+${ownerClean}\nEND:VCARD`;
          await socket.sendMessage(from, { contacts: { displayName: config.OWNER_NAME, contacts: [{ vcard }] } }, { quoted: msg });
          break;
        }

        // ─────────── BOT'S OWN WHATSAPP PROFILE (connected number) ───────────
        case 'setpname':
        case 'setprofilename': {
          if (!isOwnerUser) return;
          const newPName = args.join(' ').trim();
          if (!newPName) return await socket.sendMessage(from, { text: `⚠️ *Usage:* \`${prefix}setpname <new name>\`` }, { quoted: msg });
          try {
            await socket.updateProfileName(newPName);
            await socket.sendMessage(from, { text: `✅ *WhatsApp profile name* updated to: *${newPName}*` }, { quoted: msg });
          } catch (e) {
            await socket.sendMessage(from, { text: `❌ Failed to update profile name: ${e.message}` }, { quoted: msg });
          }
          break;
        }

        case 'setabout':
        case 'setbio':
        case 'setstatus': {
          if (!isOwnerUser) return;
          const newAbout = args.join(' ').trim();
          if (!newAbout) return await socket.sendMessage(from, { text: `⚠️ *Usage:* \`${prefix}setabout <new about text>\`` }, { quoted: msg });
          try {
            await socket.updateProfileStatus(newAbout);
            await socket.sendMessage(from, { text: `✅ *About* updated to: *${newAbout}*` }, { quoted: msg });
          } catch (e) {
            await socket.sendMessage(from, { text: `❌ Failed to update about: ${e.message}` }, { quoted: msg });
          }
          break;
        }

        case 'setpp':
        case 'setdp':
        case 'setfulldp': {
          if (!isOwnerUser) return;
          const ppQuoted = messageContent?.extendedTextMessage?.contextInfo?.quotedMessage;
          const ppTarget = ppQuoted?.imageMessage ? ppQuoted : (messageContent?.imageMessage ? messageContent : null);
          if (!ppTarget) {
            return await socket.sendMessage(from, { text: `⚠️ Reply to (or send with caption) an image using \`${prefix}setpp\` to set it as the bot's full-screen profile picture.` }, { quoted: msg });
          }
          try {
            await socket.sendMessage(from, { react: { text: '⏳', key: msg.key } });
            const rawBuf = await downloadMediaMessage(ppTarget);
            const fullDpBuf = await imageBufferToFullDp(rawBuf);
            const ownJid = jidNormalizedUser(socket.user.id);
            await socket.updateProfilePicture(ownJid, fullDpBuf);
            await socket.sendMessage(from, { text: `✅ *Full-screen profile picture* updated!` }, { quoted: msg });
          } catch (e) {
            console.error('setpp error:', e);
            await socket.sendMessage(from, { text: `❌ Failed to update profile picture: ${e.message}` }, { quoted: msg });
          }
          break;
        }

        // ─────────── TRUTH / DARE / RPS GAMES ───────────
        case 'truth': {
          const q = TRUTH_QUESTIONS[Math.floor(Math.random() * TRUTH_QUESTIONS.length)];
          await sendFancyMsg(socket, from, { text: `🎯 *TRUTH:*\n\n${q}` }, msg, userCfg);
          break;
        }

        case 'dare': {
          const d = DARE_TASKS[Math.floor(Math.random() * DARE_TASKS.length)];
          await sendFancyMsg(socket, from, { text: `🔥 *DARE:*\n\n${d}` }, msg, userCfg);
          break;
        }

        case 'td':
        case 'truthordare': {
          const isTruth = Math.random() < 0.5;
          const pick = isTruth
            ? `🎯 *TRUTH:*\n\n${TRUTH_QUESTIONS[Math.floor(Math.random() * TRUTH_QUESTIONS.length)]}`
            : `🔥 *DARE:*\n\n${DARE_TASKS[Math.floor(Math.random() * DARE_TASKS.length)]}`;
          await sendFancyMsg(socket, from, { text: pick }, msg, userCfg);
          break;
        }

        case 'rps': {
          const userChoiceRaw = (args[0] || '').toLowerCase().trim();
          const userChoice = RPS_ALIASES[userChoiceRaw];
          if (!userChoice) {
            return await socket.sendMessage(from, { text: `⚠️ *Usage:* \`${prefix}rps <rock|paper|scissors>\`` }, { quoted: msg });
          }
          const options = ['rock', 'paper', 'scissors'];
          const botChoice = options[Math.floor(Math.random() * options.length)];

          let resultTxt;
          if (userChoice === botChoice) {
            resultTxt = "🤝 *It's a draw!*";
          } else if (
            (userChoice === 'rock' && botChoice === 'scissors') ||
            (userChoice === 'paper' && botChoice === 'rock') ||
            (userChoice === 'scissors' && botChoice === 'paper')
          ) {
            resultTxt = '🎉 *You win!*';
          } else {
            resultTxt = `🤖 *${botName} wins!*`;
          }

          await sendFancyMsg(socket, from, {
            text: `✊✋✌️ *ROCK PAPER SCISSORS*\n\n👤 You: ${RPS_CHOICES[userChoice]}\n🤖 Bot: ${RPS_CHOICES[botChoice]}\n\n${resultTxt}`
          }, msg, userCfg);
          break;
        }

        // ─────────── LIVE LOCATION ───────────
        case 'liveloc':
        case 'livelocation': {
          const lat = parseFloat(args[0]);
          const lng = parseFloat(args[1]);
          if (isNaN(lat) || isNaN(lng)) {
            return await socket.sendMessage(from, { text: `⚠️ *Usage:* \`${prefix}liveloc <latitude> <longitude> [caption]\`\n💡 *Example:* \`${prefix}liveloc 6.9271 79.8612 Colombo\`` }, { quoted: msg });
          }
          const locCaption = args.slice(2).join(' ') || '';
          try {
            const liveLocContent = generateWAMessageFromContent(from, {
              liveLocationMessage: proto.Message.LiveLocationMessage.fromObject({
                degreesLatitude: lat,
                degreesLongitude: lng,
                caption: locCaption,
                sequenceNumber: Date.now(),
                timeOffset: 3600,
                accuracyInMeters: 20
              })
            }, { quoted: msg, userJid: socket.user.id });

            await socket.relayMessage(from, liveLocContent.message, { messageId: liveLocContent.key.id });
          } catch (e) {
            console.error('liveloc error:', e);
            await socket.sendMessage(from, { text: `❌ Failed to send live location: ${e.message}` }, { quoted: msg });
          }
          break;
        }

        // ─────────── CHANNEL TARGET LIST MANAGEMENT ───────────
        case 'addchannel': {
          if (!isOwnerUser) return;
          const chJid = (args[0] || '').trim();
          if (!chJid.endsWith('@newsletter')) {
            return await socket.sendMessage(from, { text: `⚠️ *Usage:* \`${prefix}addchannel <channelJid>\`\n💡 JID must end with \`@newsletter\`.` }, { quoted: msg });
          }
          const chList = Array.isArray(userCfg.CHANNEL_JIDS) ? userCfg.CHANNEL_JIDS : [];
          if (!chList.includes(chJid)) chList.push(chJid);
          userCfg.CHANNEL_JIDS = chList;
          await setUserConfigInMongo(sanitizedNum, userCfg);
          await socket.sendMessage(from, { text: `✅ Channel added to broadcast list:\n\`${chJid}\`` }, { quoted: msg });
          break;
        }

        case 'delchannel': {
          if (!isOwnerUser) return;
          const chJidDel = (args[0] || '').trim();
          const chList2 = Array.isArray(userCfg.CHANNEL_JIDS) ? userCfg.CHANNEL_JIDS : [];
          userCfg.CHANNEL_JIDS = chList2.filter(j => j !== chJidDel);
          await setUserConfigInMongo(sanitizedNum, userCfg);
          await socket.sendMessage(from, { text: `✅ Channel removed from broadcast list.` }, { quoted: msg });
          break;
        }

        case 'channellist': {
          const chList3 = Array.isArray(userCfg.CHANNEL_JIDS) ? userCfg.CHANNEL_JIDS : [];
          const listTxt = chList3.length
            ? `📡 *BROADCAST CHANNELS:*\n${chList3.map((j, i) => `│ ${i + 1}. ${j}`).join('\n')}`
            : `📡 No channels added yet. Use \`${prefix}addchannel <channelJid>\`.`;
          await socket.sendMessage(from, { text: listTxt }, { quoted: msg });
          break;
        }

        // ─────────── BROADCAST: SONGS/POSTS → CHANNELS ───────────
        case 'ccast':
        case 'channelcast': {
          if (!isOwnerUser) return;
          const chTargets = Array.isArray(userCfg.CHANNEL_JIDS) ? userCfg.CHANNEL_JIDS : [];
          if (!chTargets.length) {
            return await socket.sendMessage(from, { text: `⚠️ No channels configured. Add one first with \`${prefix}addchannel <channelJid>\`.` }, { quoted: msg });
          }
          const ccQuoted = messageContent?.extendedTextMessage?.contextInfo?.quotedMessage;
          const ccText = args.join(' ').trim();

          try {
            let sent = 0;
            for (const chJidTarget of chTargets) {
              try {
                if (ccQuoted) {
                  if (ccQuoted.audioMessage) {
                    const buf = await downloadMediaMessage(ccQuoted);
                    await socket.sendMessage(chJidTarget, { audio: buf, mimetype: 'audio/mp4', ptt: false, contextInfo: getForwardedContext(userCfg) });
                  } else if (ccQuoted.imageMessage) {
                    const buf = await downloadMediaMessage(ccQuoted);
                    await socket.sendMessage(chJidTarget, { image: buf, caption: ccText || ccQuoted.imageMessage?.caption || '', contextInfo: getForwardedContext(userCfg) });
                  } else if (ccQuoted.videoMessage) {
                    const buf = await downloadMediaMessage(ccQuoted);
                    await socket.sendMessage(chJidTarget, { video: buf, caption: ccText || ccQuoted.videoMessage?.caption || '', contextInfo: getForwardedContext(userCfg) });
                  } else {
                    const qTxt = ccQuoted.conversation || ccQuoted.extendedTextMessage?.text || ccText;
                    await socket.sendMessage(chJidTarget, { text: qTxt, contextInfo: getForwardedContext(userCfg) });
                  }
                } else if (ccText) {
                  await socket.sendMessage(chJidTarget, { text: ccText, contextInfo: getForwardedContext(userCfg) });
                } else {
                  return await socket.sendMessage(from, { text: `⚠️ *Usage:* Reply to a song/image/video with \`${prefix}ccast\`, or \`${prefix}ccast <text>\`.` }, { quoted: msg });
                }
                sent++;
                await delay(2000);
              } catch (e) {
                console.error(`ccast to ${chJidTarget} failed:`, e.message);
              }
            }
            await socket.sendMessage(from, { text: `✅ Posted to *${sent}/${chTargets.length}* channel(s).` }, { quoted: msg });
          } catch (e) {
            await socket.sendMessage(from, { text: `❌ Broadcast failed: ${e.message}` }, { quoted: msg });
          }
          break;
        }

        // ─────────── BROADCAST: STATUS-STYLE POST → ALL GROUPS ───────────
        case 'gcast':
        case 'groupcast':
        case 'gstatus': {
          if (!isOwnerUser) return;
          const gcQuoted = messageContent?.extendedTextMessage?.contextInfo?.quotedMessage;
          const gcText = args.join(' ').trim();
          if (!gcQuoted && !gcText) {
            return await socket.sendMessage(from, { text: `⚠️ *Usage:* Reply to text/image/video/song with \`${prefix}gcast\`, or \`${prefix}gcast <text>\` to post to every group.` }, { quoted: msg });
          }

          try {
            const allGroups = await socket.groupFetchAllParticipating().catch(() => ({}));
            const groupIds = Object.keys(allGroups || {});
            if (!groupIds.length) {
              return await socket.sendMessage(from, { text: `⚠️ Bot isn't a member of any groups yet.` }, { quoted: msg });
            }

            let sentG = 0;
            for (const gId of groupIds) {
              try {
                if (gcQuoted) {
                  if (gcQuoted.audioMessage) {
                    const buf = await downloadMediaMessage(gcQuoted);
                    await socket.sendMessage(gId, { audio: buf, mimetype: 'audio/mp4', ptt: false });
                  } else if (gcQuoted.imageMessage) {
                    const buf = await downloadMediaMessage(gcQuoted);
                    await socket.sendMessage(gId, { image: buf, caption: gcText || gcQuoted.imageMessage?.caption || '' });
                  } else if (gcQuoted.videoMessage) {
                    const buf = await downloadMediaMessage(gcQuoted);
                    await socket.sendMessage(gId, { video: buf, caption: gcText || gcQuoted.videoMessage?.caption || '' });
                  } else {
                    const qTxt2 = gcQuoted.conversation || gcQuoted.extendedTextMessage?.text || gcText;
                    await socket.sendMessage(gId, { text: qTxt2 });
                  }
                } else {
                  await socket.sendMessage(gId, { text: gcText });
                }
                sentG++;
                await delay(2500);
              } catch (e) {
                console.error(`gcast to ${gId} failed:`, e.message);
              }
            }
            await socket.sendMessage(from, { text: `✅ Posted to *${sentG}/${groupIds.length}* group(s).` }, { quoted: msg });
          } catch (e) {
            await socket.sendMessage(from, { text: `❌ Broadcast failed: ${e.message}` }, { quoted: msg });
          }
          break;
        }

        default:
          break;
      }
    } catch (err) {
      console.error('Command Execution Error:', err);
    }
  });

  // ──────────────── ANTI DELETE ────────────────
  async function handleAntiDeleteRevoke(revokeKey) {
    try {
      const antiDeleteInboxJid = socket.user?.id ? jidNormalizedUser(socket.user.id) : null;
      if (!antiDeleteInboxJid) return;

      const original = revokeKey?.id ? messageStore.get(revokeKey.id) : null;
      if (!original || !original.message) return;

      const userCfg = await loadUserConfigFromMongo(sanitizedNum);
      if ((userCfg.ANTI_DELETE || 'off') !== 'true') return;

      let content = original.message;
      if (content.ephemeralMessage) content = content.ephemeralMessage.message;
      if (content.viewOnceMessageV2) content = content.viewOnceMessageV2.message;
      if (content.viewOnceMessage) content = content.viewOnceMessage.message;

      const delFrom = original.key?.remoteJid || '';
      const delByJid = jidNormalizedUser(revokeKey?.participant || original.key?.participant || delFrom);
      const delByNum = (delByJid || '').split('@')[0];
      const chatLabel = delFrom.endsWith('@g.us') ? `Group (${delFrom})` : `+${delByNum}`;
      const mType = getContentType(content);

      const header = `🗑️ *Anti-Delete Triggered*\n👤 *Deleted by:* +${delByNum}\n💬 *Chat:* ${chatLabel}\n⏰ *Time:* ${moment().tz('Asia/Colombo').format('YYYY-MM-DD HH:mm:ss')}`;

      if (mType === 'conversation' || mType === 'extendedTextMessage') {
        const text = content.conversation || content.extendedTextMessage?.text || '';
        await socket.sendMessage(antiDeleteInboxJid, { text: `${header}\n\n📝 *Deleted Text:*\n${text}` });
      } else if (mType === 'imageMessage') {
        const buf = await downloadMediaMessage(content);
        await socket.sendMessage(antiDeleteInboxJid, { image: buf, caption: `${header}\n\n🖼️ Deleted Image${content.imageMessage?.caption ? `\n📝 *Caption:* ${content.imageMessage.caption}` : ''}` });
      } else if (mType === 'videoMessage') {
        const buf = await downloadMediaMessage(content);
        await socket.sendMessage(antiDeleteInboxJid, { video: buf, caption: `${header}\n\n🎥 Deleted Video${content.videoMessage?.caption ? `\n📝 *Caption:* ${content.videoMessage.caption}` : ''}` });
      } else if (mType === 'audioMessage') {
        const buf = await downloadMediaMessage(content);
        await socket.sendMessage(antiDeleteInboxJid, { text: `${header}\n\n🎙️ Deleted a voice/audio message.` });
        await socket.sendMessage(antiDeleteInboxJid, { audio: buf, mimetype: content.audioMessage?.mimetype || 'audio/ogg; codecs=opus', ptt: !!content.audioMessage?.ptt });
      } else if (mType === 'stickerMessage') {
        const buf = await downloadMediaMessage(content);
        await socket.sendMessage(antiDeleteInboxJid, { text: `${header}\n\n🏷️ Deleted a sticker.` });
        await socket.sendMessage(antiDeleteInboxJid, { sticker: buf });
      } else if (mType === 'documentMessage') {
        await socket.sendMessage(antiDeleteInboxJid, { text: `${header}\n\n📄 Deleted a document: ${content.documentMessage?.fileName || 'unknown file'}` });
      } else {
        await socket.sendMessage(antiDeleteInboxJid, { text: `${header}\n\n⚠️ Deleted a message of an unsupported type (${mType}).` });
      }
    } catch (e) {
      console.error('AntiDelete Error:', e);
    }
  }

  socket.ev.on('messages.upsert', async ({ messages }) => {
    const m = messages[0];
    if (!m || !m.message) return;
    const protoMsg = m.message.protocolMessage;
    if (protoMsg && protoMsg.type === 0 /* REVOKE */ && protoMsg.key) {
      await handleAntiDeleteRevoke(protoMsg.key);
    }
  });

  socket.ev.on('messages.update', async (updates) => {
    for (const u of updates) {
      const isDeleted = u.update?.messageStubType === 68 /* REVOKE */ ||
        u.update?.message === null ||
        u.update?.status === 'DELETED';
      if (isDeleted && u.key) {
        await handleAntiDeleteRevoke(u.key);
      }
    }
  });
}

// ───────────────── SINGLE-INSTANCE LOCK (ROOT FIX FOR BAD MAC) ──
// The #1 cause of recurring "Bad MAC" / random session closes on hosts
// like Render/Railway/Replit isn't a bug in the message handlers — it's
// TWO live processes holding the SAME WhatsApp session at once. This
// happens every time the app restarts or redeploys: the platform starts
// the new process (which restores every number from Mongo on boot,
// below) while the OLD process is still finishing its shutdown grace
// period. For a few seconds, two sockets are authenticated as the same
// device — their local Signal ratchet counters diverge from each other,
// and every message after that point fails to decrypt (Bad MAC) until
// the session is purged and re-paired. This lock makes a fresh process
// wait for the previous one to go quiet before it takes over, and the
// shutdown hook below makes the previous one close its sockets and
// release the lock immediately instead of lingering.
const INSTANCE_ID = crypto.randomBytes(8).toString('hex');
const LOCK_STALE_MS = 25000;   // heartbeat older than this = previous instance is dead
const LOCK_HEARTBEAT_MS = 8000;
let lockHeartbeatTimer = null;

async function acquireInstanceLock() {
  try {
    await initMongo();
    if (!locksCol) return; // Mongo not configured — nothing to coordinate against
    const existing = await locksCol.findOne({ _id: 'singleton' });
    if (existing && existing.instanceId !== INSTANCE_ID) {
      const age = Date.now() - new Date(existing.heartbeat).getTime();
      if (age < LOCK_STALE_MS) {
        const waitMs = (LOCK_STALE_MS - age) + 2000;
        console.log(`⏳ [SAYURI MINI] Previous instance (${existing.instanceId}) still looks active — waiting ${Math.round(waitMs / 1000)}s before restoring sessions, to avoid a Bad MAC collision.`);
        await delay(waitMs);
      }
    }
    await locksCol.updateOne({ _id: 'singleton' }, { $set: { instanceId: INSTANCE_ID, heartbeat: new Date() } }, { upsert: true });
    lockHeartbeatTimer = setInterval(() => {
      locksCol.updateOne({ _id: 'singleton' }, { $set: { instanceId: INSTANCE_ID, heartbeat: new Date() } }).catch(() => {});
    }, LOCK_HEARTBEAT_MS);
    lockHeartbeatTimer.unref?.();
  } catch (e) {
    // If Mongo hiccups here, don't block startup — worst case we're back
    // to the old behaviour for this one boot.
  }
}

async function releaseInstanceLock() {
  try {
    if (lockHeartbeatTimer) { clearInterval(lockHeartbeatTimer); lockHeartbeatTimer = null; }
    if (locksCol) await locksCol.deleteOne({ _id: 'singleton', instanceId: INSTANCE_ID });
  } catch (e) {}
}

// Called from index.js on SIGTERM/SIGINT (redeploys, restarts, Ctrl+C).
// Closing every socket cleanly — instead of letting the process just get
// killed with live sockets attached — is what stops the NEXT process's
// boot-time restore from ever overlapping with this one.
async function shutdownAllSessions() {
  for (const flush of [...pendingCredFlushes.values()]) { try { await flush(); } catch (e) {} }
  console.log(`🛑 [SAYURI MINI] Graceful shutdown — closing ${activeSockets.size + pendingSockets.size} live session(s)...`);
  for (const store of [activeSockets, pendingSockets]) {
    for (const [san, sock] of store) {
      try {
        killSocket(sock, 'process_shutting_down');
      } catch (e) {}
    }
    store.clear();
  }
  await releaseInstanceLock();
}

// ──────────────── MEMORY HOUSEKEEPING ───────────────────────────
// Several Maps/objects only ever grew (menu state, movie/pin/cine search
// sessions, group settings, stale stored messages). Over hours/days that
// is the "RAM keeps climbing" problem. This sweeper trims them every
// 2 minutes and, if the process gets close to the memory limit, trims
// harder and asks V8 to garbage-collect (needs --expose-gc, see package.json).
const SESSION_MAX_AGE = 10 * 60 * 1000;
const MEMORY_SOFT_LIMIT_MB = parseInt(process.env.MEMORY_LIMIT_MB || '400', 10);

function sweepSessionObject(obj) {
  if (!obj) return;
  const now = Date.now();
  for (const k of Object.keys(obj)) {
    if (now - ((obj[k] && obj[k].timestamp) || 0) > SESSION_MAX_AGE) delete obj[k];
  }
}

function runMemoryHousekeeping() {
  try {
    const now = Date.now();
    for (const [k, v] of userMenuState) if (now - (v.timestamp || 0) > SESSION_MAX_AGE) userMenuState.delete(k);
    sweepSessionObject(global.movieSessions);
    sweepSessionObject(global.cineSessions);
    sweepSessionObject(global.pinSessions);
    for (const [k, v] of groupSettingsCache) if (now - (v.ts || 0) > GROUP_SETTINGS_CACHE_TTL * 3) groupSettingsCache.delete(k);
    for (const [k, v] of userConfigCache) if (now - (v.ts || 0) > USER_CONFIG_CACHE_TTL * 6) userConfigCache.delete(k);
    for (const [k, v] of messageStore) if (now - (v.__ts || 0) > MESSAGE_STORE_TTL) messageStore.delete(k);
    for (const [k, v] of reconnectHistory) {
      const fresh = v.filter(t => now - t < RECONNECT_WINDOW_MS);
      if (fresh.length) reconnectHistory.set(k, fresh); else reconnectHistory.delete(k);
    }

    const rssMB = process.memoryUsage().rss / 1048576;
    if (rssMB > MEMORY_SOFT_LIMIT_MB) {
      console.log(`🧹 [SAYURI MINI] Memory at ${Math.round(rssMB)}MB (limit ${MEMORY_SOFT_LIMIT_MB}MB) — trimming caches`);
      messageStore.clear();
      groupSettingsCache.clear();
      processedStatus.clear();
      processedChannelMsgs.clear();
      if (typeof global.gc === 'function') global.gc();
    }
  } catch (e) {}
}
const _housekeepingTimer = setInterval(runMemoryHousekeeping, 2 * 60 * 1000);
_housekeepingTimer.unref?.();

// ───────────────── AUTO-RESTART & LIFECYCLE ─────────────────────
// Tracks recent reconnect timestamps per number so a session stuck in a
// crash-loop (e.g. permanently corrupted signal keys causing endless
// "Bad MAC" errors) gets purged instead of retrying forever and flooding
// the logs / hogging the dyno.
const reconnectHistory = new Map();
const pendingCredFlushes = new Map(); // number -> flush fn (so a shutdown never loses the latest keys)
const CREDS_SAVE_DEBOUNCE_MS = 4000;
const RECONNECT_WINDOW_MS = 3 * 60 * 1000; // 3 minutes
const RECONNECT_LIMIT = 5; // more than 5 reconnects in that window = broken session

function setupAutoRestart(socket, number) {
  socket.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;
    if (connection !== 'close') return;

    if (!socket.authState?.creds?.registered) return;

    const san = number.replace(/[^0-9]/g, '');
    const statusCode = lastDisconnect?.error?.output?.statusCode;
    if (statusCode === DisconnectReason.loggedOut) {
      console.log(`[SAYURI MINI] Session ${san} logged out.`);
      await deleteEntireSession(san);
      return;
    }

    // ── Crash-loop guard ──────────────────────────────────────────
    const now = Date.now();
    const history = (reconnectHistory.get(san) || []).filter(t => now - t < RECONNECT_WINDOW_MS);
    history.push(now);
    reconnectHistory.set(san, history);

    if (history.length > RECONNECT_LIMIT) {
      console.error(`⛔ [SAYURI MINI] Session ${san} reconnected ${history.length} times in ${RECONNECT_WINDOW_MS / 1000}s — looks corrupted, purging session instead of retrying forever.`);
      reconnectHistory.delete(san);
      await deleteEntireSession(san);
      return;
    }

    if (reconnectInProgress.has(san)) return;
    reconnectInProgress.add(san);
    activeSockets.delete(san);
    killSocket(socket, 'reconnecting'); // dead socket + its listeners were never freed before -> memory piled up on every reconnect

    console.log(`[SAYURI MINI] Auto reconnecting session ${san} in 5s... (${history.length}/${RECONNECT_LIMIT} in this window)`);
    await delay(5000);
    try {
      const mockRes = { headersSent: false, send: () => {}, status: () => mockRes };
      await EmpirePair(san, mockRes);
    } catch (e) {
      console.error(`Reconnect error for ${san}:`, e.message);
    } finally {
      reconnectInProgress.delete(san);
    }
  });
}

// ───────────────── EMPIRE PAIRING CORE ──────────────────────────
async function EmpirePair(number, res, isForce = false) {
  const sanitizedNumber = number.replace(/[^0-9]/g, '');
  const sessionPath = path.join(os.tmpdir(), `sakura_session_${sanitizedNumber}`);
  await initMongo().catch(()=>{});

  // Prevent two pairing attempts for the same number from racing each other.
  // This is the main cause of "Bad MAC" / stuck-pairing errors: two live
  // sockets end up sharing the same signal keys at once.
  if (pairingLock.has(sanitizedNumber)) {
    if (!res.headersSent) {
      res.status(429).send({
        error: 'Pairing already in progress for this number. Please wait a few seconds and try again.'
      });
    }
    return;
  }
  pairingLock.add(sanitizedNumber);

  try {
    // Kill ANY existing socket for this number — whether it's fully
    // connected (activeSockets) or still mid-pairing (pendingSockets).
    // Previously only activeSockets was checked, so a socket that was
    // created but never finished pairing stayed alive in the background
    // and collided with the next pairing attempt, producing Bad MAC
    // errors and silently swallowing the new pairing code.
    for (const store of [activeSockets, pendingSockets]) {
      if (store.has(sanitizedNumber)) {
        try {
          killSocket(store.get(sanitizedNumber), 'replaced_by_new_pairing_attempt');
        } catch (e) {}
        store.delete(sanitizedNumber);
      }
    }

    // Give WhatsApp's servers a moment to register the old socket as
    // disconnected before opening a new one for the same number — trying
    // to pair again instantly is what usually triggers Bad MAC / conflict
    // errors.
    await delay(1200);

    await EmpirePairInner(number, sanitizedNumber, sessionPath, res, isForce);
  } finally {
    pairingLock.delete(sanitizedNumber);
  }
}

async function EmpirePairInner(number, sanitizedNumber, sessionPath, res, isForce) {
  if (isForce) {
    await deleteEntireSession(sanitizedNumber);
  } else {
    try {
      const mongoDoc = await loadCredsFromMongo(sanitizedNumber);
      if (mongoDoc && mongoDoc.files && Object.keys(mongoDoc.files).length > 0) {
        fs.ensureDirSync(sessionPath);
        for (const [fname, content] of Object.entries(mongoDoc.files)) {
          try { fs.writeFileSync(path.join(sessionPath, fname), content, 'utf8'); } catch(e) {}
        }
      } else {
        if (fs.existsSync(sessionPath)) {
          await fs.remove(sessionPath).catch(() => {});
        }
      }
    } catch (e) {}
  }

  const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
  const logger = pino({ level: 'silent' });
  const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: [2, 3000, 1015901307] }));

  try {
    const socket = makeWASocket({
      version,
      auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, logger) },
      printQRInTerminal: false,
      logger,
      browser: Browsers.ubuntu('Chrome'),
      connectTimeoutMs: 60000,
      keepAliveIntervalMs: 30000,
      syncFullHistory: false,
      shouldSyncHistoryMessage: () => false, // never process history-sync blobs (big RAM spike on every login)
      generateHighQualityLinkPreview: false
    });

    socketCreationTime.set(sanitizedNumber, Date.now());
    pendingSockets.set(sanitizedNumber, socket);

    setupStatusHandlers(socket, sanitizedNumber);
    setupGroupParticipantHandlers(socket, sanitizedNumber);
    setupCommandHandlers(socket, sanitizedNumber);
    setupAutoRestart(socket, sanitizedNumber);
    setupChannelReactHandler(socket, sanitizedNumber);
    setupCallHandlers(socket, sanitizedNumber);

    if (pendingInactivityTimers.has(sanitizedNumber)) {
      clearTimeout(pendingInactivityTimers.get(sanitizedNumber));
    }
    
    const inactivityTimeout = setTimeout(async () => {
      if (!activeSockets.has(sanitizedNumber)) {
        console.log(`⏱️ [Inactivity Cleanup] +${sanitizedNumber} remained inactive for 2 minutes. Purging session...`);
        await deleteEntireSession(sanitizedNumber);
      }
    }, 120 * 1000);

    pendingInactivityTimers.set(sanitizedNumber, inactivityTimeout);

    if (!socket.authState.creds.registered) {
      let code = null;
      try {
        await delay(2500);
        code = await socket.requestPairingCode(sanitizedNumber);
        if (code) {
          code = code.match(/.{1,4}/g)?.join("-") || code;
        }
      } catch (error) {
        console.error('Pairing code generation error:', error.message);
      }
      if (!res.headersSent) res.send({ code: code || null, number: sanitizedNumber, status: 'pairing_code_generated' });
    } else {
      if (!res.headersSent) {
        res.send({ 
          status: 'already_connected', 
          number: sanitizedNumber,
          message: 'Session is already connected. To re-generate code, pass &force=true' 
        });
      }
    }

    // creds.update fires many times per second on busy numbers. It used to
    // re-read EVERY session file and push it all to Mongo each time, which
    // was a constant RAM/CPU spike. Local disk is still saved instantly;
    // the Mongo backup is now coalesced into one save every few seconds.
    let credsMongoTimer = null;
    const flushCredsToMongo = async () => {
      credsMongoTimer = null;
      pendingCredFlushes.delete(sanitizedNumber);
      try {
        const credsPath = path.join(sessionPath, 'creds.json');
        if (fs.existsSync(credsPath)) {
          const credsObj = JSON.parse(await fs.promises.readFile(credsPath, 'utf8'));
          await saveCredsToMongo(sanitizedNumber, credsObj, null, sessionPath);
        }
      } catch (err) {}
    };
    socket.ev.on('creds.update', async () => {
      try { await saveCreds(); } catch (err) {}
      if (credsMongoTimer) clearTimeout(credsMongoTimer);
      credsMongoTimer = setTimeout(flushCredsToMongo, CREDS_SAVE_DEBOUNCE_MS);
      pendingCredFlushes.set(sanitizedNumber, async () => { if (credsMongoTimer) clearTimeout(credsMongoTimer); await flushCredsToMongo(); });
    });

    socket.ev.on('connection.update', async (update) => {
      const { connection } = update;
      if (connection === 'open') {
        if (pendingInactivityTimers.has(sanitizedNumber)) {
          clearTimeout(pendingInactivityTimers.get(sanitizedNumber));
          pendingInactivityTimers.delete(sanitizedNumber);
        }

        pendingSockets.delete(sanitizedNumber);
        activeSockets.set(sanitizedNumber, socket);
        await addNumberToMongo(sanitizedNumber);
        console.log(`🌙 [SAYURI MINI Connected] +${sanitizedNumber} connected successfully!`);
      } else if (connection === 'close') {
        // If it closes before ever finishing pairing, drop it from
        // pendingSockets too so the next request for this number doesn't
        // think a pairing attempt is still alive.
        if (pendingSockets.get(sanitizedNumber) === socket) {
          pendingSockets.delete(sanitizedNumber);
        }
      }
    });

  } catch (error) {
    console.error('Sakura Pairing error:', error);
    if (!res.headersSent) res.status(503).send({ error: 'Service Unavailable' });
  }
}

// ───────────────── EXPRESS ROUTER ENDPOINTS ─────────────────────
router.get('/', async (req, res) => {
  const { number, force, reset } = req.query;
  if (!number) return res.status(400).send({ error: 'Number parameter is required' });
  const sanitized = number.replace(/[^0-9]/g, '');

  const isForce = force === 'true' || force === '1' || reset === 'true' || reset === '1';

  if (isForce && activeSockets.has(sanitized)) {
    await deleteEntireSession(sanitized);
  }

  await EmpirePair(number, res, isForce);
});

router.get('/delete', async (req, res) => {
  const { number } = req.query;
  if (!number) return res.status(400).send({ error: 'Number parameter is required' });
  const sanitized = number.replace(/[^0-9]/g, '');
  await deleteEntireSession(sanitized);
  res.send({ status: 'success', message: `Session for +${sanitized} deleted successfully.` });
});

router.get('/logout', async (req, res) => {
  const { number } = req.query;
  if (!number) return res.status(400).send({ error: 'Number parameter is required' });
  const sanitized = number.replace(/[^0-9]/g, '');
  await deleteEntireSession(sanitized);
  res.send({ status: 'success', message: `Logged out and session cleared for +${sanitized}.` });
});

router.get('/active', (req, res) => {
  res.status(200).send({ botName: config.BOT_NAME, count: activeSockets.size, numbers: Array.from(activeSockets.keys()) });
});

router.get('/ping', (req, res) => {
  res.status(200).send({ status: 'active', botName: config.BOT_NAME, activesession: activeSockets.size });
});

initMongo().catch(()=>{});
(async () => {
  try {
    await acquireInstanceLock();
    const nums = await getAllNumbersFromMongo();
    for (const n of nums) {
      const san = n.replace(/[^0-9]/g, '');
      if (!activeSockets.has(san)) {
        const mockRes = { headersSent: false, send: () => {}, status: () => mockRes };
        await EmpirePair(san, mockRes);
        await delay(2500);
      }
    }
  } catch (e) {}
})();

router.gracefulShutdown = shutdownAllSessions;
module.exports = router;

