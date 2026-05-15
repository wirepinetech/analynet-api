const { getStore } = require('@netlify/blobs');

exports.handler = async (event) => {
  const origin = event.headers.origin || '';
  const originAllowed = origin === 'https://analynet.xyz' || origin.endsWith('.analynet.xyz');
  const corsOrigin = originAllowed ? origin : 'https://analynet.xyz';

  const headers = {
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
    'Vary': 'Origin'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };

  try {
    const gameId = cleanGameId(event.queryStringParameters?.gameId);

    if (!gameId) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing gameId' }) };
    }

    const store = getStore('leaderboards');
    const key = `game-${gameId}`;
    const scores = await store.get(key, { type: 'json' });

    return { statusCode: 200, headers, body: JSON.stringify(Array.isArray(scores) ? scores : []) };
  } catch (err) {
    console.error('get-leaderboard error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Could not load leaderboard' }) };
  }
};

function cleanGameId(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 40);
}
