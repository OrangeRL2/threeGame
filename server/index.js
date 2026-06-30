import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import { MongoClient } from 'mongodb';

const PORT = Number(process.env.PORT || 4000);
const WEB_URL = process.env.WEB_URL || 'http://localhost:5174';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/cardworld';
const MONGODB_DB = process.env.MONGODB_DB || undefined;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID || '';
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET || '';
const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || `http://localhost:${PORT}/auth/discord/callback`;

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '4mb' }));

const mongo = new MongoClient(MONGODB_URI);
await mongo.connect();
const db = MONGODB_DB ? mongo.db(MONGODB_DB) : mongo.db();
const users = db.collection('users'); // read-only source of existing Pixi/card inventory data
const gameProfilesThree = db.collection('gameprofiles_three'); // Three.js profile/world/HQ state
await gameProfilesThree.createIndex({ userId: 1 }, { unique: true, name: 'userId_1' }).catch((error) => {
  if (error?.code === 85 || error?.code === 86) console.warn(`Skipping existing index: ${error.message}`);
  else throw error;
});

function now() { return new Date(); }
function signToken(user) { return jwt.sign(user, JWT_SECRET, { expiresIn: '30d' }); }
function normalizeAvatar(input = {}) {
  return {
    bodyId: input.bodyId ?? input.body ?? 'default',
    faceId: input.faceId ?? 'neutral',
    hairId: input.hairId ?? input.hair ?? 'short-side-tail',
    outfitId: input.outfitId ?? input.outfit ?? 'plaid-idol',
    bottomId: input.bottomId ?? input.bottom ?? 'default-pants',
    accessoryIds: input.accessoryIds?.length ? input.accessoryIds : (input.accessory ? [input.accessory] : ['star-pin']),
    paletteId: input.paletteId ?? input.palette ?? 'comet-blue',
    animationSetId: input.animationSetId ?? 'standard'
  };
}
function normalizeProfile(input) {
  if (!input) return input;
  const holoCoins = input.currencies?.holoCoins ?? input.currencies?.arcadeCoins ?? 0;
  const { _id, ...profile } = input;
  return {
    ...profile,
    avatar: normalizeAvatar(profile.avatar ?? {}),
    progressFlags: profile.progressFlags ?? [],
    keyItems: profile.keyItems ?? [],
    ownedFurniture: profile.ownedFurniture ?? [],
    placedFurniture: profile.placedFurniture ?? [],
    currencies: { holoCoins }
  };
}
function defaultProfile(userId, displayName) {
  return {
    userId,
    displayName,
    avatar: normalizeAvatar({}),
    currentMapId: 'town_square',
    position: { x: 512, y: 390 },
    progressFlags: [],
    keyItems: [],
    currencies: { holoCoins: 0 },
    ownedFurniture: [],
    placedFurniture: [],
    createdAt: now(),
    updatedAt: now()
  };
}
function tokenPayload(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) throw Object.assign(new Error('Missing bearer token'), { status: 401 });
  const p = jwt.verify(token, JWT_SECRET);
  const userId = String(p.userId ?? p.discordId ?? p.id ?? p.sub ?? '');
  if (!userId) throw Object.assign(new Error('Token missing user id'), { status: 401 });
  return { userId, displayName: p.displayName ?? p.username ?? `Player ${userId.slice(-4)}` };
}
async function findUserCards(userId) {
  const query = { $or: [{ id: userId }, { userId }, { discordId: userId }, { discord_id: userId }, { discordID: userId }, { user_id: userId }] };
  return users.findOne(query, { projection: { cards: 1, _id: 0 } });
}

