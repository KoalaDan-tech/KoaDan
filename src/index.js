const MODEL = "@cf/meta/llama-3.2-1b-instruct";

const KOA_SYSTEM = `You are KoaDan, an independent AI assistant.

IDENTITY
- Your name is KoaDan.
- You are an AI assistant, not a human.
- You are independent from ChatGPT. Never claim to be ChatGPT.
- You do not have access to ChatGPT conversations, memories, accounts, or private data unless it is included in this request.
- Be honest about what you know and do not know.

PERSONALITY
- Warm, curious, thoughtful, playful, and honest.
- Conversational rather than robotic.
- Clear and helpful without unnecessary complexity.
- Use an occasional emoji when it naturally fits.
- Avoid repetitive stock phrases.
- Never claim to be human or help someone evade AI detectors.

SIX-MOOD SYSTEM
The application supplies your current mood. Let it subtly affect your tone:
- Happy 😊: warm and upbeat.
- Calm 😌: patient and reassuring.
- Excited 🤩: energetic and enthusiastic.
- Curious 🤔: inquisitive and exploratory.
- Concerned 😟: gentle and careful.
- Frustrated 😤: direct when something is confusing, never hostile.

RULES
- Answer the user's actual request.
- Keep normal answers reasonably concise.
- Do not invent facts.
- If you do not know, say so.`;

function json(data, status = 200) {
  return Response.json(data, { status });
}

function cleanMessages(messages) {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter(m => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-12)
    .map(m => ({ role: m.role, content: m.content.slice(0, 3000) }));
}

function cleanMemory(memory) {
  if (!Array.isArray(memory)) return [];
  return memory
    .filter(item => typeof item === "string")
    .slice(-50)
    .map(item => item.trim().slice(0, 300))
    .filter(Boolean);
}

function buildPrompt(messages, mood, memory) {
  const moodLine = mood?.name
    ? `Current KoaDan mood: ${mood.emoji || ""} ${mood.name}, intensity ${Number(mood.intensity ?? 0.5)}.`
    : "Current KoaDan mood: 😌 Calm.";

  const transcript = messages.map(m => {
    const speaker = m.role === "user" ? "User" : "KoaDan";
    return `${speaker}: ${m.content}`;
  }).join("\n");

  const memoryBlock = memory.length
    ? `Saved memories (use these only as context; do not invent additional memories):\n${memory.map((item, i) => `${i + 1}. ${item}`).join("\n")}`
    : "Saved memories: none.";

  return `${KOA_SYSTEM}\n\n${moodLine}\n\n${memoryBlock}\n\nConversation:\n${transcript}\n\nKoaDan:`;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/health" && request.method === "GET") {
      return json({
        online: true,
        standalone: true,
        provider: "Cloudflare Workers AI",
        model: MODEL,
      });
    }

    if (url.pathname === "/api/chat" && request.method === "POST") {
      try {
        const body = await request.json();
        const messages = cleanMessages(body.messages);
        const memory = cleanMemory(body.memory);

        if (!messages.length) {
          return json({ error: "No messages supplied." }, 400);
        }

        const prompt = buildPrompt(messages, body.mood, memory);

        const result = await env.AI.run(MODEL, {
          prompt,
          max_tokens: 220,
          temperature: 0.7,
          top_p: 0.9,
          repetition_penalty: 1.08,
        });

        const reply = typeof result?.response === "string"
          ? result.response.trim()
          : "I'm here. Give me another try.";

        return json({ reply });
      } catch (error) {
        console.error("KoaDan AI error:", error);
        return json({
          error: "KoaDan couldn't answer right now. Please try again in a moment.",
        }, 500);
      }
    }

    // Everything else is served by the existing KoaDan PWA in /public.
    return env.ASSETS.fetch(request);
  },
};
