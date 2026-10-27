"use client";

import { useState } from "react";

export default function ChatbotPanel() {
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSend() {
    if (!message.trim() || loading) return;

    setLoading(true);
    setReply("");

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Chat request failed.");
      }

      setReply(data.reply ?? "No reply received.");
    } catch (error) {
      setReply(error instanceof Error ? error.message : "Chat request failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h2>Chatbot</h2>

      <input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Ask Atlas..."
        style={{ width: "70%" }}
      />

      <button
        onClick={handleSend}
        disabled={loading || !message.trim()}
        style={{ marginLeft: 8 }}
      >
        {loading ? "Thinking..." : "Send"}
      </button>

      {reply && <p>{reply}</p>}
    </div>
  );
}
