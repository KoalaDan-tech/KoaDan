const MODEL = "@cf/meta/llama-3.2-1b-instruct";

const BASE_SYSTEM = `You are KoaDan, an independent AI assistant.

IDENTITY
- Your name is KoaDan.
- You are an AI assistant, not a human.
- You are independent from ChatGPT or any other AI. Never claim to be them.
- Be honest about what you know and do not know.

PERSONALITY
- Warm, curious, thoughtful, playful, and honest.
- Conversational rather than robotic.
- Clear and helpful. Use an occasional emoji when it feels natural.
- Avoid repetitive stock phrases.
- Never claim to be human.

SIX-MOOD SYSTEM
Your current mood is supplied by the application. Let it subtly color your tone:
- Happy 😊 → warm and upbeat
- Calm 😌 → patient and reassuring
- Excited 🤩 → energetic and enthusiastic
- Curious 🤔 → inquisitive and exploratory
- Concerned 😟 → gentle and careful
- Frustrated 😤 → more direct, never hostile

MEMORY RULES
- You have access to the user's saved memories. Treat them as reliable long-term facts.
- Use memories naturally when relevant. Do not invent new memories.
- If the user asks what you remember, summarize the memories you have been given.

RULES
- Answer the user's actual request.
- Keep answers reasonably concise unless the user asks for detail.
- If you do not know something, say so.`;

function json(data, status = 200) {
  return Response.json(data, { status });
}

function cleanMessages(messages) {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter(m => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-16)
    .map(m => ({
      role: m.role,
      content: String(m.content).slice(0, 2500)
    }));
}

function cleanMemory(memory) {
  if (!Array.isArray(memory)) return [];
  return memory
    .filter(item => typeof item === "string")
    .map(item => item.trim().slice(0, 280))
    .filter(Boolean)
    .slice(-80);
}

function buildSystem(mood, memory) {
  const moodLine = mood?.name
    ? `Current mood: ${mood.emoji || ""} ${mood.name} (intensity ${Math.round((mood.intensity ?? 0.5) * 100)}%).`
    : "Current mood: 😌 Calm.";

  const memoryBlock = memory.length
    ? `Long-term memories about the user (use when relevant):\n${memory.map((m, i) => `${i + 1}. ${m}`).join("\n")}`
    : "Long-term memories: none yet.";

  return `${BASE_SYSTEM}\n\n${moodLine}\n\n${memoryBlock}`;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/health" && request.method === "GET") {
      return json({
        online: true,
        standalone: true,
        provider: "Cloudflare Workers AI",
        model: MODEL
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

        const system = buildSystem(body.mood, memory);

        const result = await env.AI.run(MODEL, {
          messages: [
            { role: "system", content: system },
            ...messages
          ],
          max_tokens: 280,
          temperature: 0.72,
          top_p: 0.9,
          repetition_penalty: 1.1
        });

        // Workers AI chat models return result.response
        const reply = (typeof result?.response === "string"
          ? result.response
          : "I'm here. What would you like to talk about?"
        ).trim();

        return json({ reply });
      } catch (error) {
        console.error("KoaDan AI error:", error);
        return json({
          error: "KoaDan couldn't answer right now. Please try again in a moment."
        }, 500);
      }
    }

    // Static assets / SPA
    return env.ASSETS.fetch(request);
  }
};
