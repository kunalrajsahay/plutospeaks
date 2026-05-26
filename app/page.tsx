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

type Mode = "ai" | "friend" | "astro";

type AstroPlanet = {
  name: string;
  short: string;
  colorClass: string;
  sign: string;
  signNumber: number;
  house: number;
  degree: number;
  retrograde?: boolean;
  exalted?: boolean;
  debilitated?: boolean;
};

type AstroChart = {
  ascendant: string;
  ascendantNumber: number;
  moonSign: string;
  moonSignNumber: number;
  sunSign: string;
  sunSignNumber: number;
  planets: AstroPlanet[];
  summary: string;
};

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [mode, setMode] = useState<Mode>("ai");
  const [friendEmail, setFriendEmail] = useState("");
  const [activeFriend, setActiveFriend] = useState("");

  const [aiInput, setAiInput] = useState("");
  const [friendInput, setFriendInput] = useState("");
  const [astroInput, setAstroInput] = useState("");

  const [aiMessages, setAiMessages] = useState<Msg[]>([]);
  const [friendMessages, setFriendMessages] = useState<Msg[]>([]);
  const [astroMessages, setAstroMessages] = useState<Msg[]>([
    {
      sender_email: "Pluto Astro",
      content:
        "Namaste ✨ I am Pluto Astro. Add your birth details, then ask about career, relationship, finance, health, marriage, timing, or spiritual guidance.",
      created_at: new Date().toISOString(),
    },
  ]);

  const [astroName, setAstroName] = useState("");
  const [astroDob, setAstroDob] = useState("");
  const [astroTime, setAstroTime] = useState("");
  const [astroPlace, setAstroPlace] = useState("");
  const [astroChart, setAstroChart] = useState<AstroChart | null>(null);
  const [astroChartTab, setAstroChartTab] = useState<"lagna" | "navamsha" | "moon">("lagna");

  const [inbox, setInbox] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

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

      const savedAstro = localStorage.getItem("plutospeaks_astro_profile");
      if (savedAstro) {
        try {
          const parsed = JSON.parse(savedAstro);
          setAstroName(parsed.name || "");
          setAstroDob(parsed.dob || "");
          setAstroTime(parsed.time || "");
          setAstroPlace(parsed.place || "");
          setAstroChart(buildAstroChart({
            name: parsed.name || "",
            dob: parsed.dob || "",
            time: parsed.time || "",
            place: parsed.place || "",
          }));
        } catch {
          // ignore invalid local storage
        }
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
  };

  const signs = [
    "Aries",
    "Taurus",
    "Gemini",
    "Cancer",
    "Leo",
    "Virgo",
    "Libra",
    "Scorpio",
    "Sagittarius",
    "Capricorn",
    "Aquarius",
    "Pisces",
  ];

  const planets = [
    { name: "Sun", short: "Su", colorClass: "text-red-400" },
    { name: "Moon", short: "Mo", colorClass: "text-red-300" },
    { name: "Mars", short: "Ma", colorClass: "text-green-300" },
    { name: "Mercury", short: "Me", colorClass: "text-blue-300" },
    { name: "Jupiter", short: "Ju", colorClass: "text-purple-300" },
    { name: "Venus", short: "Ve", colorClass: "text-green-200" },
    { name: "Saturn", short: "Sa", colorClass: "text-orange-300" },
    { name: "Rahu", short: "Ra", colorClass: "text-red-300" },
    { name: "Ketu", short: "Ke", colorClass: "text-yellow-300" },
  ];

  const stableHash = (value: string) => {
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) {
      hash = (hash * 31 + value.charCodeAt(i)) % 360000;
    }
    return hash;
  };

  const buildAstroChart = (profile: { name: string; dob: string; time: string; place: string }): AstroChart => {
    const seed = stableHash(`${profile.name}|${profile.dob}|${profile.time}|${profile.place}`);

    // MVP Vedic/Kundli style generation: this creates a North Indian chart layout
    // with sign numbers and planet placements. For exact Jyotish calculations,
    // later connect a backend ephemeris/API.
    const ascIndex = seed % 12;

    const chartPlanets = planets.map((planet, index) => {
      const siderealDegree = (seed + index * 37 + planet.name.length * 11 + 336) % 360;
      const signIndex = Math.floor(siderealDegree / 30) % 12;
      const signNumber = signIndex + 1;
      const house = ((signIndex - ascIndex + 12) % 12) + 1;

      return {
        ...planet,
        degree: siderealDegree % 30,
        sign: signs[signIndex],
        signNumber,
        house,
        retrograde: ["Mercury", "Saturn", "Rahu", "Ketu"].includes(planet.name) && (seed + index) % 2 === 0,
        exalted: (seed + index) % 17 === 0,
        debilitated: (seed + index) % 19 === 0,
      };
    });

    const sun = chartPlanets.find((p) => p.name === "Sun");
    const moon = chartPlanets.find((p) => p.name === "Moon");

    return {
      ascendant: signs[ascIndex],
      ascendantNumber: ascIndex + 1,
      sunSign: sun?.sign || signs[0],
      sunSignNumber: sun?.signNumber || 1,
      moonSign: moon?.sign || signs[0],
      moonSignNumber: moon?.signNumber || 1,
      planets: chartPlanets,
      summary: `Lagna ${ascIndex + 1} (${signs[ascIndex]}), Moon Rashi ${moon?.signNumber || "-"} (${moon?.sign || "-"}), Sun Rashi ${sun?.signNumber || "-"} (${sun?.sign || "-"}). This is a North Indian Vedic/Kundli-style MVP chart display.`,
    };
  };

  const getDisplayedChart = () => {
    if (!astroChart) return null;

    if (astroChartTab === "moon") {
      const moonOffset = astroChart.moonSignNumber - astroChart.ascendantNumber;
      return {
        ...astroChart,
        ascendant: astroChart.moonSign,
        ascendantNumber: astroChart.moonSignNumber,
        planets: astroChart.planets.map((p) => ({
          ...p,
          house: ((p.signNumber - astroChart.moonSignNumber + 12) % 12) + 1,
        })),
        summary: `Moon chart using ${astroChart.moonSignNumber} (${astroChart.moonSign}) as the reference sign.`,
      };
    }

    if (astroChartTab === "navamsha") {
      return {
        ...astroChart,
        ascendantNumber: ((astroChart.ascendantNumber + 8 - 1) % 12) + 1,
        ascendant: signs[((astroChart.ascendantNumber + 8 - 1) % 12)],
        planets: astroChart.planets.map((p, index) => {
          const navSignNumber = ((p.signNumber + index + 2 - 1) % 12) + 1;
          return {
            ...p,
            signNumber: navSignNumber,
            sign: signs[navSignNumber - 1],
            house: ((navSignNumber - (((astroChart.ascendantNumber + 8 - 1) % 12) + 1) + 12) % 12) + 1,
          };
        }),
        summary: "Navamsha D9-style divisional chart preview for MVP display.",
      };
    }

    return astroChart;
  };

  const planetsForHouse = (house: number) => {
    const chart = getDisplayedChart();
    return chart?.planets.filter((p) => p.house === house) || [];
  };

  const signForHouse = (house: number) => {
    const chart = getDisplayedChart();
    if (!chart) return "";
    return ((chart.ascendantNumber + house - 2) % 12) + 1;
  };

  const renderKundliCell = (house: number, className: string, extra?: string) => {
    const chart = getDisplayedChart();
    if (!chart) return null;

    const isLagna = house === 1;
    const housePlanets = planetsForHouse(house);

    return (
      <div className={`absolute ${className} ${extra || ""}`}>
        <div className="text-[11px] md:text-sm text-white/70 font-bold">{signForHouse(house)}</div>
        {isLagna && (
          <div className="text-[10px] md:text-xs text-yellow-300 leading-tight">
            La<br />{chart.ascendantNumber}
          </div>
        )}
        <div className="mt-1 space-y-0.5 leading-none">
          {housePlanets.map((p) => (
            <div key={`${p.name}-${house}`} className={`text-[11px] md:text-sm font-bold ${p.colorClass}`}>
              <span className="text-[9px] align-top mr-1">{Math.round(p.degree).toString().padStart(2, "0")}</span>
              {p.short}{p.retrograde ? "*" : ""}{p.exalted ? "↑" : ""}{p.debilitated ? "↓" : ""}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const saveAstroProfile = () => {
    const profile = {
      name: astroName.trim(),
      dob: astroDob,
      time: astroTime,
      place: astroPlace.trim(),
    };

    localStorage.setItem("plutospeaks_astro_profile", JSON.stringify(profile));
    const chart = buildAstroChart(profile);
    setAstroChart(chart);

    setAstroMessages((prev) => [
      ...prev,
      {
        sender_email: "Pluto Astro",
        content: `Birth details saved ✨\nName: ${profile.name || "Not given"}\nDOB: ${
          profile.dob || "Not given"
        }\nTime: ${profile.time || "Not given"}\nPlace: ${profile.place || "Not given"}\n\nNow ask your astrology question.`,
        created_at: new Date().toISOString(),
      },
    ]);

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

  const loadInbox = async () => {
    if (!user?.email) return;

    const myEmail = user.email.toLowerCase();

    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .or(`sender_email.eq.${myEmail},receiver_email.eq.${myEmail}`)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Inbox error:", error);
      return;
    }

    const grouped: Record<string, Msg & { unread_count?: number }> = {};

    data?.forEach((msg: Msg) => {
      const senderEmail = msg.sender_email?.toLowerCase() || "";
      const receiverEmail = msg.receiver_email?.toLowerCase() || "";
      const otherUser = senderEmail === myEmail ? receiverEmail : senderEmail;

      if (!otherUser) return;

      if (!grouped[otherUser]) {
        grouped[otherUser] = { ...msg, unread_count: 0 };
      }

      if (receiverEmail === myEmail && senderEmail === otherUser && msg.is_read === false) {
        grouped[otherUser].unread_count = (grouped[otherUser].unread_count || 0) + 1;
      }
    });

    setInbox(Object.values(grouped));
  };

  const markMessagesAsRead = async (friend: string) => {
    if (!user?.email || !friend) return;

    const myEmail = user.email.toLowerCase();
    const otherEmail = friend.toLowerCase();

    const { error } = await supabase
      .from("messages")
      .update({ is_read: true })
      .eq("sender_email", otherEmail)
      .eq("receiver_email", myEmail)
      .eq("is_read", false);

    if (error) {
      console.error("Mark read error:", error);
    }
  };

  const loadFriendMessages = async (friend = activeFriend) => {
    if (!user?.email || !friend) return;

    const myEmail = user.email.toLowerCase();
    const otherEmail = friend.toLowerCase();

    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .or(
        `and(sender_email.eq.${myEmail},receiver_email.eq.${otherEmail}),and(sender_email.eq.${otherEmail},receiver_email.eq.${myEmail})`
      )
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Load messages error:", error);
      return;
    }

    setFriendMessages(data || []);
    scrollBottom();
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
          const myEmail = user.email?.toLowerCase();
          const currentFriend = activeFriend.toLowerCase();

          const isForMe = msg.sender_email === myEmail || msg.receiver_email === myEmail;

          if (isForMe) {
            await loadInbox();
          }

          const belongsToOpenChat =
            currentFriend &&
            ((msg.sender_email === myEmail && msg.receiver_email === currentFriend) ||
              (msg.sender_email === currentFriend && msg.receiver_email === myEmail));

          if (belongsToOpenChat) {
            setFriendMessages((prev) => {
              if (msg.id && prev.some((m) => m.id === msg.id)) return prev;
              return [...prev, msg];
            });

            if (msg.receiver_email === myEmail) {
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

  const sendAstroMessage = async () => {
    if (!astroInput.trim()) return;

    const question = astroInput.trim();

    const userMsg: Msg = {
      content: question,
      sender_email: "you",
      created_at: new Date().toISOString(),
    };

    setAstroMessages((prev) => [...prev, userMsg]);
    setAstroInput("");
    setLoading(true);
    scrollBottom();

    const astroPrompt = `
You are Pluto Astro, a warm Indian astrology-style assistant inside PlutoSpeaks.
Use the user's birth details only for reflective, spiritual, and entertainment guidance.
Do not claim certainty. Do not make medical, legal, or financial guarantees.
Give practical guidance, positive remedies, and clear next steps.

Birth details:
Name: ${astroName || "Not provided"}
Date of Birth: ${astroDob || "Not provided"}
Time of Birth: ${astroTime || "Not provided"}
Place of Birth: ${astroPlace || "Not provided"}
Generated chart details:
Ascendant: ${astroChart?.ascendant || "Not generated"}
Moon Sign: ${astroChart?.moonSign || "Not generated"}
Sun Sign: ${astroChart?.sunSign || "Not generated"}
Planet Positions: ${astroChart?.planets.map((p) => `${p.name} in Rashi ${p.signNumber} (${p.sign}), House ${p.house}`).join("; ") || "Not generated"}

User question:
${question}
`;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: astroPrompt }),
      });

      const data = await res.json();

      setAstroMessages((prev) => [
        ...prev,
        {
          content: data.reply || "✨ Pluto Astro is checking the stars. Please try again.",
          sender_email: "Pluto Astro",
          created_at: new Date().toISOString(),
        },
      ]);
    } catch {
      setAstroMessages((prev) => [
        ...prev,
        {
          content: "✨ Pluto Astro is checking the stars. Please try again.",
          sender_email: "Pluto Astro",
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
    const myEmail = user?.email?.toLowerCase();
    const senderEmail = chat.sender_email?.toLowerCase() || "";
    const receiverEmail = chat.receiver_email?.toLowerCase() || "";

    return senderEmail === myEmail ? receiverEmail : senderEmail;
  };

  const getActiveMessages = () => {
    if (mode === "ai") return aiMessages;
    if (mode === "astro") return astroMessages;
    return friendMessages;
  };

  const activeMessages = getActiveMessages();

  const inputValue = mode === "ai" ? aiInput : mode === "astro" ? astroInput : friendInput;

  const inputPlaceholder =
    mode === "ai"
      ? "Ask PlutoSpeaks anything..."
      : mode === "astro"
      ? "Ask Pluto Astro about career, marriage, finance, health, timing..."
      : activeFriend
      ? "Message your friend..."
      : "Enter friend email first...";

  const handleInputChange = (value: string) => {
    if (mode === "ai") setAiInput(value);
    else if (mode === "astro") setAstroInput(value);
    else setFriendInput(value);
  };

  const handleSend = () => {
    if (mode === "ai") sendAIMessage();
    else if (mode === "astro") sendAstroMessage();
    else sendFriendMessage();
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#070816] via-[#29115f] to-[#001f7a] text-white overflow-hidden">
      <div className="flex flex-col md:flex-row min-h-screen">
        <aside className="w-full md:w-[310px] bg-black/45 border-r border-white/10 p-4 md:p-7 flex flex-col max-h-[45vh] md:max-h-none overflow-y-auto">
          <div className="rounded-2xl overflow-hidden shadow-[0_0_30px_rgba(0,255,255,0.25)] mb-5 md:mb-7">
            <img
              src="/pluto.png"
              alt="PlutoSpeaks"
              className="w-full h-[120px] md:h-[210px] object-contain p-2"
            />
          </div>

          <h1 className="text-3xl md:text-4xl font-extrabold text-yellow-300 mb-3">PlutoSpeaks</h1>
          <p className="text-center text-white/80 mb-5 md:mb-8">
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

                <div className="space-y-3 overflow-y-auto max-h-[220px] md:max-h-[265px] pr-1">
                  {inbox.length === 0 ? (
                    <div className="text-sm text-white/50 bg-white/5 rounded-xl p-4">
                      No chats yet. Enter a friend email and send your first message.
                    </div>
                  ) : (
                    inbox.map((chat, index) => {
                      const otherUser = getOtherUser(chat);
                      const unreadCount = (chat as any).unread_count || 0;
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
            <h2 className="text-2xl md:text-3xl font-bold">🪐 PlutoSpeaks</h2>

            <div className="flex gap-2 md:gap-4 w-full md:w-auto overflow-x-auto pb-1">
              <button
                onClick={() => setMode("ai")}
                className={`flex-1 md:flex-none px-4 md:px-8 py-3 md:py-4 rounded-2xl font-bold whitespace-nowrap ${
                  mode === "ai" ? "bg-cyan-400" : "bg-purple-700/60"
                }`}
              >
                🤖 AI Chat
              </button>

              <button
                onClick={() => setMode("friend")}
                className={`flex-1 md:flex-none px-4 md:px-8 py-3 md:py-4 rounded-2xl font-bold whitespace-nowrap ${
                  mode === "friend" ? "bg-purple-600" : "bg-purple-700/60"
                }`}
              >
                👥 Friend Chat
              </button>

              <button
                onClick={() => setMode("astro")}
                className={`flex-1 md:flex-none px-4 md:px-8 py-3 md:py-4 rounded-2xl font-bold whitespace-nowrap ${
                  mode === "astro" ? "bg-yellow-400 text-black" : "bg-purple-700/60"
                }`}
              >
                ✨ Pluto Astro
              </button>
            </div>
          </header>

          <h3 className="text-center text-xl md:text-2xl font-bold mb-4 md:mb-6">
            {mode === "ai"
              ? "Welcome to PlutoSpeaks! 👋"
              : mode === "astro"
              ? "Pluto Astro ✨ Personal Kundali Reading"
              : activeFriend
              ? `Private chat with ${activeFriend}`
              : "Friend Chat: login and enter friend email"}
          </h3>

          {mode === "astro" && (
            <div className="flex-1 overflow-y-auto px-1 md:px-4 pb-6">
              <div className="max-w-6xl mx-auto bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border border-yellow-400/30 rounded-3xl p-5 md:p-8 shadow-xl">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
                  <div>
                    <h2 className="text-2xl md:text-4xl font-extrabold text-yellow-300 mb-4">
                      🔮 Personal Astrology Reading by Kunal
                    </h2>
                    <p className="text-white/85 text-base md:text-xl leading-relaxed max-w-4xl">
                      Ask your personal astrology question directly to Kunal Raj. Career, marriage, finance,
                      business, foreign settlement, mahadasha, dosha, health guidance and life direction.
                    </p>
                  </div>

                  <div className="bg-black/35 rounded-3xl px-8 py-6 min-w-[180px] text-center border border-yellow-300/20 shadow-lg">
                    <div className="text-sm text-white/60">Reading Fee</div>
                    <div className="text-5xl font-extrabold text-yellow-300">₹50</div>
                    <div className="text-sm text-white/50">Only</div>
                  </div>
                </div>

                <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-5">
                  <a
                    href="mailto:kunalraj5@gmail.com?subject=Pluto%20Astro%20Consultation%20Request&body=Namaste%20Kunal,%0A%0AI%20want%20a%20Pluto%20Astro%20reading.%0A%0AName:%0ADate%20of%20Birth:%0ATime%20of%20Birth:%0APlace%20of%20Birth:%0AQuestion:%0A%0AReading%20Fee:%20Rs%2050"
                    className="flex items-center justify-center w-full min-h-[110px] text-center rounded-3xl bg-gradient-to-r from-yellow-400 to-orange-500 text-black font-extrabold text-2xl hover:scale-[1.02] transition"
                  >
                    ✨ Ask Kunal Directly
                  </a>

                  <div className="rounded-3xl bg-black/25 border border-white/10 p-6 text-white/75">
                    <div className="font-bold text-white text-xl mb-3">Contact</div>
                    <div className="break-words text-lg">kunalraj5@gmail.com</div>
                    <div className="text-sm text-white/50 mt-4 leading-relaxed">
                      Users can email their birth details and astrology question after paying the ₹50 reading fee.
                    </div>
                  </div>
                </div>

                <div className="mt-6 rounded-2xl bg-black/20 border border-white/10 p-4 text-sm md:text-base text-white/60">
                  Send your name, date of birth, birth time, birth place and one clear question for the reading.
                </div>
              </div>
            </div>
          )}

          {mode !== "astro" && (
          <div className="flex-1 min-h-[300px] overflow-y-auto px-2 md:px-6 pb-6 space-y-4 rounded-2xl">
            {activeMessages.map((msg, index) => {
              const isMine =
                mode === "friend"
                  ? msg.sender_email === user?.email?.toLowerCase()
                  : msg.sender_email === "you";

              return (
                <div
                  key={msg.id || index}
                  className={`max-w-[90%] md:max-w-[78%] rounded-2xl px-4 md:px-6 py-3 md:py-4 shadow-lg ${
                    isMine
                      ? "ml-auto bg-cyan-300 text-white"
                      : mode === "astro"
                      ? "mr-auto bg-yellow-400/15 border border-yellow-300/20 text-white"
                      : "mr-auto bg-black/55 text-white"
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
              <div className="max-w-[90%] md:max-w-[70%] bg-black/55 rounded-2xl px-6 py-4">
                {mode === "astro"
                  ? "✨ Pluto Astro is reading the cosmic pattern..."
                  : "⚠️ Pluto is thinking too hard right now..."}
              </div>
            )}

            <div ref={bottomRef} />
          </div>
          )}

          {mode !== "astro" && (
          <div className="border-t border-white/10 pt-4 flex gap-2 md:gap-4">
            <input
              className="flex-1 px-4 md:px-5 py-4 rounded-xl bg-black/60 outline-none"
              placeholder={inputPlaceholder}
              value={inputValue}
              disabled={mode === "friend" && !activeFriend}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSend();
              }}
            />

            <button
              onClick={handleSend}
              className="w-14 md:w-20 rounded-xl bg-cyan-300 text-2xl md:text-3xl"
            >
              🚀
            </button>
            <div className="pointer-events-none absolute top-4 left-6 text-sm font-semibold tracking-widest text-white/40 glow-kunal">
              Kunal ✨
            </div>
          </div>
          )}
        </section>
      </div>
    </main>
  );
}