app.get('/auth/dev', (req, res) => {
  const userId = String(req.query.userId ?? 'dev-user');
  const displayName = String(req.query.displayName ?? `Dev ${userId}`);
  res.json({ token: signToken({ userId, displayName }) });
});
app.get('/auth/discord/start', (_req, res) => {
  if (!DISCORD_CLIENT_ID) {
    res.redirect(`${WEB_URL}?token=${encodeURIComponent(signToken({ userId: 'dev-discord', displayName: 'Dev Discord' }))}`);
    return;
  }
  const params = new URLSearchParams({ client_id: DISCORD_CLIENT_ID, redirect_uri: DISCORD_REDIRECT_URI, response_type: 'code', scope: 'identify' });
  res.redirect(`https://discord.com/oauth2/authorize?${params.toString()}`);
});
app.get('/auth/discord/callback', async (req, res, next) => {
  try {
    const code = String(req.query.code ?? '');
    const tokenRes = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({ client_id: DISCORD_CLIENT_ID, client_secret: DISCORD_CLIENT_SECRET, grant_type: 'authorization_code', code, redirect_uri: DISCORD_REDIRECT_URI }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
    const accessToken = tokenRes.data.access_token;
    const me = await axios.get('https://discord.com/api/users/@me', { headers: { Authorization: `Bearer ${accessToken}` } });
    const userId = String(me.data.id);
    const displayName = String(me.data.global_name ?? me.data.username ?? `Player ${userId.slice(-4)}`);
    res.redirect(`${WEB_URL}?token=${encodeURIComponent(signToken({ userId, displayName }))}`);
  } catch (error) { next(error); }
});

app.use('/game', (req, res, next) => {
  try {
    const payload = tokenPayload(req);
    res.locals.userId = payload.userId;
    res.locals.displayName = payload.displayName;
    next();
  } catch (error) {
    res.status(error.status || 401).json({ error: error.message || 'Invalid token' });
  }
});
app.get('/game/me', async (_req, res, next) => {
  try {
    const userId = String(res.locals.userId);
    const profile = await gameProfilesThree.findOne({ userId });
    res.json({ userId, displayName: res.locals.displayName, profile: profile ? normalizeProfile(profile) : null });
  } catch (error) { next(error); }
});
app.post('/game/profile', async (req, res, next) => {
  try {
    const userId = String(res.locals.userId);
    const displayName = String(req.body.displayName ?? res.locals.displayName).slice(0, 48);
    const existing = await gameProfilesThree.findOne({ userId });
    const base = existing ? normalizeProfile(existing) : defaultProfile(userId, displayName);
    const nextProfile = normalizeProfile({ ...base, userId, displayName, avatar: req.body.avatar ?? base.avatar, updatedAt: now() });
    const { createdAt, ...setFields } = nextProfile;
    await gameProfilesThree.updateOne({ userId }, { $set: setFields, $setOnInsert: { createdAt: createdAt ?? now() } }, { upsert: true });
    res.json(nextProfile);
  } catch (error) { next(error); }
});
app.get('/game/inventory', async (_req, res, next) => {
  try {
    const userId = String(res.locals.userId);
    const user = await findUserCards(userId);
    res.json((user?.cards ?? []).map((card) => ({ ...card, color: card.color ?? 'none' })));
  } catch (error) { next(error); }
});
app.post('/game/progress', async (req, res, next) => {
  try {
    const userId = String(res.locals.userId);
    const patch = req.body ?? {};
    const existing = await gameProfilesThree.findOne({ userId });
    if (!existing) await gameProfilesThree.insertOne(defaultProfile(userId, String(res.locals.displayName)));

    const update = { $set: { updatedAt: now() } };
    const addToSet = {};
    const inc = {};
    if (patch.addFlags?.length) addToSet.progressFlags = { $each: patch.addFlags };
    if (patch.addKeyItems?.length) addToSet.keyItems = { $each: patch.addKeyItems };
    const holoDelta = typeof patch.currenciesDelta?.holoCoins === 'number'
      ? patch.currenciesDelta.holoCoins
      : (typeof patch.currenciesDelta?.arcadeCoins === 'number' ? patch.currenciesDelta.arcadeCoins : undefined);
    if (typeof holoDelta === 'number') inc['currencies.holoCoins'] = holoDelta;
    if (patch.currentMapId) update.$set.currentMapId = patch.currentMapId;
    if (patch.position) update.$set.position = patch.position;
    if (Array.isArray(patch.setPlacedFurniture)) update.$set.placedFurniture = patch.setPlacedFurniture;
    if (Object.keys(addToSet).length) update.$addToSet = addToSet;
    if (Object.keys(inc).length) update.$inc = inc;
    await gameProfilesThree.updateOne({ userId }, update);

    if (Array.isArray(patch.addFurniture) && patch.addFurniture.length) {
      for (const item of patch.addFurniture) {
        const furnitureId = String(item.furnitureId ?? '');
        const count = Math.max(1, Number(item.count ?? 1));
        if (!furnitureId) continue;
        const hasItem = await gameProfilesThree.findOne({ userId, 'ownedFurniture.furnitureId': furnitureId });
        if (hasItem) await gameProfilesThree.updateOne({ userId, 'ownedFurniture.furnitureId': furnitureId }, { $inc: { 'ownedFurniture.$.count': count }, $set: { updatedAt: now() } });
        else await gameProfilesThree.updateOne({ userId }, { $push: { ownedFurniture: { furnitureId, count } }, $set: { updatedAt: now() } });
      }
    }

    const profile = await gameProfilesThree.findOne({ userId });
    res.json(normalizeProfile(profile));
  } catch (error) { next(error); }
});
app.get('/api/health', (_req, res) => res.json({ ok: true, mode: 'cardworld-three-clean', db: db.databaseName, readOnly: ['users'], writable: ['gameprofiles_three'] }));
app.use((error, _req, res, _next) => { console.error(error); res.status(error.status || 500).json({ error: error.message || 'Internal server error' }); });
app.listen(PORT, () => console.log(`CardWorld Three clean API listening on http://localhost:${PORT} (db=${db.databaseName})`));
