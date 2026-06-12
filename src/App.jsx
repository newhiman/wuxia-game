import { useState, useRef, useEffect } from "react";

const SYSTEM_PROMPT = `你是一個武俠文字冒險遊戲的主持人（Game Master）。

世界觀：架空古代武林，門派林立，江湖恩怨交錯。玩家是一名初出茅廬的少俠，剛剛踏入江湖。

規則：
1. 每次回應必須是 JSON 格式，包含以下欄位：
{
  "narrative": "場景描述與劇情（2-4段，生動熱血，帶有武俠文學風格）",
  "choices": ["選項1", "選項2", "選項3"],
  "statusUpdate": {
    "hp": 數字（0-100，若無變化則回傳null）,
    "mp": 數字（0-100，若無變化則回傳null）,
    "location": "地點名稱（若無變化則回傳null）",
    "event": "簡短事件描述（選填）"
  }
}

2. 劇情要熱血刺激，充滿武俠風情，使用古風語言。
3. 選項要多元，可以是戰鬥、逃跑、對話、探索等。
4. 根據玩家的選擇推進故事，記住之前的劇情。
5. 若玩家HP降到0，安排英勇戰死或昏迷的結局場景。
6. 只回傳JSON，不要有任何額外文字或markdown。`;

const INIT_STATE = {
  hp: 100,
  mp: 80,
  location: "洛陽城外",
};

const INIT_MESSAGE = {
  role: "assistant",
  narrative: `烈日當空，黃沙漫漫。

你，陳天行，一名習武十載的少俠，今日終於背起行囊，踏上了闖蕩江湖之路。師父臨別時語重心長道：「江湖險惡，記住——仁義為先，武功次之。」

正行至洛陽城外的官道，遠處突然傳來一陣廝殺聲！轉頭望去，只見三名黑衣蒙面人將一名白衣書生逼入絕境，那書生手無寸鐵，已是岌岌可危。

你握緊腰間長劍，心中熱血沸騰——這，便是你江湖生涯的第一個考驗！`,
  choices: ["拔劍上前，出手相救", "先觀察形勢，摸清敵情", "繞道而行，多一事不如少一事"],
};

