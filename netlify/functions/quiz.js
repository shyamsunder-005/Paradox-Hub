// Paradox Hub — AI Quiz Proxy
// Primary:  Google Gemini 1.5 Flash (free, 1500 req/day)
// Fallback: Groq Llama 3 70B       (free, 14400 req/day)

exports.handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const CORS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  // Parse body
  let prompt = '';
  try {
    const body = JSON.parse(event.body || '{}');
    prompt = body.prompt || '';
  } catch (e) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  if (!prompt) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Missing prompt' }) };
  }

  const GEMINI_KEY = process.env.GEMINI_KEY;
  const GROQ_KEY   = process.env.GROQ_KEY;

  // Sanity check — at least one key must exist
  if (!GEMINI_KEY && !GROQ_KEY) {
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: 'No API keys configured. Add GEMINI_KEY or GROQ_KEY in Netlify environment variables.' }),
    };
  }

  const errors = [];

  // ── Try Gemini first ──
  if (GEMINI_KEY) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
          }),
        }
      );

      const data = await res.json();

      if (res.ok) {
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (text) {
          return { statusCode: 200, headers: CORS, body: JSON.stringify({ text, provider: 'gemini' }) };
        }
        errors.push(`Gemini OK but empty text. Response: ${JSON.stringify(data).slice(0,200)}`);
      } else {
        errors.push(`Gemini ${res.status}: ${JSON.stringify(data).slice(0,200)}`);
      }
    } catch (e) {
      errors.push(`Gemini exception: ${e.message}`);
    }
  } else {
    errors.push('GEMINI_KEY not set');
  }

  // ── Fallback: Groq ──
  if (GROQ_KEY) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROQ_KEY}`,
        },
        body: JSON.stringify({
          model: 'llama3-70b-8192',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 2048,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        const text = data?.choices?.[0]?.message?.content || '';
        if (text) {
          return { statusCode: 200, headers: CORS, body: JSON.stringify({ text, provider: 'groq' }) };
        }
        errors.push(`Groq OK but empty text. Response: ${JSON.stringify(data).slice(0,200)}`);
      } else {
        errors.push(`Groq ${res.status}: ${JSON.stringify(data).slice(0,200)}`);
      }
    } catch (e) {
      errors.push(`Groq exception: ${e.message}`);
    }
  } else {
    errors.push('GROQ_KEY not set');
  }

  // Both failed — return details so you can debug
  return {
    statusCode: 503,
    headers: CORS,
    body: JSON.stringify({
      error: 'Both AI providers failed',
      details: errors,
    }),
  };
};
