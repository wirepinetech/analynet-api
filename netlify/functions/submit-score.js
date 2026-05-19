const { getStore } = require('@netlify/blobs');

const GEMINI_URL = 'https://api.analynet.xyz/.netlify/functions/gemini';

const SUBSTITUTE_NAMES = [
  'Valedictorian', 'AllAs', 'TeachPet', 'HallPass',
  'ExtraCredit', 'DeansList', 'GoldStar', 'FrontRow'
];

exports.handler = async (event) => {
  const origin = event.headers.origin || '';
  const originAllowed = origin === 'https://analynet.xyz' || origin.endsWith('.analynet.xyz');
  const corsOrigin = originAllowed ? origin : 'https://analynet.xyz';

  const headers = {
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
    'Vary': 'Origin'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Use POST' }) };

  try {
    const body = JSON.parse(event.body);
    const gameId = cleanGameId(body.gameId);
    let name = cleanName(body.name);
    const score = Number(body.score);

    if (!gameId || !name || !Number.isFinite(score) || score < 0 || score > 999999) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing or invalid fields' }) };
    }

    // Gemini profanity check
    const flagged = await isFlagged(name);
    if (flagged) {
      name = SUBSTITUTE_NAMES[Math.floor(Math.random() * SUBSTITUTE_NAMES.length)];
    }

    const store = getStore({
      name: 'leaderboards',
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_TOKEN
    });

    const key = `game-${gameId}`;
    const existing = await store.get(key, { type: 'json' });
    const scores = Array.isArray(existing) ? existing : [];

    scores.push({ name, score, date: new Date().toISOString().slice(0, 10) });
    scores.sort((a, b) => b.score - a.score);
    const topScores = scores.slice(0, 10);

    await store.setJSON(key, topScores);

    return { statusCode: 200, headers, body: JSON.stringify(topScores) };
  } catch (err) {
    console.error('submit-score error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Could not submit score' }) };
  }
};

async function isFlagged(name) {
  try {
    const response = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: `Is the following name inappropriate for a middle/high school leaderboard? Reply with only YES or NO. Name: "${name}"`
      })
    });
    const data = await response.json();
    return data.text?.trim().toUpperCase().startsWith('YES');
  } catch (err) {
    console.error('Gemini filter error:', err);
    return false; // if filter fails, allow the name through
  }
}

function cleanGameId(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 40);
}

function cleanName(value) {
  return String(value || 'Player').replace(/[<>]/g, '').trim().slice(0, 20);
}
