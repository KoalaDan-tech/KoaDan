const emotions = {
  happy:     { name: "Happy",     emoji: "😊", desc: "Warm, upbeat and ready to help." },
  calm:      { name: "Calm",      emoji: "😌", desc: "Patient, steady and reassuring." },
  excited:   { name: "Excited",   emoji: "🤩", desc: "Energetic and enthusiastic." },
  curious:   { name: "Curious",   emoji: "🤔", desc: "Interested and eager to explore." },
  concerned: { name: "Concerned", emoji: "😟", desc: "Gentle, careful and supportive." },
  frustrated:{ name: "Frustrated",emoji: "😤", desc: "More direct when something is confusing." }
};

const MAX_HISTORY = 60;          // client-side history length
const MAX_MEMORY  = 80;          // long-term facts
const API_HISTORY = 16;          // how many recent messages go to the model

let mood = JSON.parse(localStorage.getItem("koadan_mood") || "null") || { key: "happy", intensity: 0.65 };
let history = JSON.parse(localStorage.getItem("koadan_history") || "[]");
let memory  = JSON.parse(localStorage.getItem("koadan_memory")  || "[]");

const $ = id => document.getElementById(id);
const messagesEl = $("messages");

function saveState() {
  localStorage.setItem("koadan_history", JSON.stringify(history.slice(-MAX_HISTORY)));
  localStorage.setItem("koadan_memory",  JSON.stringify(memory.slice(-MAX_MEMORY)));
  localStorage.setItem("koadan_mood",    JSON.stringify(mood));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, ch =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch])
  );
}

/* ---------- Memory ---------- */