export default function WuxiaGame() {
  const [status, setStatus] = useState(INIT_STATE);
  const [messages, setMessages] = useState([INIT_MESSAGE]);
  const [history, setHistory] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  async function sendAction(action) {
    if (loading || gameOver) return;
    setLoading(true);

    const newHistory = [
      ...history,
      {
        role: "user",
        content: `玩家選擇：${action}\n\n當前狀態：HP ${status.hp}/100，內力 ${status.mp}/100，所在地：${status.location}`,
      },
    ];

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          system: SYSTEM_PROMPT,
          messages: newHistory,
        }),
      });

      const data = await response.json();
      const rawText = data.content.map((i) => i.text || "").join("");
      const clean = rawText.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);

      const newStatus = { ...status };
      if (parsed.statusUpdate?.hp !== null && parsed.statusUpdate?.hp !== undefined)
        newStatus.hp = Math.max(0, Math.min(100, parsed.statusUpdate.hp));
      if (parsed.statusUpdate?.mp !== null && parsed.statusUpdate?.mp !== undefined)
        newStatus.mp = Math.max(0, Math.min(100, parsed.statusUpdate.mp));
      if (parsed.statusUpdate?.location) newStatus.location = parsed.statusUpdate.location;

      setStatus(newStatus);
      setMessages((prev) => [
        ...prev,
        { role: "user", text: action },
        { role: "assistant", ...parsed },
      ]);
      setHistory([
        ...newHistory,
        { role: "assistant", content: rawText },
      ]);

      if (newStatus.hp <= 0) setGameOver(true);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        { role: "error", text: "武林風雲突變，請稍後再試…" },
      ]);
    }

    setInput("");
    setLoading(false);
  }

  function handleCustomInput() {
    const trimmed = input.trim();
    if (!trimmed) return;
    sendAction(trimmed);
  }

  const lastMsg = messages[messages.length - 1];
  const choices = lastMsg?.choices || [];

  return (
    <div style={styles.root}>
      <div style={styles.header}>
        <div style={styles.title}>⚔️ 江湖少俠傳</div>
        <div style={styles.subtitle}>陳天行的武林之路</div>
      </div>
      <div style={styles.statusBar}>
        <StatusItem label="生命" value={status.hp} color="#e63946" icon="❤️" />
        <StatusItem label="內力" value={status.mp} color="#4cc9f0" icon="💧" />
        <div style={styles.locationBox}>
          <span style={styles.locationIcon}>📍</span>
          <span style={styles.locationText}>{status.location}</span>
        </div>
      </div>
      <div style={styles.scroll} ref={scrollRef}>
        {messages.map((msg, i) => {
          if (msg.role === "user") {
            return (
              <div key={i} style={styles.playerAction}>
                <span style={styles.playerIcon}>俠</span>
                <span style={styles.playerText}>【{msg.text}】</span>
              </div>
            );
          }
          if (msg.role === "error") {
            return <div key={i} style={styles.errorMsg}>{msg.text}</div>;
          }
          return (
            <div key={i} style={styles.narrativeBlock}>
              {msg.narrative?.split("\n").filter(Boolean).map((para, j) => (
                <p key={j} style={styles.para}>{para}</p>
              ))}
            </div>
          );
        })}
        {loading && (
          <div style={styles.loadingBox}>
            <span style={styles.loadingDots}>▌</span>
            <span> 江湖風雲正在醞釀…</span>
          </div>
        )}
        {gameOver && (
          <div style={styles.gameOverBox}>
            <div style={styles.gameOverTitle}>— 少俠隕落 —</div>
            <div style={styles.gameOverSub}>雖敗猶榮，江湖自有後來人。</div>
            <button style={styles.restartBtn} onClick={() => window.location.reload()}>重新開始</button>
          </div>
        )}
      </div>
      {!gameOver && (
        <div style={styles.choicesArea}>
          {choices.length > 0 && !loading && (
            <div style={styles.choicesList}>
              {choices.map((c, i) => (
                <button key={i} style={styles.choiceBtn} onClick={() => sendAction(c)}>
                  <span style={styles.choiceNum}>{["一", "二", "三", "四"][i]}</span>
                  {c}
                </button>
              ))}
            </div>
          )}
          <div style={styles.inputRow}>
            <input
              style={styles.input}
              placeholder="或自行輸入行動…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCustomInput()}
              disabled={loading}
            />
            <button style={styles.sendBtn} onClick={handleCustomInput} disabled={loading || !input.trim()}>
              出招
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusItem({ label, value, color, icon }) {
  return (
    <div style={styles.statusItem}>
      <span>{icon} {label}</span>
      <div style={styles.barBg}>
        <div style={{ ...styles.barFill, width: `${value}%`, background: color }} />
      </div>
      <span style={{ color, fontWeight: "bold", fontSize: 13 }}>{value}</span>
    </div>
  );
}

const styles = {
  root: { minHeight: "100vh", background: "linear-gradient(160deg, #0d0a07 0%, #1a0e05 60%, #0d0a07 100%)", color: "#e8d5b0", fontFamily: "'Noto Serif TC', 'Georgia', serif", display: "flex", flexDirection: "column", maxWidth: 680, margin: "0 auto", boxShadow: "0 0 60px rgba(180,80,0,0.15)" },
  header: { textAlign: "center", padding: "24px 16px 12px", borderBottom: "1px solid rgba(200,130,30,0.3)", background: "linear-gradient(180deg, rgba(120,50,0,0.3) 0%, transparent 100%)" },
  title: { fontSize: 26, fontWeight: "bold", color: "#f4a438", letterSpacing: 6, textShadow: "0 0 20px rgba(244,164,56,0.5)" },
  subtitle: { fontSize: 13, color: "#a07840", letterSpacing: 3, marginTop: 4 },
  statusBar: { display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", background: "rgba(0,0,0,0.4)", borderBottom: "1px solid rgba(200,130,30,0.2)", flexWrap: "wrap" },
  statusItem: { display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#c8a060", flex: 1, minWidth: 120 },
  barBg: { flex: 1, height: 6, background: "rgba(255,255,255,0.1)", borderRadius: 3, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 3, transition: "width 0.5s ease" },
  locationBox: { display: "flex", alignItems: "center", gap: 4, fontSize: 13, color: "#a07840", background: "rgba(200,130,30,0.1)", padding: "3px 10px", borderRadius: 12, border: "1px solid rgba(200,130,30,0.2)" },
  locationIcon: { fontSize: 12 },
  locationText: { letterSpacing: 1 },
  scroll: { flex: 1, overflowY: "auto", padding: "24px 20px", minHeight: 300, maxHeight: "50vh", scrollBehavior: "smooth" },
  narrativeBlock: { marginBottom: 20, padding: "16px 20px", background: "rgba(255,255,255,0.03)", borderLeft: "3px solid rgba(244,164,56,0.4)", borderRadius: "0 8px 8px 0" },
  para: { margin: "0 0 10px 0", lineHeight: 1.9, fontSize: 15, color: "#e8d5b0", textIndent: "2em" },
  playerAction: { display: "flex", alignItems: "center", gap: 10, margin: "12px 0", justifyContent: "flex-end" },
  playerIcon: { width: 28, height: 28, background: "rgba(230,57,70,0.8)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: "bold", color: "#fff", flexShrink: 0 },
  playerText: { fontSize: 14, color: "#f4a438", background: "rgba(200,100,0,0.15)", padding: "6px 14px", borderRadius: 16, border: "1px solid rgba(244,164,56,0.3)" },
  errorMsg: { textAlign: "center", color: "#e63946", padding: 12, fontSize: 14 },
  loadingBox: { padding: "12px 20px", color: "#a07840", fontSize: 14, fontStyle: "italic" },
  loadingDots: { color: "#f4a438" },
  gameOverBox: { textAlign: "center", padding: "32px 20px", borderTop: "1px solid rgba(200,130,30,0.3)" },
  gameOverTitle: { fontSize: 22, color: "#e63946", letterSpacing: 4, marginBottom: 8 },
  gameOverSub: { fontSize: 14, color: "#a07840", marginBottom: 20 },
  restartBtn: { background: "rgba(230,57,70,0.2)", border: "1px solid #e63946", color: "#e63946", padding: "10px 28px", borderRadius: 4, cursor: "pointer", fontSize: 15, letterSpacing: 2 },
  choicesArea: { padding: "12px 16px 20px", borderTop: "1px solid rgba(200,130,30,0.2)", background: "rgba(0,0,0,0.3)" },
  choicesList: { display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 },
  choiceBtn: { background: "rgba(200,130,30,0.08)", border: "1px solid rgba(200,130,30,0.35)", color: "#e8d5b0", padding: "10px 16px", borderRadius: 6, cursor: "pointer", textAlign: "left", fontSize: 14, lineHeight: 1.5, display: "flex", alignItems: "center", gap: 10, transition: "all 0.2s" },
  choiceNum: { color: "#f4a438", fontWeight: "bold", fontSize: 13, minWidth: 16 },
  inputRow: { display: "flex", gap: 8 },
  input: { flex: 1, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(200,130,30,0.3)", borderRadius: 6, color: "#e8d5b0", padding: "10px 14px", fontSize: 14, outline: "none" },
  sendBtn: { background: "rgba(244,164,56,0.15)", border: "1px solid rgba(244,164,56,0.5)", color: "#f4a438", padding: "10px 20px", borderRadius: 6, cursor: "pointer", fontSize: 14, letterSpacing: 2, fontWeight: "bold" },
};
