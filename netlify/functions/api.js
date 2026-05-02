exports.handler = async (event) => {
  // Only allow requests from analynet.xyz and its subdomains
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
    return { statusCode: 403, headers, body: JSON.stringify({ error: { message: 'Origin not allowed' } }) };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: 'Method Not Allowed' };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: { message: 'GEMINI_API_KEY is not configured.' } })
    };
  }

  try {
    const payload = JSON.parse(event.body);
    const { action, query, system, prompt } = payload;

    let apiUrl = '';
    let requestBody = {};

    if (action === 'image') {
      apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${apiKey}`;
      requestBody = {
        instances: [{ prompt }],
        parameters: { sampleCount: 1 }
      };
    } else {
      apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
      requestBody = {
        contents: [{ parts: [{ text: query }] }],
        systemInstruction: { parts: [{ text: system }] },
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: { critique: { type: 'STRING' }, score: { type: 'NUMBER' } }
          },
          thinkingConfig: { thinkingBudget: 0 }
        }
      };
    }

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
        signal: AbortSignal.timeout(4000)
      });
      data = await response.json();
      if (response.status !== 503) break;
    }

    return { statusCode: 200, headers, body: JSON.stringify(data) };

  } catch (error) {
    console.error('Proxy error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: { message: 'Internal server error connecting to Google API.' } })
    };
  }
};
