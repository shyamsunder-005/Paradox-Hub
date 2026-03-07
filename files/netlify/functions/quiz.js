// Paradox Hub — AI Quiz Proxy
// Primary:  Google Gemini 1.5 Flash (free, 1500 req/day)
// Fallback: Groq Llama 3 70B       (free, 14400 req/day)

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const prompt = body.prompt || '';
  if (!prompt) return { statusCode: 400, body: JSON.stringify({ error: 'No prompt' }) };

  const GEMINI_KEY = process.env.GEMINI_KEY;
  const GROQ_KEY   = process.env.GROQ_KEY;

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
      if (res.ok) {
        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (text) return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ text, provider: 'gemini' }),
        };
      }
      console.log('Gemini failed status:', res.status, '— falling back to Groq');
    } catch (e) { console.log('Gemini error:', e.message); }
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
      if (res.ok) {
        const data = await res.json();
        const text = data?.choices?.[0]?.message?.content || '';
        if (text) return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ text, provider: 'groq' }),
        };
      }
      console.log('Groq failed status:', res.status);
    } catch (e) { console.log('Groq error:', e.message); }
  }

  return {
    statusCode: 503,
    body: JSON.stringify({ error: 'Both AI providers unavailable. Please try again shortly.' }),
  };
};
