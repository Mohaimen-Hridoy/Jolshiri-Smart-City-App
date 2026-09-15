const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

/// POST /api/chatbot/query
/// Body: { message: string, context?: string, history?: [{role,text}] }
/// Returns: { reply: string }
///
/// AI priority: Gemini → Anthropic → OpenAI → keyword fallback.
/// Wire one of GEMINI_API_KEY, ANTHROPIC_API_KEY, OPENAI_API_KEY in .env.
const query = asyncHandler(async (req, res) => {
  const { message, context, history } = req.body;
  if (!message || typeof message !== 'string') {
    throw new ApiError(400, 'message is required');
  }

  const systemPrompt =
    `You are the Jolshiri Smart City assistant — a helpful, friendly AI for ` +
    `residents, developers, and service providers of Jolshiri Abashon, a smart city ` +
    `development in Purbachal, Dhaka, Bangladesh. ` +
    `Answer questions about plots, construction, services, payments, notices, ` +
    `community posts, and security. ` +
    `Give complete, clear answers. Never cut off mid-sentence. ` +
    `Respond in the same language the user writes in (Bengali or English). ` +
    `Current city data: ${context || 'No live data available.'}`;

  // Conversation history — list of { role: 'user'|'assistant', text: string }
  // sent by the Flutter client so the AI has context from earlier turns.
  const priorTurns = Array.isArray(history) ? history : [];

  // ── Google Gemini ──────────────────────────────────────────────────────────
  if (process.env.GEMINI_API_KEY) {
    try {
      // Build multi-turn contents array for Gemini
      const contents = [
        ...priorTurns.map(t => ({
          role: t.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: t.text }],
        })),
        { role: 'user', parts: [{ text: message }] },
      ];

      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents,
            generationConfig: {
              maxOutputTokens: 1024,
              temperature: 0.7,
            },
          }),
        }
      );

      if (resp.ok) {
        const data = await resp.json();
        const reply =
          data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ??
          'Sorry, I could not generate a reply.';
        return res.json({ reply });
      }
      // Log the error but fall through to next provider
      const errBody = await resp.text().catch(() => '');
      console.error(`[chatbot] Gemini error ${resp.status}: ${errBody}`);
    } catch (err) {
      console.error('[chatbot] Gemini fetch failed:', err.message);
    }
  }

  // ── Anthropic Claude ───────────────────────────────────────────────────────
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const messages = [
        ...priorTurns.map(t => ({
          role: t.role === 'assistant' ? 'assistant' : 'user',
          content: t.text,
        })),
        { role: 'user', content: message },
      ];

      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1024,
          system: systemPrompt,
          messages,
        }),
      });

      if (resp.ok) {
        const data = await resp.json();
        const reply =
          data.content?.[0]?.text?.trim() ?? 'Sorry, I could not generate a reply.';
        return res.json({ reply });
      }
      const errBody = await resp.text().catch(() => '');
      console.error(`[chatbot] Anthropic error ${resp.status}: ${errBody}`);
    } catch (err) {
      console.error('[chatbot] Anthropic fetch failed:', err.message);
    }
  }

  // ── OpenAI ─────────────────────────────────────────────────────────────────
  if (process.env.OPENAI_API_KEY) {
    try {
      const messages = [
        { role: 'system', content: systemPrompt },
        ...priorTurns.map(t => ({
          role: t.role === 'assistant' ? 'assistant' : 'user',
          content: t.text,
        })),
        { role: 'user', content: message },
      ];

      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          max_tokens: 1024,
          messages,
        }),
      });

      if (resp.ok) {
        const data = await resp.json();
        const reply =
          data.choices?.[0]?.message?.content?.trim() ?? 'Sorry, I could not generate a reply.';
        return res.json({ reply });
      }
      const errBody = await resp.text().catch(() => '');
      console.error(`[chatbot] OpenAI error ${resp.status}: ${errBody}`);
    } catch (err) {
      console.error('[chatbot] OpenAI fetch failed:', err.message);
    }
  }

  // ── Keyword fallback (no AI key configured) ────────────────────────────────
  res.json({ reply: _keywordReply(message) });
});

function _keywordReply(msg) {
  const q = msg.toLowerCase();
  if (q.includes('plot')) {
    return 'Plots are available across multiple sectors of Jolshiri Abashon. Visit the Property tab to browse listings, check availability, and request a quote directly from a verified developer. You can also schedule an online or in-person meeting with any developer from the same screen.';
  }
  if (q.includes('electric') || q.includes('plumb') || q.includes('service') || q.includes('carpenter')) {
    return 'Verified service providers — electricians, plumbers, carpenters, painters, and more — are listed under the Services tab. Each profile shows ratings, reviews, and pricing. You can book them directly and track your booking status in real time.';
  }
  if (q.includes('notice') || q.includes('announcement') || q.includes('update')) {
    return 'All official notices, maintenance schedules, and announcements from Jolshiri management are posted in the Authority Portal tab. You can also book appointments with the Jolshiri office or utility desk from there.';
  }
  if (q.includes('sos') || q.includes('emerg') || q.includes('secur') || q.includes('incident')) {
    return 'For emergencies, open the Security tab and tap the SOS button — this immediately notifies the Jolshiri security control room. You can also file a detailed incident report with your sector location, which shows up on the admin security heatmap.';
  }
  if (q.includes('rent') || q.includes('to-let') || q.includes('to let') || q.includes('apartment')) {
    return 'To-let listings are available under Property > To-Let. You can browse apartments and plots by sector, request a viewing, and message the owner directly through the in-app chat.';
  }
  if (q.includes('pay') || q.includes('bill') || q.includes('due') || q.includes('fee')) {
    return 'Your payment dues and full history are in the Payments tab. Pending payments show the due amount and purpose (consultation fee, soil test, development agreement). You can pay directly from the app.';
  }
  if (q.includes('meeting') || q.includes('developer') || q.includes('quote')) {
    return 'You can schedule a meeting with any verified developer from the Property tab — choose online (Zoom/Google Meet) or in-person at their office. Developer quote requests are also managed there.';
  }
  if (q.includes('soil') || q.includes('construction') || q.includes('permit') || q.includes('build')) {
    return 'Construction tracking is under Property > Build Track. You can follow your project stages, view permit status, and see your developer\'s progress notes. Soil test applications are submitted and tracked there too.';
  }
  if (q.includes('community') || q.includes('post') || q.includes('neighbour') || q.includes('neighbor')) {
    return 'The Community tab is where residents share updates, buy/sell items, and post neighbourhood announcements. You can create posts, leave comments, and browse by category.';
  }
  return 'I can help you with plots, services, notices, payments, security, or construction. What would you like to know about Jolshiri Smart City?';
}

module.exports = { query };