function extractMemory(text) {
  if (!text || typeof text !== "string") return;

  // Explicit remember commands
  const explicit = text.match(
    /^(?:please\s+)?(?:remember|don't forget|save|note that|keep in mind)\s+(?:that\s+)?(.+)/i
  );
  if (explicit) {
    addMemory(explicit[1]);
    return;
  }

  // Light automatic extraction of clear self-facts (very conservative)
  const autoPatterns = [
    /(?:my name is|i'm|i am)\s+([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)/i,
    /(?:i live in|i'm from|from)\s+([A-Z][a-zA-Z\s]{2,40})/i,
    /(?:i work as|i'm a|i am a)\s+([a-zA-Z\s]{3,40})/i,
  ];
  for (const re of autoPatterns) {
    const m = text.match(re);
    if (m) addMemory(m[0].trim());
  }
}

function addMemory(fact) {
  fact = fact.trim().replace(/[.?!]+$/, "").slice(0, 280);
  if (fact.length < 3) return;
  const lower = fact.toLowerCase();
  if (memory.some(m => m.toLowerCase() === lower)) return;
  memory.push(fact);
  saveState();
  renderMemory();
}

function renderMemory() {
  const box = $("memoryList");
  if (!box) return;
  box.innerHTML = memory.length
    ? memory.map((m, i) =>
        `<div class="memory-item">
          <span>${escapeHtml(m)}</span>
          <button type="button" data-memory-index="${i}" aria-label="Forget this memory">×</button>
        </div>`
      ).join("")
    : `<div class="memory-empty">No saved memories yet.</div>`;
}

/* ---------- Mood ---------- */

function renderMood() {
  const e = emotions[mood.key] || emotions.happy;
  $("moodEmoji").textContent = e.emoji;
  $("moodName").textContent = e.name;
  $("moodDescription").textContent = e.desc;
  $("intensity").textContent = Math.round(mood.intensity * 100) + "%";
  $("meterFill").style.width = (mood.intensity * 100) + "%";
  document.querySelectorAll(".emotion").forEach(el => {
    el.classList.toggle("active", el.dataset.key === mood.key);
  });
}

function renderEmotionList() {
  $("emotionList").innerHTML = Object.entries(emotions).map(([key, e]) =>
    `<div class="emotion ${key === mood.key ? "active" : ""}" data-key="${key}">
      <b>${e.emoji} ${e.name}</b>
    </div>`
  ).join("");
}

function setMoodFromText(text, isUser = true) {
  const t = text.toLowerCase();
  let key = null;
  if (/thank|awesome|great|love|haha|lol|yay|nice/.test(t)) key = "happy";
  if (/\?|\bhow\b|\bwhy\b|\bwhat\b|\binteresting\b|\bexplain\b/.test(t)) key = "curious";
  if (/excited|amazing|can't wait|wow|awesome/.test(t)) key = "excited";
  if (/sad|worried|stress|upset|scared|bad day|anxious/.test(t)) key = "concerned";
  if (/confused|doesn't work|broken|error|wrong|frustrating/.test(t)) key = "frustrated";
  if (!key && !isUser) key = "calm";
  if (!key) return;

  if (mood.key === key) {
    mood.intensity = Math.min(1, mood.intensity + 0.05);
  } else {
    mood.key = key;
    mood.intensity = 0.52 + Math.random() * 0.2;
  }
  saveState();
  renderMood();
  renderEmotionList();
}

/* ---------- Chat UI ---------- */

function addMessage(role, text, scroll = true) {
  const welcome = document.querySelector(".welcome");
  if (welcome) welcome.remove();

  const div = document.createElement("div");
  div.className = `msg ${role}`;
  div.innerHTML = `
    <div class="avatar">${role === "user" ? "You" : "🌿"}</div>
    <div class="bubble"></div>
  `;
  div.querySelector(".bubble").textContent = text;
  messagesEl.appendChild(div);
  if (scroll) messagesEl.scrollTop = messagesEl.scrollHeight;
}

function restoreHistory() {
  if (!history.length) return;
  // Clear welcome if present
  const welcome = document.querySelector(".welcome");
  if (welcome) welcome.remove();

  history.forEach(msg => {
    if (msg.role === "user" || msg.role === "assistant") {
      addMessage(msg.role, msg.content, false);
    }
  });
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

/* ---------- Send ---------- */

async function sendMessage(text) {
  const clean = text.trim();
  if (!clean) return;

  addMessage("user", clean);
  history.push({ role: "user", content: clean });
  extractMemory(clean);
  saveState();
  setMoodFromText(clean, true);

  $("sendBtn").disabled = true;

  const typing = document.createElement("div");
  typing.className = "msg";
  typing.id = "typing";
  typing.innerHTML = `<div class="avatar">🌿</div><div class="bubble typing">KoaDan is thinking…</div>`;
  messagesEl.appendChild(typing);
  messagesEl.scrollTop = messagesEl.scrollHeight;

  try {
    // Only send the most recent messages + full memory
    const recent = history.slice(-API_HISTORY);

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: recent,
        memory,
        mood: {
          name: emotions[mood.key].name,
          emoji: emotions[mood.key].emoji,
          intensity: mood.intensity
        }
      })
    });

    const data = await res.json();
    $("typing")?.remove();

    if (!res.ok) throw new Error(data.error || "Request failed");

    const reply = data.reply || "I'm here.";
    addMessage("assistant", reply);
    history.push({ role: "assistant", content: reply });
    saveState();
    setMoodFromText(reply, false);
  } catch (err) {
    $("typing")?.remove();
    addMessage("assistant", "I'm having a little trouble right now. " + (err.message || "Please try again."));
    mood.key = "calm";
    mood.intensity = 0.55;
    renderMood();
    renderEmotionList();
  } finally {
    $("sendBtn").disabled = false;
  }
}

/* ---------- Event listeners ---------- */

$("chatForm").addEventListener("submit", e => {
  e.preventDefault();
  const input = $("input");
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  input.style.height = "auto";
  sendMessage(text);
});

$("input").addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    $("chatForm").requestSubmit();
  }
});

$("input").addEventListener("input", e => {
  e.target.style.height = "auto";
  e.target.style.height = Math.min(e.target.scrollHeight, 150) + "px";
});

$("clearBtn").addEventListener("click", () => {
  history = [];
  saveState();
  messagesEl.innerHTML = `
    <div class="welcome">
      <div class="welcome-emoji">🌿</div>
      <h2>Hey, I'm KoaDan.</h2>
      <p>A curious little AI with six moods. What's on your mind?</p>
    </div>`;
  // Note: memory is intentionally kept
});

$("memoryList")?.addEventListener("click", e => {
  const btn = e.target.closest("button[data-memory-index]");
  if (!btn) return;
  memory.splice(Number(btn.dataset.memoryIndex), 1);
  saveState();
  renderMemory();
});

$("clearMemoryBtn")?.addEventListener("click", () => {
  memory = [];
  saveState();
  renderMemory();
});

// Emotion list click (optional – currently display only)
$("emotionList")?.addEventListener("click", e => {
  const el = e.target.closest(".emotion");
  if (!el) return;
  // Optional: allow manual mood override
  // mood.key = el.dataset.key;
  // mood.intensity = 0.7;
  // saveState(); renderMood(); renderEmotionList();
});

/* ---------- Boot ---------- */

renderMood();
renderEmotionList();
renderMemory();
restoreHistory();   // ← this is the big one for “remember every conversation”
