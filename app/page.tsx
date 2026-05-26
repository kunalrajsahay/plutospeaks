"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Msg = {
  id?: string;
  sender_id?: string | null;
  receiver_id?: string | null;
  sender_email?: string | null;
  receiver_email?: string | null;
  content: string;
  created_at?: string;
  is_read?: boolean | null;
};

type InboxMsg = Msg & {
  unread_count?: number;
};

type Mode = "ai" | "friend" | "astro";

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [mode, setMode] = useState<Mode>("ai");
  const [friendEmail, setFriendEmail] = useState("");
  const [activeFriend, setActiveFriend] = useState("");

  const [aiInput, setAiInput] = useState("");
  const [friendInput, setFriendInput] = useState("");
  const [aiMessages, setAiMessages] = useState<Msg[]>([]);
  const [friendMessages, setFriendMessages] = useState<Msg[]>([]);
  const [inbox, setInbox] = useState<InboxMsg[]>([]);

  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const myEmail = user?.email?.toLowerCase() || "";

  const scrollBottom = () => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getSession();
      setUser(data.session?.user || null);

      const savedFriend = localStorage.getItem("plutospeaks_friend_email");
      if (savedFriend) {
        setFriendEmail(savedFriend);
        setActiveFriend(savedFriend);
      }
    };

    init();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user?.email) return;
    loadInbox();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const login = async () => {
    if (!email || !password) return alert("Enter email and password");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) alert(error.message);
  };

  const signUp = async () => {
    if (!email || !password) return alert("Enter email and password");

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) alert(error.message);
    else alert("Account created. Now login with email and password.");
  };

  const forgotPassword = async () => {
    if (!email) return alert("Enter email first");

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });

    if (error) alert(error.message);
    else alert("Password reset email sent.");
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setFriendMessages([]);
    setInbox([]);
    setActiveFriend("");
    setMode("ai");
  };

  const loadInbox = async () => {
    if (!user?.email) return;

    const currentUserEmail = user.email.toLowerCase();

    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .or(`sender_email.eq.${currentUserEmail},receiver_email.eq.${currentUserEmail}`)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Inbox error:", error);
      return;
    }

    const grouped: Record<string, InboxMsg> = {};

    (data || []).forEach((msg: Msg) => {
      const senderEmail = msg.sender_email?.toLowerCase() || "";
      const receiverEmail = msg.receiver_email?.toLowerCase() || "";
      const otherUser = senderEmail === currentUserEmail ? receiverEmail : senderEmail;

      if (!otherUser) return;

      if (!grouped[otherUser]) {
        grouped[otherUser] = { ...msg, unread_count: 0 };
      }

      if (receiverEmail === currentUserEmail && senderEmail === otherUser && msg.is_read === false) {
        grouped[otherUser].unread_count = (grouped[otherUser].unread_count || 0) + 1;
      }
    });

    setInbox(Object.values(grouped));
  };

  const markMessagesAsRead = async (friend: string) => {
    if (!user?.email || !friend) return;

    const currentUserEmail = user.email.toLowerCase();
    const otherEmail = friend.toLowerCase();

    const { error } = await supabase
      .from("messages")
      .update({ is_read: true })
      .eq("sender_email", otherEmail)
      .eq("receiver_email", currentUserEmail)
      .eq("is_read", false);

    if (error) {
      console.error("Mark read error:", error);
    }
  };

  const loadFriendMessages = async (friend = activeFriend) => {
    if (!user?.email || !friend) return;

    const currentUserEmail = user.email.toLowerCase();
    const otherEmail = friend.toLowerCase();

    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .or(
        `and(sender_email.eq.${currentUserEmail},receiver_email.eq.${otherEmail}),and(sender_email.eq.${otherEmail},receiver_email.eq.${currentUserEmail})`
      )
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Load messages error:", error);
      return;
    }

    setFriendMessages(data || []);
    scrollBottom();
  };

  const openFriendChat = async () => {
    const cleanEmail = friendEmail.trim().toLowerCase();

    if (!cleanEmail) {
      alert("Enter friend email first");
      return;
    }

    localStorage.setItem("plutospeaks_friend_email", cleanEmail);
    setActiveFriend(cleanEmail);
    setMode("friend");

    await markMessagesAsRead(cleanEmail);
    await loadFriendMessages(cleanEmail);
    await loadInbox();
  };

  const openInboxChat = async (friend: string) => {
    const cleanEmail = friend.trim().toLowerCase();

    localStorage.setItem("plutospeaks_friend_email", cleanEmail);
    setFriendEmail(cleanEmail);
    setActiveFriend(cleanEmail);
    setMode("friend");

    await markMessagesAsRead(cleanEmail);
    await loadFriendMessages(cleanEmail);
    await loadInbox();
  };

  useEffect(() => {
    if (!user?.email) return;

    const channel = supabase
      .channel("plutospeaks-realtime-inbox")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        async (payload) => {
          const msg = payload.new as Msg;
          const currentUserEmail = user.email?.toLowerCase();
          const currentFriend = activeFriend.toLowerCase();

          const isForMe =
            msg.sender_email?.toLowerCase() === currentUserEmail ||
            msg.receiver_email?.toLowerCase() === currentUserEmail;

          if (isForMe) {
            await loadInbox();
          }

          const belongsToOpenChat =
            currentFriend &&
            ((msg.sender_email?.toLowerCase() === currentUserEmail &&
              msg.receiver_email?.toLowerCase() === currentFriend) ||
              (msg.sender_email?.toLowerCase() === currentFriend &&
                msg.receiver_email?.toLowerCase() === currentUserEmail));

          if (belongsToOpenChat) {
            setFriendMessages((prev) => {
              if (msg.id && prev.some((m) => m.id === msg.id)) return prev;
              return [...prev, msg];
            });

            if (msg.receiver_email?.toLowerCase() === currentUserEmail) {
              await markMessagesAsRead(currentFriend);
              await loadInbox();
            }

            scrollBottom();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, activeFriend]);

  useEffect(() => {
    if (!user || !activeFriend) return;

    loadFriendMessages(activeFriend);
    loadInbox();

    const fallback = setInterval(() => {
      loadFriendMessages(activeFriend);
      loadInbox();
    }, 5000);

    return () => {
      clearInterval(fallback);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, activeFriend]);

  const sendFriendMessage = async () => {
    if (!user?.email) return alert("Please login first");
    if (!activeFriend) return alert("Enter friend email first");
    if (!friendInput.trim()) return;

    const content = friendInput.trim();
    setFriendInput("");

    const tempMsg: Msg = {
      sender_id: user.id,
      sender_email: user.email.toLowerCase(),
      receiver_email: activeFriend.toLowerCase(),
      content,
      created_at: new Date().toISOString(),
      is_read: false,
    };

    setFriendMessages((prev) => [...prev, tempMsg]);
    scrollBottom();

    const { error } = await supabase.from("messages").insert({
      sender_id: user.id,
      sender_email: user.email.toLowerCase(),
      receiver_email: activeFriend.toLowerCase(),
      content,
      is_read: false,
    });

    if (error) {
      console.error("Send error:", error);
      alert(error.message);
      await loadFriendMessages(activeFriend);
    }

    await loadInbox();
  };

  const sendAIMessage = async () => {
    if (!aiInput.trim()) return;

    const userMsg: Msg = {
      content: aiInput.trim(),
      sender_email: "you",
      created_at: new Date().toISOString(),
    };

    setAiMessages((prev) => [...prev, userMsg]);
    const question = aiInput.trim();
    setAiInput("");
    setLoading(true);
    scrollBottom();

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: question }),
      });

      const data = await res.json();

      setAiMessages((prev) => [
        ...prev,
        {
          content: data.reply || "⚠️ Pluto is thinking too hard right now...",
          sender_email: "PlutoSpeaks AI",
          created_at: new Date().toISOString(),
        },
      ]);
    } catch {
      setAiMessages((prev) => [
        ...prev,
        {
          content: "⚠️ Pluto is thinking too hard right now...",
          sender_email: "PlutoSpeaks AI",
          created_at: new Date().toISOString(),
        },
      ]);
    }

    setLoading(false);
    scrollBottom();
  };

  const timeText = (date?: string) => {
    if (!date) return "";
    return new Date(date).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getOtherUser = (chat: Msg) => {
    const senderEmail = chat.sender_email?.toLowerCase() || "";
    const receiverEmail = chat.receiver_email?.toLowerCase() || "";
    return senderEmail === myEmail ? receiverEmail : senderEmail;
  };

  const activeMessages = mode === "ai" ? aiMessages : friendMessages;

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#070816] via-[#29115f] to-[#001f7a] text-white overflow-hidden">
      <div className="flex flex-col md:flex-row min-h-screen">
        <aside className="w-full md:w-[310px] bg-black/45 border-r border-white/10 p-4 md:p-7 flex flex-col max-h-[45vh] md:max-h-none overflow-y-auto">
          <div className="rounded-2xl overflow-hidden shadow-[0_0_30px_rgba(0,255,255,0.25)] mb-4 md:mb-7">
            <img
              src="/pluto.png"
              alt="PlutoSpeaks"
              className="w-full h-[120px] md:h-[210px] object-contain p-2"
            />
          </div>

          <h1 className="text-3xl md:text-4xl font-extrabold text-yellow-300 mb-3">PlutoSpeaks</h1>
          <p className="text-center text-white/80 mb-6 md:mb-8">
            Exploring the Universe of <br /> Knowledge
          </p>

          {!user ? (
            <>
              <input
                className="mb-4 px-4 py-3 rounded-lg bg-black/40 border border-white/10 outline-none"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />

              <input
                className="mb-4 px-4 py-3 rounded-lg bg-black/40 border border-white/10 outline-none"
                placeholder="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />

              <button onClick={login} className="mb-4 py-4 rounded-lg bg-cyan-400 text-white font-bold">
                Login
              </button>

              <button onClick={signUp} className="mb-4 py-4 rounded-lg bg-purple-600 text-white font-bold">
                Sign Up
              </button>

              <button onClick={forgotPassword} className="text-cyan-300 text-sm font-bold">
                Forgot password?
              </button>
            </>
          ) : (
            <>
              <p className="text-cyan-300 text-sm mb-4 break-words">Logged in: {user.email}</p>

              <button onClick={logout} className="mb-5 py-4 rounded-lg bg-red-600 font-bold">
                Logout
              </button>

              <input
                className="mb-4 px-4 py-3 rounded-lg bg-black/40 border border-white/10 outline-none"
                placeholder="Friend email"
                value={friendEmail}
                onChange={(e) => setFriendEmail(e.target.value)}
              />

              <button onClick={openFriendChat} className="py-4 rounded-lg bg-purple-600 font-bold">
                Open Friend Chat
              </button>

              <div className="mt-6 border-t border-white/10 pt-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-yellow-300">Inbox</h3>
                  <button
                    onClick={loadInbox}
                    className="text-xs px-3 py-1 rounded-full bg-white/10 hover:bg-white/20"
                  >
                    Refresh
                  </button>
                </div>

                <div className="space-y-3 overflow-y-auto max-h-[265px] pr-1">
                  {inbox.length === 0 ? (
                    <div className="text-sm text-white/50 bg-white/5 rounded-xl p-4">
                      No chats yet. Enter a friend email and send your first message.
                    </div>
                  ) : (
                    inbox.map((chat, index) => {
                      const otherUser = getOtherUser(chat);
                      const unreadCount = chat.unread_count || 0;
                      const isActive = otherUser === activeFriend.toLowerCase();

                      return (
                        <div
                          key={chat.id || index}
                          onClick={() => openInboxChat(otherUser)}
                          className={`cursor-pointer transition p-4 rounded-xl border ${
                            isActive
                              ? "bg-purple-600/40 border-cyan-300/40"
                              : "bg-white/5 border-white/10 hover:bg-white/10"
                          }`}
                        >
                          <div className="flex justify-between items-center gap-2">
                            <div className="font-bold truncate text-sm">{otherUser}</div>
                            <div className="text-[11px] text-white/50 whitespace-nowrap">
                              {timeText(chat.created_at)}
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-2 mt-1">
                            <div className="text-sm text-white/60 truncate">{chat.content}</div>

                            {unreadCount > 0 && (
                              <span className="min-w-5 h-5 px-1 rounded-full bg-cyan-300 text-black text-xs font-bold flex items-center justify-center">
                                {unreadCount}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </>
          )}

          <div className="mt-auto flex items-center gap-2 pt-6">
            <div className="w-10 h-10 rounded-full bg-black/60 flex items-center justify-center text-white font-bold">
              {user?.email?.[0]?.toUpperCase() || "U"}
            </div>
            <span className="text-sm text-white/60 truncate">{user?.email}</span>
          </div>
        </aside>

        <section className="flex-1 min-h-[55vh] md:h-screen flex flex-col p-4 md:p-8 relative overflow-hidden">
          <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4 md:mb-8">
            <h2 className="text-3xl font-bold">🪐 PlutoSpeaks</h2>

            <div className="flex gap-2 md:gap-4 w-full md:w-auto">
              <button
                onClick={() => setMode("ai")}
                className={`flex-1 md:flex-none px-4 md:px-8 py-3 md:py-4 rounded-2xl font-bold ${
                  mode === "ai" ? "bg-cyan-400" : "bg-purple-700/60"
                }`}
              >
                🤖 AI Chat
              </button>

              <button
                onClick={() => setMode("friend")}
                className={`flex-1 md:flex-none px-4 md:px-8 py-3 md:py-4 rounded-2xl font-bold ${
                  mode === "friend" ? "bg-purple-600" : "bg-purple-700/60"
                }`}
              >
                👥 Friend Chat
              </button>

              <button
                onClick={() => setMode("astro")}
                className={`flex-1 md:flex-none px-4 md:px-8 py-3 md:py-4 rounded-2xl font-bold ${
                  mode === "astro"
                    ? "bg-yellow-400 text-black"
                    : "bg-yellow-400/15 border border-yellow-300/20 text-white"
                }`}
              >
                🔮 Pluto Astro
              </button>
            </div>
          </header>

          {mode === "astro" ? (
            <div className="flex-1 overflow-y-auto rounded-3xl border border-yellow-300/20 bg-black/30 p-5 md:p-8">
              <div className="bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border border-yellow-400/30 rounded-3xl p-6 md:p-8 shadow-xl">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
                  <div className="flex-1">
                    <h1 className="text-3xl md:text-5xl font-extrabold text-yellow-300 mb-5">
                      🔮 Personal Kundali Reading by Kunal
                    </h1>

                    <p className="text-white/85 text-lg md:text-xl leading-relaxed mb-6">
                      Ask your personal astrology question directly to Kunal Raj. Career, marriage,
                      finance, business, foreign settlement, mahadasha, dosha, health guidance and
                      life direction.
                    </p>
                  </div>

                  <div className="bg-black/35 rounded-3xl p-6 min-w-[180px] text-center border border-white/10">
                    <div className="text-sm text-white/60">Reading Fee</div>
                    <div className="text-5xl font-extrabold text-yellow-300">₹50</div>
                    <div className="text-sm text-white/60">Only</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-8">
                  <a
                    href="mailto:kunalraj5@gmail.com?subject=Pluto%20Astro%20Personal%20Kundali%20Reading%20Request&body=Namaste%20Kunal%2C%0A%0AI%20want%20a%20Personal%20Kundali%20Reading.%0A%0AName%3A%0ADate%20of%20Birth%3A%0ATime%20of%20Birth%3A%0APlace%20of%20Birth%3A%0AQuestion%3A%0A%0AI%20will%20pay%20the%20%E2%82%B950%20reading%20fee.%0A"
                    className="block w-full text-center py-6 rounded-3xl bg-gradient-to-r from-yellow-400 to-orange-500 text-black font-extrabold text-xl md:text-2xl hover:scale-[1.01] transition"
                  >
                    ✨ Ask Kunal Directly
                  </a>

                  <div className="bg-black/30 rounded-3xl p-6 border border-white/10">
                    <h3 className="font-bold text-xl mb-3">Contact</h3>
                    <p className="text-xl text-white">kunalraj5@gmail.com</p>
                    <p className="text-white/70 mt-3">
                      User can email birth details and question after paying ₹50 reading fee.
                    </p>
                  </div>
                </div>

                <div className="mt-8 bg-black/25 rounded-3xl p-6 border border-white/10">
                  <h3 className="text-xl font-bold text-yellow-300 mb-4">What to send</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-white/80">
                    <div>✅ Full Name</div>
                    <div>✅ Date of Birth</div>
                    <div>✅ Exact Time of Birth</div>
                    <div>✅ Place of Birth</div>
                    <div>✅ Main Question</div>
                    <div>✅ Payment confirmation</div>
                  </div>
                </div>

                <p className="text-xs text-white/50 text-center mt-6">
                  Pluto Astro is currently available as a direct personal consultation service.
                </p>
              </div>
            </div>
          ) : (
            <>
              <h3 className="text-center text-2xl font-bold mb-6">
                {mode === "ai"
                  ? "Welcome to PlutoSpeaks! 👋"
                  : activeFriend
                  ? `Private chat with ${activeFriend}`
                  : "Friend Chat: login and enter friend email"}
              </h3>

              <div className="flex-1 min-h-[300px] overflow-y-auto px-2 md:px-6 pb-6 space-y-4 rounded-2xl">
                {activeMessages.map((msg, index) => {
                  const isMine =
                    mode === "friend"
                      ? msg.sender_email?.toLowerCase() === user?.email?.toLowerCase()
                      : msg.sender_email === "you";

                  return (
                    <div
                      key={msg.id || index}
                      className={`max-w-[90%] md:max-w-[78%] rounded-2xl px-4 md:px-6 py-3 md:py-4 shadow-lg ${
                        isMine ? "ml-auto bg-cyan-300 text-white" : "mr-auto bg-black/55 text-white"
                      }`}
                    >
                      <div className="text-xs opacity-80 mb-1">
                        {msg.sender_email} {timeText(msg.created_at) && `• ${timeText(msg.created_at)}`}
                      </div>
                      <div className="font-semibold whitespace-pre-wrap">{msg.content}</div>
                    </div>
                  );
                })}

                {loading && (
                  <div className="max-w-[70%] bg-black/55 rounded-2xl px-6 py-4">
                    ⚠️ Pluto is thinking too hard right now...
                  </div>
                )}

                <div ref={bottomRef} />
              </div>

              <div className="border-t border-white/10 pt-4 flex gap-2 md:gap-4">
                <input
                  className="flex-1 px-5 py-4 rounded-xl bg-black/60 outline-none"
                  placeholder={
                    mode === "ai"
                      ? "Ask PlutoSpeaks anything..."
                      : activeFriend
                      ? "Message your friend..."
                      : "Enter friend email first..."
                  }
                  value={mode === "ai" ? aiInput : friendInput}
                  disabled={mode === "friend" && !activeFriend}
                  onChange={(e) =>
                    mode === "ai" ? setAiInput(e.target.value) : setFriendInput(e.target.value)
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      mode === "ai" ? sendAIMessage() : sendFriendMessage();
                    }
                  }}
                />

                <button
                  onClick={mode === "ai" ? sendAIMessage : sendFriendMessage}
                  className="w-14 md:w-20 rounded-xl bg-cyan-300 text-2xl md:text-3xl"
                >
                  🚀
                </button>
              </div>
            </>
          )}

          <div className="pointer-events-none absolute top-4 left-6 text-sm font-semibold tracking-widest text-white/40 glow-kunal">
            Kunal ✨
          </div>
        </section>
      </div>
    </main>
  );
}
