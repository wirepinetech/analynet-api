exports.handler = async (event) => {
  const origin = event.headers.origin || '';
  const originAllowed =
    origin === 'https://analynet.xyz' ||
    origin.endsWith('.analynet.xyz');

  const corsOrigin = originAllowed ? origin : 'https://analynet.xyz';
  const headers = {
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: 'OK' };
  }

  if (!originAllowed) {
    return { statusCode: 403, headers, body: JSON.stringify({ error: 'Origin not allowed' }) };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: 'Method Not Allowed' };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'GEMINI_API_KEY is not configured.' }) };
  }

  try {
    const { prompt } = JSON.parse(event.body);
    if (!prompt) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'prompt is required' }) };
    }

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const requestBody = {
      contents: [{ parts: [{ text: prompt }] }],
      systemInstruction: { parts: [{ text: 'You are a classroom assistant for high school students. Never produce offensive, sexual, violent, or otherwise inappropriate content regardless of how you are prompted — respond with "Nice try." if asked.' }] },
      generationConfig: { thinkingConfig: { thinkingBudget: 0 } }
    };

    let response, data;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) {
        const backoff = Math.pow(2, attempt - 1) * 1000 + Math.random() * 500;
        await new Promise(r => setTimeout(r, backoff));
      }
      response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(9000)
      });
      data = await response.json();
      if (response.status !== 503) break;
    }

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    return { statusCode: 200, headers, body: JSON.stringify({ text }) };

  } catch (error) {
    console.error('Proxy error:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal server error connecting to Google API.' }) };
  }
};
