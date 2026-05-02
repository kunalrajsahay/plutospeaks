"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

type Mode = "ai" | "friend";

export default function Home() {
  const [mode, setMode] = useState<Mode>("ai");
  const [user, setUser] = useState<any>(null);

  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isResetMode, setIsResetMode] = useState(false);

  const [friendEmail, setFriendEmail] = useState("");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user || null);
      if (event === "PASSWORD_RECOVERY") setIsResetMode(true);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function signUp() {
    if (!authEmail.trim() || !authPassword.trim()) {
      alert("Enter email and password");
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email: authEmail,
      password: authPassword,
    });

    if (error) return alert(error.message);

    if (data.user) {
      await supabase.from("profiles").upsert({
        id: data.user.id,
        email: data.user.email,
      });
    }

    alert("Signup successful ✅ Now login");
  }

  async function login() {
    if (!authEmail.trim() || !authPassword.trim()) {
      alert("Enter email and password");
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: authEmail,
      password: authPassword,
    });

    if (error) return alert(error.message);

    if (data.user) {
      await supabase.from("profiles").upsert({
        id: data.user.id,
        email: data.user.email,
      });

      setUser(data.user);
    }
  }

  async function resetPasswordEmail() {
    if (!authEmail.trim()) {
      alert("Enter your email first");
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(authEmail, {
      redirectTo: "http://localhost:3000",
    });

    if (error) return alert(error.message);

    alert("Password reset email sent 📩");
  }

  async function updatePassword() {
    if (!newPassword.trim()) {
      alert("Enter new password");
      return;
    }

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) return alert(error.message);

    setIsResetMode(false);
    setNewPassword("");
    await supabase.auth.signOut();
    setUser(null);
    alert("Password updated ✅ Now login again");
  }

  async function logout() {
    await supabase.auth.signOut();
    setUser(null);
    setMessages([]);
  }

  async function loadFriendMessages() {
    if (!user || !friendEmail.trim()) return;

    const friend = friendEmail.trim();

    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .or(
        `and(sender_email.eq.${user.email},receiver_email.eq.${friend}),and(sender_email.eq.${friend},receiver_email.eq.${user.email})`
      )
      .order("created_at", { ascending: true });

    if (!error && data) setMessages(data);
  }

  useEffect(() => {
    if (mode !== "friend" || !user || !friendEmail.trim()) return;

    loadFriendMessages();

    const friend = friendEmail.trim();

    const channel = supabase
      .channel("private-chat")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const msg: any = payload.new;

          const isThisChat =
            (msg.sender_email === user.email && msg.receiver_email === friend) ||
            (msg.sender_email === friend && msg.receiver_email === user.email);

          if (isThisChat) {
            setMessages((prev) => {
              const exists = prev.some((m) => m.id === msg.id);
              return exists ? prev : [...prev, msg];
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [mode, user, friendEmail]);

  async function sendMessage() {
    if (!input.trim() || loading) return;

    const text = input.trim();
    setInput("");

    if (mode === "friend") {
      if (!user) return alert("Login first");
      if (!friendEmail.trim()) return alert("Enter friend email");

      const tempMessage = {
        id: crypto.randomUUID(),
        sender_id: user.id,
        sender_email: user.email,
        receiver_email: friendEmail.trim(),
        content: text,
        created_at: new Date().toISOString(),
        pending: true,
      };

      setMessages((prev) => [...prev, tempMessage]);

      const { data, error } = await supabase
        .from("messages")
        .insert({
          sender_id: user.id,
          sender_email: user.email,
          receiver_email: friendEmail.trim(),
          content: text,
        })
        .select()
        .single();

      if (error) {
        alert(error.message);
        return;
      }

      if (data) {
        setMessages((prev) =>
          prev.map((m) => (m.id === tempMessage.id ? data : m))
        );
      }

      return;
    }

    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        content: text,
        created_at: new Date().toISOString(),
      },
    ]);

    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      const data = await res.json();

      setMessages((prev) => [
        ...prev,
        {
          role: "bot",
          content: data.reply || "Pluto could not respond.",
          created_at: new Date().toISOString(),
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "bot",
          content: "⚠️ Pluto is having trouble connecting to AI.",
          created_at: new Date().toISOString(),
        },
      ]);
    }

    setLoading(false);
  }

  function formatTime(dateValue: string) {
    return new Date(dateValue).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <main className="relative flex h-screen bg-gradient-to-br from-black via-purple-900 to-blue-900 text-white overflow-hidden">
      <style jsx>{`
        @keyframes fadeGlow {
          0% { opacity: 0.35; text-shadow: 0 0 4px #22d3ee; }
          50% { opacity: 1; text-shadow: 0 0 16px #22d3ee, 0 0 28px #a855f7; }
          100% { opacity: 0.35; text-shadow: 0 0 4px #22d3ee; }
        }
        .kunal-watermark {
          animation: fadeGlow 3s ease-in-out infinite;
        }
      `}</style>

      <section className="w-1/4 min-w-[270px] p-6 border-r border-white/10 flex flex-col items-center bg-black/20">
        <img
          src="/pluto.png"
          alt="PlutoSpeaks"
          className="w-32 h-32 object-cover rounded-xl shadow-[0_0_30px_#22d3ee]"
        />

        <h1 className="mt-5 text-3xl font-bold text-yellow-300">
          PlutoSpeaks
        </h1>

        <p className="text-sm text-gray-300 mt-3 text-center">
          Exploring the Universe of Knowledge
        </p>

        {isResetMode ? (
          <div className="mt-8 w-full space-y-3">
            <p className="text-sm text-cyan-300 text-center">
              Create your new password
            </p>

            <input
              className="w-full p-3 rounded-lg bg-black/40 border border-white/20 outline-none text-white placeholder:text-gray-400"
              placeholder="New password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />

            <button
              onClick={updatePassword}
              className="w-full bg-cyan-500 hover:bg-cyan-400 py-3 rounded-lg font-semibold"
            >
              Update Password
            </button>
          </div>
        ) : !user ? (
          <div className="mt-8 w-full space-y-3">
            <input
              className="w-full p-3 rounded-lg bg-black/40 border border-white/20 outline-none text-white placeholder:text-gray-400"
              placeholder="Email"
              value={authEmail}
              onChange={(e) => setAuthEmail(e.target.value)}
            />

            <input
              className="w-full p-3 rounded-lg bg-black/40 border border-white/20 outline-none text-white placeholder:text-gray-400"
              placeholder="Password"
              type="password"
              value={authPassword}
              onChange={(e) => setAuthPassword(e.target.value)}
            />

            <button
              onClick={login}
              className="w-full bg-cyan-500 hover:bg-cyan-400 py-3 rounded-lg font-semibold"
            >
              Login
            </button>

            <button
              onClick={signUp}
              className="w-full bg-purple-600 hover:bg-purple-500 py-3 rounded-lg font-semibold"
            >
              Sign Up
            </button>

            <button
              onClick={resetPasswordEmail}
              className="w-full text-cyan-300 hover:text-cyan-200 text-sm font-semibold"
            >
              Forgot password?
            </button>
          </div>
        ) : (
          <div className="mt-8 w-full space-y-3">
            <div className="text-sm text-cyan-300 break-all">
              Logged in: {user.email}
            </div>

            <button
              onClick={logout}
              className="w-full bg-red-500/70 hover:bg-red-500 py-3 rounded-lg font-semibold"
            >
              Logout
            </button>

            {mode === "friend" && (
              <>
                <input
                  className="w-full p-3 rounded-lg bg-black/40 border border-white/20 outline-none text-white placeholder:text-gray-400"
                  placeholder="Friend email"
                  value={friendEmail}
                  onChange={(e) => setFriendEmail(e.target.value)}
                />

                <button
                  onClick={loadFriendMessages}
                  className="w-full bg-purple-600 hover:bg-purple-500 py-3 rounded-lg font-semibold"
                >
                  Open Friend Chat
                </button>
              </>
            )}
          </div>
        )}
      </section>

      <section className="flex-1 flex flex-col p-6">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <img src="/pluto.png" alt="logo" className="w-8 h-8 rounded-full" />
            <h2 className="text-xl font-bold">PlutoSpeaks</h2>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => {
                setMode("ai");
                setMessages([]);
              }}
              className={`px-5 py-2 rounded-xl font-semibold transition ${
                mode === "ai"
                  ? "bg-cyan-500 text-white"
                  : "bg-white/10 text-gray-300"
              }`}
            >
              🤖 AI Chat
            </button>

            <button
              onClick={() => {
                setMode("friend");
                setMessages([]);
              }}
              className={`px-5 py-2 rounded-xl font-semibold transition ${
                mode === "friend"
                  ? "bg-purple-600 text-white"
                  : "bg-white/10 text-gray-300"
              }`}
            >
              👥 Friend Chat
            </button>
          </div>
        </div>

        <div className="text-center mb-6 text-lg font-semibold">
          {mode === "ai"
            ? "Welcome to PlutoSpeaks! 👋"
            : friendEmail
            ? `Private chat with ${friendEmail}`
            : "Friend Chat: login and enter friend email"}
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 pb-4">
          {messages.map((msg, i) => {
            const isMine =
              mode === "friend"
                ? msg.sender_email === user?.email
                : msg.role === "user";

            return (
              <div
                key={msg.id || i}
                className={`max-w-2xl p-4 rounded-xl shadow-lg ${
                  isMine
                    ? "ml-auto bg-cyan-500 text-white"
                    : "mr-auto bg-black/50 text-white border border-white/10"
                }`}
              >
                {mode === "friend" && (
                  <p className="text-xs text-white/70 mb-1">
                    {msg.sender_email}
                  </p>
                )}

                <p>{msg.content}</p>

                <div className="flex justify-end items-center gap-2 mt-2">
                  {msg.pending && (
                    <span className="text-[10px] text-white/60">sending...</span>
                  )}

                  <p className="text-[11px] text-white/70">
                    {msg.created_at ? formatTime(msg.created_at) : ""}
                  </p>
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="mr-auto max-w-xl bg-black/50 p-4 rounded-xl border border-white/10">
              ✨ Pluto is thinking...
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        <div className="flex gap-3 border-t border-white/10 pt-4">
          <input
            className="flex-1 p-4 rounded-xl bg-black/50 border border-white/20 outline-none text-white placeholder:text-gray-400"
            placeholder={
              mode === "ai"
                ? "Ask PlutoSpeaks anything..."
                : friendEmail
                ? "Message your friend..."
                : "Enter friend email first..."
            }
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") sendMessage();
            }}
          />

          <button
            onClick={sendMessage}
            disabled={loading}
            className="bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 px-5 rounded-xl text-2xl transition"
          >
            🚀
          </button>
        </div>
      </section>

      <div className="fixed bottom-4 left-4 z-50 text-sm font-bold kunal-watermark">
        <span className="bg-gradient-to-r from-cyan-400 via-white to-purple-400 bg-clip-text text-transparent">
          kunal
        </span>
      </div>
    </main>
  );
}