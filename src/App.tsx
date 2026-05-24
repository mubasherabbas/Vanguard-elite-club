import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import { 
  TrendingUp, 
  TrendingDown, 
  Search, 
  RefreshCw, 
  Bell, 
  BellOff, 
  Copy, 
  Check, 
  Clock, 
  Target, 
  ShieldCheck, 
  Activity, 
  Volume2, 
  ChevronDown, 
  ChevronUp, 
  Coins, 
  TrendingUp as StatusUp,
  Award,
  ArrowRight,
  Info,
  Lock,
  Upload,
  Wallet,
  CreditCard,
  QrCode
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Signal, MarketStats } from "./types";

// Standard map for TradingView embed
const SYMBOL_TV_MAP: Record<string, string> = {
  "BTC": "BINANCE:BTCUSDT",
  "ETH": "BINANCE:ETHUSDT",
  "BNB": "BINANCE:BNBUSDT",
  "SOL": "BINANCE:SOLUSDT",
  "XRP": "BINANCE:XRPUSDT",
  "DOGE": "BINANCE:DOGEUSDT",
  "ADA": "BINANCE:ADAUSDT",
  "AVAX": "BINANCE:AVAXUSDT",
  "LINK": "BINANCE:LINKUSDT",
  "DOT": "BINANCE:DOTUSDT"
};

// Custom sound alert engine using Web Audio API
function playSignalChime(type: "LONG" | "SHORT" | "update") {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (!audioCtx) return;

    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    if (type === "LONG") {
      // Ascending dual chime
      osc.type = "sine";
      osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
      osc.frequency.exponentialRampToValueAtTime(880.00, audioCtx.currentTime + 0.25); // A5
      gainNode.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.005, audioCtx.currentTime + 0.35);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.35);
    } else if (type === "SHORT") {
      // Descending alarm chime
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(349.23, audioCtx.currentTime + 0.25); // F4
      gainNode.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.005, audioCtx.currentTime + 0.35);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.35);
    } else {
      // Suttle tick for signal status changes
      osc.type = "triangle";
      osc.frequency.setValueAtTime(440.00, audioCtx.currentTime); // A4
      gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.005, audioCtx.currentTime + 0.15);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    }
  } catch (e) {
    console.warn("Web Audio chime blocked until interaction: ", e);
  }
}

export default function App() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [stats, setStats] = useState<MarketStats>({
    totalSignals: 0,
    winRate: 94,
    activeSignalsCount: 0,
    avgConfidence: 87,
    lastScanTime: new Date().toISOString()
  });

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "HIT" | "SL">("ALL");
  const [sizeFilter, setSizeFilter] = useState<"ALL" | "LONG" | "SHORT">("ALL");
  const [expandedSignal, setExpandedSignal] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [margins, setMargins] = useState<Record<string, number>>({});
  const [leverages, setLeverages] = useState<Record<string, number>>({});
  const [currentTime, setCurrentTime] = useState("");
  const [activeTab, setActiveTab] = useState<"SIGNALS" | "PORTFOLIO" | "TUTORIAL" | "VIP_PLAN">("SIGNALS");
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentTab, setPaymentTab] = useState<'crypto' | 'bank'>('crypto');
  const [selectedCoin, setSelectedCoin] = useState('USDT (TRC-20)');
  const [copiedAddressField, setCopiedAddressField] = useState(false);
  const [txDetails, setTxDetails] = useState('');
  const [receiptUploadProgress, setReceiptUploadProgress] = useState<number | null>(null);
  const [receiptFileName, setReceiptFileName] = useState('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('50');
  const [subscriptionOwner, setSubscriptionOwner] = useState("Premium Account");

  // Authentication & 3-Day Trial Simulation States
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [sessionUsername, setSessionUsername] = useState<string>(() => localStorage.getItem("crypto_pro_username") || "");

  // Synchronize currentUser with localStorage to guarantee robust persistent state
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem("crypto_pro_profile", JSON.stringify(currentUser));
    } else {
      localStorage.removeItem("crypto_pro_profile");
    }
  }, [currentUser]);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [authMode, setAuthMode] = useState<"LOGIN" | "REGISTER">("REGISTER");
  const [authForm, setAuthForm] = useState({ username: "", password: "" });
  const [authError, setAuthError] = useState("");

  const [copyingSignalId, setCopyingSignalId] = useState<string | null>(null);
  const [closingTradeId, setClosingTradeId] = useState<string | null>(null);
  const [portfolioStatus, setPortfolioStatus] = useState<{ type: "success" | "error" | null; message: string }>({ type: null, message: "" });
  const [trialTimeRemaining, setTrialTimeRemaining] = useState("");

  // Native Push & In-App Toast States
  const [notificationGranted, setNotificationGranted] = useState<boolean>(() => {
    return typeof window !== "undefined" && "Notification" in window ? Notification.permission === "granted" : false;
  });

  interface InAppToast {
    id: string;
    title: string;
    message: string;
    type: "success" | "warn" | "info";
  }
  const [toasts, setToasts] = useState<InAppToast[]>([]);

  const showInAppToast = (title: string, message: string, type: "success" | "warn" | "info" = "info") => {
    const newId = `toast_${Date.now()}_${Math.random()}`;
    const newToast: InAppToast = { id: newId, title, message, type };
    setToasts(prev => [newToast, ...prev]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== newId));
    }, 6000);
  };

  const handleToggleNotifications = async () => {
    if (!("Notification" in window)) {
      alert("This browser does not support push notifications.");
      return;
    }
    if (Notification.permission === "granted") {
      alert("Browser push notifications are already fully enabled for this application!");
      setNotificationGranted(true);
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      setNotificationGranted(true);
      new Notification("⚡ Notifications Enabled!", {
        body: "You will now receive high-confidence live signal alerts and target TP hits instantly on your mobile or desktop device!",
        icon: "/favicon.ico"
      });
      showInAppToast("⚡ Notifications Enabled", "You will now receive live alerts on your device!", "success");
    } else {
      setNotificationGranted(false);
      alert("To receive push alerts when new trades hit TP/SL, please configure your browser URL settings to allow notifications.");
    }
  };

  // Load user profile from server whenever session changes
  useEffect(() => {
    if (!sessionUsername) {
      setCurrentUser(null);
      return;
    }

    // Load from localStorage immediately to guarantee no blink of zero trade state or empty history
    const cachedProfileRaw = localStorage.getItem("crypto_pro_profile");
    if (cachedProfileRaw) {
      try {
        const parsed = JSON.parse(cachedProfileRaw);
        if (parsed && parsed.username && parsed.username.toLowerCase() === sessionUsername.toLowerCase()) {
          setCurrentUser(parsed);
        }
      } catch (e) {
        console.warn("Could not parse cached profile", e);
      }
    }

    const fetchProfile = async () => {
      try {
        const res = await fetch(`/api/user/profile?username=${encodeURIComponent(sessionUsername)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            setCurrentUser(data.profile);
          } else {
            await attemptProfileRestoreOrClear();
          }
        } else {
          await attemptProfileRestoreOrClear();
        }
      } catch (err) {
        console.error("Error syncing profile on load:", err);
      }
    };

    const attemptProfileRestoreOrClear = async () => {
      const savedPass = localStorage.getItem("crypto_pro_password") || "123456";
      const cachedProfile = localStorage.getItem("crypto_pro_profile");
      if (cachedProfile) {
        try {
          const profileData = JSON.parse(cachedProfile);
          console.log("🌐 Auto restoring account in background on the server...");
          const syncRes = await fetch("/api/user/sync-profile", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              username: sessionUsername,
              password: savedPass,
              profile: profileData
            })
          });
          if (syncRes.ok) {
            const syncData = await syncRes.json();
            if (syncData.success) {
              setCurrentUser(syncData.profile);
              return;
            }
          }
        } catch (err) {
          console.error("Failed to restore profile in background", err);
        }
      }

      // Fallback clean logout if profile is truly non-restorable
      localStorage.removeItem("crypto_pro_username");
      localStorage.removeItem("crypto_pro_password");
      localStorage.removeItem("crypto_pro_profile");
      setSessionUsername("");
      setCurrentUser(null);
    };

    fetchProfile();
  }, [sessionUsername]);

  // Hook into socket.io live updates for specific user-specific trade closures and balance updates
  useEffect(() => {
    if (!sessionUsername) return;
    const socket = io();
    const channel = `user-${sessionUsername.toLowerCase()}-updated`;
    
    socket.on(channel, (data: any) => {
      setCurrentUser(prev => {
        if (!prev) return null;
        return {
          ...prev,
          simulatedBalance: data.simulatedBalance,
          copiedTrades: data.copiedTrades
        };
      });
      if (soundEnabled) {
        playSignalChime("update");
      }
    });

    return () => {
      socket.off(channel);
      socket.disconnect();
    };
  }, [sessionUsername, soundEnabled]);

  // Live timer ticker tracking the 3-day premium trial countdown exactly to the second
  useEffect(() => {
    if (!currentUser || currentUser.subscriptionLevel !== "Trial") {
      setTrialTimeRemaining("");
      return;
    }
    const updateCountdown = () => {
      const expiry = new Date(currentUser.trialExpiresAt).getTime();
      const now = new Date().getTime();
      const diff = expiry - now;

      if (diff <= 0) {
        setTrialTimeRemaining("EXPIRED");
      } else {
        const bd = Math.floor(diff / (1000 * 60 * 60 * 24));
        const bh = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const bm = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const bs = Math.floor((diff % (1000 * 60)) / 1000);
        setTrialTimeRemaining(`${bd}d ${bh}h ${bm}m ${bs}s`);
      }
    };

    updateCountdown();
    const clock = setInterval(updateCountdown, 1000);
    return () => clearInterval(clock);
  }, [currentUser]);

  // Format tracking clocks (GMT+5 Pakistan Standard Time)
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleString("en-PK", { 
        timeZone: "Asia/Karachi",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true
      }) + " PKT");
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Connect socket.io and load bootstrap datasets
  useEffect(() => {
    // Standard initialization
    const socket: Socket = io();

    socket.on("initial-data", (data: { signals: Signal[]; stats: MarketStats }) => {
      setSignals(data.signals);
      setStats(data.stats);
    });

    socket.on("new-signal", (freshSig: Signal) => {
      setSignals(prev => {
        if (prev.some(s => s.id === freshSig.id)) return prev;
        return [freshSig, ...prev];
      });
      if (soundEnabled) {
        playSignalChime(freshSig.direction);
      }

      // Trigger Web Push Notification if permission is granted
      if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
        new Notification(`🚨 NEW LIVE SIGNAL: ${freshSig.symbol} ${freshSig.direction}`, {
          body: `💡 ${freshSig.action === "BUY" ? "Long Breakout" : "Short Rejection"} entered @ Entry $${freshSig.entry}\n🎯 TP1: $${freshSig.takeProfit1} | TP2: $${freshSig.takeProfit2}\n🛡️ Stop Loss: $${freshSig.stopLoss}\n(Expert Confidence: ${freshSig.aiConfidence || 88}% - ${freshSig.aiStatus || "EXPERT APPROVED"})`,
          icon: "/favicon.ico"
        });
      }

      // Show in-app custom toast overlay
      showInAppToast(
        `🚨 New Signal: ${freshSig.symbol} (${freshSig.direction})`,
        `Entered ${freshSig.action} position at $${freshSig.entry}. Auto-copy trailing active!`,
        freshSig.direction === "LONG" ? "success" : "warn"
      );
    });

    socket.on("signal-update", (updatedSig: Signal) => {
      setSignals(prev => prev.map(s => s.id === updatedSig.id ? updatedSig : s));
      if (soundEnabled) {
        playSignalChime("update");
      }
    });

    socket.on("copied-trade-auto-alert", (data: any) => {
      if (sessionUsername && data.username.toLowerCase() === sessionUsername.toLowerCase()) {
        if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
          new Notification(`🤖 Trial Auto-Copy Activated! ✨`, {
            body: `Automatically copied ${data.symbol} ${data.direction} position with $${data.margin} USDT margin @ ${data.leverage}x leverage!`,
            icon: "/favicon.ico"
          });
        }
        showInAppToast(
          "🤖 Trial Auto-Copy Activated",
          `Automatically copied ${data.symbol} ${data.direction} position with $${data.margin} USDT margin @ ${data.leverage}x leverage.`,
          "info"
        );
      }
    });

    socket.on("copied-trade-hit-alert", (data: any) => {
      if (sessionUsername && data.username.toLowerCase() === sessionUsername.toLowerCase()) {
        const isProfit = data.status.startsWith("TP");
        const titleText = isProfit ? `🎯 Target Hit: ${data.status}! 🚀` : `🛡️ Safety Hit: ${data.status}`;
        const bodyText = isProfit 
          ? `Profit of +${data.pnl}% made on ${data.symbol}! Added +$${data.payout} USDT to your Trial Wallet.`
          : `Loss of ${data.pnl}% incurred on ${data.symbol}. Margin adjusted by -$${Math.abs(data.payout)} USDT.`;

        if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
          new Notification(titleText, {
            body: `${data.symbol} ${data.direction}: ${bodyText}\nNew Balance: $${data.balance.toLocaleString()} USDT`,
            icon: "/favicon.ico"
          });
        }

        if (soundEnabled) {
          playSignalChime(isProfit ? "LONG" : "SHORT");
        }

        showInAppToast(
          titleText,
          `${data.symbol} (${data.direction}): ${bodyText}`,
          isProfit ? "success" : "warn"
        );
      }
    });

    socket.on("stats-update", (newStats: MarketStats) => {
      setStats(newStats);
    });

    return () => {
      socket.disconnect();
    };
  }, [soundEnabled, sessionUsername]);

  // Handle on-demand system scans
  const handleScan = async () => {
    if (isScanning) return;
    setIsScanning(true);
    try {
      const response = await fetch("/api/scan", { method: "POST" });
      const data = await response.json();
      if (data.success) {
        setSignals(data.signals);
        setStats(data.stats);
        if (soundEnabled) playSignalChime("update");
      }
    } catch (err) {
      console.error("Manual scanning execution error:", err);
    } finally {
      setIsScanning(false);
    }
  };

  // Quick clipboard logic for exchange terminal pasting
  const executeCopy = (sig: Signal) => {
    const message = `⚡ VANGUARD ELITE CLUB:\n🔸 Pair: ${sig.pair}\n📈 Direction: ${sig.direction} (${sig.action})\n💵 Entry Target: ${sig.entry}\n🎯 TP-1 Target: ${sig.takeProfit1}\n🎯 TP-2 Target: ${sig.takeProfit2}\n🛡️ Stop Loss: ${sig.stopLoss}\n⏰ Triggered At: ${sig.timeIn}`;
    navigator.clipboard.writeText(message);
    setCopiedId(sig.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // User Authentication Logic and Persistence Strategy

  const handleAuthSubmit = async (e: any) => {
    e.preventDefault();
    if (!authForm.username || !authForm.password) {
      setAuthError("Please fill out all credentials.");
      return;
    }
    setAuthError("");
    setIsAuthLoading(true);

    const url = authMode === "LOGIN" ? "/api/auth/login" : "/api/auth/register";
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(authForm)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        localStorage.setItem("crypto_pro_username", data.profile.username);
        localStorage.setItem("crypto_pro_password", authForm.password);
        localStorage.setItem("crypto_pro_profile", JSON.stringify(data.profile));
        setSessionUsername(data.profile.username);
        setCurrentUser(data.profile);
        // Clear forms
        setAuthForm({ username: "", password: "" });
      } else {
        setAuthError(data.error || "Authentication failed.");
      }
    } catch (err: any) {
      setAuthError(`Connection error: ${err.message}`);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("crypto_pro_username");
    localStorage.removeItem("crypto_pro_password");
    localStorage.removeItem("crypto_pro_profile");
    setSessionUsername("");
    setCurrentUser(null);
  };

  const handleCopySignal = async (signalId: string) => {
    if (!sessionUsername) {
      setActiveTab("PORTFOLIO"); // open tab to trigger auth redirect
      return;
    }
    const margin = margins[signalId] || 500;
    const leverage = leverages[signalId] || 5;

    setCopyingSignalId(signalId);
    setPortfolioStatus({ type: null, message: "" });
    try {
      const res = await fetch("/api/user/copy-trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: sessionUsername, signalId, margin, leverage })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPortfolioStatus({ type: "success", message: data.message });
        setCurrentUser(prev => {
          if (!prev) return null;
          return {
            ...prev,
            copiedTrades: data.copiedTrades,
            simulatedBalance: data.simulatedBalance
          };
        });
        if (soundEnabled) playSignalChime("LONG");
      } else {
        setPortfolioStatus({ type: "error", message: data.error });
      }
    } catch (err: any) {
      setPortfolioStatus({ type: "error", message: `Connection error: ${err.message}` });
    } finally {
      setCopyingSignalId(null);
      // clear status message after 4s
      setTimeout(() => setPortfolioStatus({ type: null, message: "" }), 4000);
    }
  };

  const handleCloseTrade = async (tradeId: string) => {
    setClosingTradeId(tradeId);
    setPortfolioStatus({ type: null, message: "" });
    try {
      const res = await fetch("/api/user/close-trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: sessionUsername, tradeId })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPortfolioStatus({ type: "success", message: data.message });
        setCurrentUser(prev => {
          if (!prev) return null;
          return {
            ...prev,
            copiedTrades: data.copiedTrades,
            simulatedBalance: data.simulatedBalance
          };
        });
        if (soundEnabled) playSignalChime("SHORT");
      } else {
        setPortfolioStatus({ type: "error", message: data.error });
      }
    } catch (err: any) {
      setPortfolioStatus({ type: "error", message: `Connection error: ${err.message}` });
    } finally {
      setClosingTradeId(null);
      setTimeout(() => setPortfolioStatus({ type: null, message: "" }), 4000);
    }
  };

  const handleResetBalance = async () => {
    if (!window.confirm("Are you sure you want to completely reset your portfolio simulation and balance back to $10,000 USDT?")) return;
    try {
      const res = await fetch("/api/user/reset-balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: sessionUsername })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPortfolioStatus({ type: "success", message: "Portfolio successfully reset!" });
        setCurrentUser(prev => prev ? { ...prev, simulatedBalance: data.simulatedBalance, copiedTrades: [] } : null);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setTimeout(() => setPortfolioStatus({ type: null, message: "" }), 4000);
    }
  };

  const handleUpgradeMock = async () => {
    try {
      const res = await fetch("/api/user/upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: sessionUsername })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCurrentUser(prev => prev ? { ...prev, subscriptionLevel: data.subscriptionLevel, trialExpiresAt: data.trialExpiresAt } : null);
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  // Filter signals list based on state conditions
  const filteredSignals = signals.filter(sig => {
    const matchSearch = sig.pair.toLowerCase().includes(search.toLowerCase());
    
    let matchStatus = true;
    if (statusFilter === "ACTIVE") {
      matchStatus = sig.status === "ACTIVE";
    } else if (statusFilter === "HIT") {
      matchStatus = sig.status === "TP1 HIT" || sig.status === "TP2 HIT";
    } else if (statusFilter === "SL") {
      matchStatus = sig.status === "SL HIT";
    }

    let matchSize = true;
    if (sizeFilter === "LONG") {
      matchSize = sig.direction === "LONG";
    } else if (sizeFilter === "SHORT") {
      matchSize = sig.direction === "SHORT";
    }

    return matchSearch && matchStatus && matchSize;
  });

  // Highlight ticker list corresponding to tracked tokens
  const activeTickers: Array<{ symbol: string; price: number; direction: string; pnl: number }> = [];
  const trackedSymbols = new Set<string>();
  for (const s of signals) {
    if (!trackedSymbols.has(s.symbol)) {
      trackedSymbols.add(s.symbol);
      activeTickers.push({
        symbol: s.symbol,
        price: s.currentPrice,
        direction: s.direction,
        pnl: s.pnl || 0
      });
    }
    if (activeTickers.length >= 5) break;
  }

  return (
    <div className="min-h-screen bg-[#05070a] text-[#e2e8f0] font-sans antialiased text-sm">
      
      {/* Real-time Ticker Mini Bar */}
      <div className="bg-[#080d1a] border-b border-white/[0.04] py-2 px-4 select-none overflow-hidden hidden sm:block">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-yellow-500 font-mono font-medium">
            <Coins className="w-3.5 h-3.5 animate-spin text-yellow-400" />
            <span>BINANCE SPOT SPOTLIGHT Tickers (UTC+5 PKT) :</span>
          </div>
          <div className="flex gap-6 overflow-hidden">
            {activeTickers.map(t => (
              <div key={t.symbol} className="flex items-center gap-2 text-xs font-mono">
                <span className="text-slate-400">{t.symbol}/USDT</span>
                <span className="text-slate-100 font-semibold">${t.price}</span>
                <span className={`flex items-center text-[10px] ${t.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {t.pnl >= 0 ? '▲' : '▼'} {t.pnl ? `${t.pnl.toFixed(1)}%` : '0%'}
                </span>
              </div>
            ))}
          </div>
          <div className="text-xs text-slate-400 font-mono flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span>{currentTime}</span>
          </div>
        </div>
      </div>

      {/* Main Premium Outer Container */}
      <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8 lg:px-8">
        
        {/* Masthead Header Panel */}
        <header className="flex flex-col md:flex-row items-center justify-between gap-6 mb-8 pb-6 border-b border-white/[0.05]">
          <div className="text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-3.5 mb-2">
              <div className="w-10 h-10 bg-gradient-to-br from-[#f0b90b] to-[#ff8c42] rounded-[10px] flex items-center justify-center font-extrabold text-black text-xl shadow-lg shadow-yellow-500/10">
                ⚡
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight font-display bg-gradient-to-r from-white via-[#94a3b8] to-[#f0b90b] bg-clip-text text-transparent">
                VANGUARD ELITE CLUB
              </h1>
            </div>
            <p className="text-[#64748b] text-xs sm:text-sm">
              Exclusive Futures Trading Circle driven by decadal human market intelligence and veteran desk research. Unlocks elite high-winrate entry confirmations crafted carefully for disciplined portfolio capital preservation.
            </p>
          </div>

          <div className="flex flex-col md:flex-row items-center gap-4">
            {currentUser ? (
              <div className="flex items-center gap-3.5 bg-yellow-500/5 border border-yellow-500/10 rounded-2xl p-3">
                <div className="text-right">
                  <div className="text-xs text-[#64748b]">Logged in as: <span className="font-bold text-slate-100 font-mono">{currentUser.username}</span></div>
                  <div className="flex items-center gap-1.5 justify-end mt-0.5">
                    {currentUser.subscriptionLevel === "Trial" ? (
                      <span className="text-[10px] bg-amber-500/10 border border-amber-500/20 text-[#f0b90b] px-2 py-0.5 rounded-full font-bold animate-pulse font-mono">
                        Trial Countdown: {trialTimeRemaining}
                      </span>
                    ) : (
                      <span className="text-[10px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                        👑 Lifetime VIP Premium
                      </span>
                    )}
                  </div>
                </div>

                <div className="bg-[#05070a]/60 px-3 py-1.5 rounded-xl border border-white/[0.04]">
                  <div className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">SIMULATED BAL</div>
                  <div className="text-sm font-extrabold text-[#f0b90b] font-mono">
                    ${currentUser.simulatedBalance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  {currentUser.subscriptionLevel === "Trial" && (
                    <button
                      onClick={() => setShowPaymentModal(true)}
                      className="text-[10px] uppercase font-mono font-black text-black bg-gradient-to-r from-yellow-400 via-[#f0b90b] to-yellow-500 hover:brightness-115 px-3 py-1.5 rounded-lg cursor-pointer transition-all text-center shadow-lg shadow-yellow-500/20"
                    >
                      👑 Buy VIP Pass
                    </button>
                  )}
                  <button
                    onClick={handleLogout}
                    className="text-[10px] text-slate-400 hover:text-rose-400 uppercase font-mono tracking-wider text-center cursor-pointer"
                  >
                    Logout
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setActiveTab("PORTFOLIO")}
                className="bg-yellow-500/10 border border-yellow-400/20 hover:bg-yellow-500/20 px-4 py-2 rounded-xl text-xs font-bold text-[#f0b90b] transition-all cursor-pointer animate-pulse"
              >
                🔐 Start 3-day VIP Trial
              </button>
            )}

            <div className="flex items-center gap-2">
              {/* Pakistan Live Scanner Badge */}
              <div className="bg-white/[0.05] border border-white/10 px-3 py-2 rounded-xl flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ef4444] opacity-75 shadow-[0_0_10px_#ef4444]"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#ef4444] shadow-[0_0_10px_#ef4444]"></span>
                </span>
                <span className="font-sans text-[10px] font-semibold text-[#e2e8f0] uppercase tracking-wider">
                  LIVE SCANNERS
                </span>
              </div>

              {/* Audio Toggle */}
              <button 
                onClick={() => {
                  setSoundEnabled(!soundEnabled);
                  playSignalChime("update");
                }}
                className={`p-2 rounded-xl border transition-all duration-200 cursor-pointer ${
                  soundEnabled 
                    ? 'bg-yellow-500/10 border-[#f0b90b]/20 text-[#f0b90b] hover:bg-yellow-500/20' 
                    : 'bg-slate-900 border-white/[0.05] text-[#64748b] hover:text-slate-400'
                }`}
                title={soundEnabled ? "Mute audio notification chimes" : "Enable sound chimes for signals"}
              >
                {soundEnabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
              </button>

              {/* Mobile/Browser Push Consent Toggle */}
              <button 
                onClick={handleToggleNotifications}
                className={`px-3 py-1.5 rounded-xl border transition-all duration-200 cursor-pointer flex items-center gap-2 h-9 ${
                  notificationGranted 
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 shadow-lg shadow-emerald-500/5' 
                    : 'bg-amber-500/10 border-[#f0b90b]/30 text-[#f0b90b] hover:bg-amber-500/20 animate-pulse'
                }`}
                title={notificationGranted ? "Browser push notifications are active on your mobile/desktop!" : "Enable browser push notifications to receive TP hits on your mobile!"}
              >
                <span className="relative flex h-1.5 w-1.5">
                  {notificationGranted ? (
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                  ) : (
                    <>
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500"></span>
                    </>
                  )}
                </span>
                <span className="text-[10px] font-bold tracking-wider font-display uppercase whitespace-nowrap">
                  {notificationGranted ? "🔔 Push ON" : "🔕 Enable Push"}
                </span>
              </button>

              {/* Manual scan button */}
              <button 
                onClick={handleScan}
                disabled={isScanning}
                className={`px-4 py-2 rounded-xl flex items-center gap-2 font-bold text-xs h-9 transition-all cursor-pointer ${
                  isScanning 
                    ? 'bg-slate-900 text-slate-500 border border-white/[0.05]' 
                    : 'bg-[#f0b90b] hover:brightness-110 active:scale-[0.98] text-black font-display font-bold'
                }`}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
                <span>{isScanning ? "Scanning..." : "Scan Market"}</span>
              </button>
            </div>
          </div>
        </header>

        {/* Bento Board Stats Deck */}
        <section className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          
          <div className="bg-[#151b2d]/60 border border-white/[0.05] p-5 rounded-[16px] flex flex-col justify-between">
            <span className="text-[#64748b] text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
              <Activity className="w-3.5 h-3.5 text-orange-400" />
              Total Signals
            </span>
            <div>
              <div className="text-[28px] font-bold font-mono text-[#f0b90b] leading-tight">{stats.totalSignals}</div>
              <p className="text-[11px] text-[#64748b] mt-1">Found in cached session</p>
            </div>
          </div>

          <div className="bg-[#151b2d]/60 border border-white/[0.05] p-5 rounded-[16px] flex flex-col justify-between">
            <span className="text-[#64748b] text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
              <Award className="w-3.5 h-3.5 text-yellow-400" />
              Win Rate
            </span>
            <div>
              <div className="text-[28px] font-bold font-mono text-[#f0b90b] leading-tight">{stats.winRate}%</div>
              <p className="text-[11px] text-[#64748b] mt-1">Historically calculated</p>
            </div>
          </div>

          <div className="bg-[#151b2d]/60 border border-white/[0.05] p-5 rounded-[16px] flex flex-col justify-between">
            <span className="text-[#64748b] text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
              <Target className="w-3.5 h-3.5 text-cyan-400" />
              Active Signals
            </span>
            <div>
              <div className="text-[28px] font-bold font-mono text-[#f0b90b] leading-tight">{stats.activeSignalsCount}</div>
              <p className="text-[11px] text-[#64748b] mt-1">Live exchange targets</p>
            </div>
          </div>

          <div className="bg-[#151b2d]/60 border border-white/[0.05] p-5 rounded-[16px] flex flex-col justify-between col-span-1">
            <span className="text-[#64748b] text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Avg Accuracy
            </span>
            <div>
              <div className="text-[28px] font-bold font-mono text-[#f0b90b] leading-tight">{stats.avgConfidence}%</div>
              <p className="text-[11px] text-[#64748b] mt-1">Model accuracy weight</p>
            </div>
          </div>

          <div className="bg-[#151b2d]/60 border border-white/[0.05] p-5 rounded-[16px] flex flex-col justify-between col-span-2 md:col-span-1">
            <span className="text-[#64748b] text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
              <Clock className="w-3.5 h-3.5 text-teal-400" />
              Last Scan Time
            </span>
            <div>
              <div className="text-sm font-semibold font-mono text-slate-300 truncate">
                {new Date(stats.lastScanTime).toLocaleTimeString("en-PK", { timeZone: "Asia/Karachi" })}
              </div>
              <p className="text-[11px] text-[#64748b] mt-1.5">Auto-updates every 2 minutes</p>
            </div>
          </div>

        </section>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap border-b border-white/[0.05] mb-6 gap-x-6 gap-y-2">
          <button
            onClick={() => setActiveTab("SIGNALS")}
            className={`pb-3 font-semibold text-sm transition-all relative cursor-pointer ${
              activeTab === "SIGNALS" ? 'text-[#f0b90b]' : 'text-[#64748b] hover:text-slate-300'
            }`}
          >
            Signals Feed
            {activeTab === "SIGNALS" && (
              <motion.div layoutId="activeTabUnderline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#f0b90b]" />
            )}
          </button>
          <button
            onClick={() => setActiveTab("PORTFOLIO")}
            className={`pb-3 font-semibold text-sm transition-all relative cursor-pointer ${
              activeTab === "PORTFOLIO" ? 'text-[#f0b90b]' : 'text-[#64748b] hover:text-slate-300'
            }`}
          >
            My Portfolio (Trial Terminal)
            {activeTab === "PORTFOLIO" && (
              <motion.div layoutId="activeTabUnderline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#f0b90b]" />
            )}
          </button>
          <button
            onClick={() => setActiveTab("TUTORIAL")}
            className={`pb-3 font-semibold text-sm transition-all relative cursor-pointer ${
              activeTab === "TUTORIAL" ? 'text-[#f0b90b]' : 'text-[#64748b] hover:text-slate-300'
            }`}
          >
            How it works & Strategy Guide
            {activeTab === "TUTORIAL" && (
              <motion.div layoutId="activeTabUnderline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#f0b90b]" />
            )}
          </button>
          <button
            onClick={() => setActiveTab("VIP_PLAN")}
            className={`pb-3 font-bold text-sm transition-all relative cursor-pointer flex items-center gap-1.5 ${
              activeTab === "VIP_PLAN" 
                ? 'text-[#f0b90b] drop-shadow-[0_0_8px_rgba(240,185,11,0.3)]' 
                : 'text-amber-400 hover:text-amber-300 border border-transparent hover:border-amber-500/10 px-2.5 rounded-lg -mt-1 bg-amber-500/5'
            }`}
          >
            <span>👑 BUY VIP PASS</span>
            <span className="bg-[#f0b90b] text-black text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase scale-90">
              Active
            </span>
            {activeTab === "VIP_PLAN" && (
              <motion.div layoutId="activeTabUnderline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#f0b90b]" />
            )}
          </button>
        </div>

        {activeTab === "SIGNALS" ? (
          <>
            {/* VIP Promo Alert Banner */}
            {currentUser && currentUser.subscriptionLevel === "Trial" && (
              <div className="bg-gradient-to-r from-amber-600/10 via-amber-500/15 to-yellow-600/15 border-2 border-[#f0b90b]/40 rounded-2xl p-4 mb-6 flex flex-col md:flex-row items-center justify-between gap-4 shadow-lg shadow-yellow-500/[0.03]">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-yellow-500/10 rounded-xl border border-yellow-500/20 text-[#f0b90b]">
                    <Lock className="w-5 h-5 animate-bounce" />
                  </div>
                  <div className="text-left font-sans">
                    <h4 className="text-sm font-black text-yellow-500 flex items-center gap-1.5 leading-normal">
                      ⚠️ 3-Day VIP Trial Limited Active
                    </h4>
                    <p className="text-slate-300 text-xs mt-0.5 leading-relaxed">
                      Trial package khatam (expire) hone par aap live status signals automatic copy nahi kar sakenge. Unlimited key functions ke liye premium select karein.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab("VIP_PLAN")}
                  className="bg-gradient-to-r from-yellow-400 to-[#f0b90b] hover:brightness-110 active:scale-95 text-black font-extrabold text-xs px-5 py-2.5 rounded-xl cursor-pointer shadow-md select-none flex items-center gap-1.5 transition-all w-full md:w-auto mt-2 md:mt-0 text-center justify-center whitespace-nowrap"
                >
                  👑 GOTO VIP PLAN PAGE
                </button>
              </div>
            )}
            {/* Filtering Control Bar */}
            <div className="bg-[#151b2d]/50 border border-white/[0.05] rounded-2xl p-4 mb-6 flex flex-col md:flex-row items-center justify-between gap-4">
              
              {/* Left Search input */}
              <div className="relative w-full md:w-80">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input 
                  type="text" 
                  placeholder="Query token symbol (e.g. BTC, ETH)..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-[#0d1527] border border-white/[0.06] rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-[#f0b90b]/50 text-slate-100 font-mono"
                />
              </div>

              {/* Status Filters */}
              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                <span className="text-xs text-[#64748b] font-medium mr-1 hidden lg:inline">Filters:</span>
                
                <div className="bg-[#0d1527] border border-white/[0.06] p-0.5 rounded-xl flex">
                  {(["ALL", "ACTIVE", "HIT", "SL"] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setStatusFilter(f)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase transition-all cursor-pointer ${
                        statusFilter === f 
                          ? 'bg-[#f0b90b]/15 text-[#f0b90b] font-bold' 
                          : 'text-slate-400 hover:text-slate-300'
                      }`}
                    >
                      {f === "ALL" ? "All Status" : f === "HIT" ? "TP Hit" : f}
                    </button>
                  ))}
                </div>

                <div className="bg-[#0d1527] border border-white/[0.06] p-0.5 rounded-xl flex">
                  {(["ALL", "LONG", "SHORT"] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setSizeFilter(f)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase transition-all cursor-pointer ${
                        sizeFilter === f 
                          ? 'bg-[#f0b90b]/15 text-[#f0b90b] font-bold' 
                          : 'text-slate-400 hover:text-slate-300'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

            </div>

            {/* Signals Content Stream */}
            <div className="space-y-4">
              <AnimatePresence mode="popLayout">
                {filteredSignals.length > 0 ? (
                  filteredSignals.map((sig, idx) => {
                    const isTrialExpired = currentUser?.subscriptionLevel === "Trial" && (trialTimeRemaining === "EXPIRED" || new Date(currentUser.trialExpiresAt).getTime() < Date.now());
                    const isLocked = isTrialExpired && idx >= 2;

                    if (isLocked) {
                      return (
                        <motion.div
                          key={sig.id}
                          layout
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          transition={{ duration: 0.25 }}
                          className="bg-gradient-to-br from-[#1b1c25]/50 to-[#0e0f16]/80 border border-yellow-500/10 rounded-[24px] overflow-hidden hover:border-yellow-500/20 transition-all cursor-pointer relative"
                          onClick={() => {
                            setShowPaymentModal(true);
                            showInAppToast("🔒 VIP Upgrade Portal", "Apna 3-Day VIP pass barqarar rakhne ke liye digital payment verify karein.", "info");
                          }}
                        >
                          <div className="absolute top-0 right-0 p-4">
                            <span className="px-2.5 py-0.5 rounded-full border border-yellow-500/30 text-[9px] font-black uppercase text-yellow-500 tracking-wider bg-yellow-500/10 flex items-center gap-1">
                              <Lock className="w-2.5 h-2.5" />
                              VIP Lock
                            </span>
                          </div>

                          <div className="p-6 flex flex-col md:flex-row items-center justify-between gap-5">
                            <div className="flex items-center gap-3">
                              <span className="p-2.5 bg-yellow-500/5 rounded-xl border border-yellow-500/10 inline-flex items-center opacity-60">
                                <Coins className="w-5 h-5 text-yellow-500/60" />
                              </span>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-lg font-extrabold tracking-tight text-slate-400 font-sans">{sig.symbol}</span>
                                  <span className="text-[10px] text-slate-500 font-mono bg-black/30 px-2 py-0.5 rounded border border-white/[0.03]">
                                    {sig.pair}
                                  </span>
                                </div>
                                <span className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5 font-mono">
                                  ⚡ Triggered: {sig.timeIn}
                                </span>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              <span className="px-3 py-1 bg-yellow-500/5 text-yellow-500/70 border border-yellow-500/10 rounded-lg text-xs font-bold uppercase">
                                VIP AI signal
                              </span>
                              <span className="text-yellow-500 font-mono text-xs font-bold px-2 py-1 bg-yellow-500/10 border border-yellow-500/20 rounded-md">
                                ⭐ 98.7% Accuracy Index
                              </span>
                            </div>

                            <button
                              type="button"
                              className="px-4 py-2 bg-[#f0b90b] text-black font-extrabold rounded-xl text-xs flex items-center gap-1.5 hover:brightness-110 active:scale-95 transition-all shadow-md shadow-yellow-500/10"
                            >
                              <Lock className="w-3.5 h-3.5" />
                              Unlock VIP Signal
                            </button>
                          </div>
                          
                          {/* Inner preview text */}
                          <div className="px-6 pb-5 border-t border-white/[0.02] pt-3.5 bg-black/10 flex items-center justify-between text-xs text-slate-500">
                            <span className="font-sans">
                              🎯 Entry, target levels & automatic copied position keys are hidden.
                            </span>
                            <span className="text-yellow-500 font-bold hover:underline flex items-center gap-1">
                              Pay Bank/Crypto ➔
                            </span>
                          </div>
                        </motion.div>
                      );
                    }

                    const isExpanded = expandedSignal === sig.id;
                    const isLong = sig.direction === "LONG";
                    
                    // Determine status badge classes
                    let statusColor = "bg-blue-500/10 text-blue-400 border-blue-500/20";
                    if (sig.status === "ACTIVE") statusColor = "bg-sky-500/10 text-sky-400 border-sky-400/25 animate-pulse";
                    else if (sig.status.includes("TP")) statusColor = "bg-emerald-500/10 text-emerald-400 border-emerald-500/25";
                    else if (sig.status === "SL HIT") statusColor = "bg-rose-500/10 text-rose-400 border-rose-500/25";

                    // Dynamic price marker calculations for slider visualizer
                    const deltaTotal = isLong ? (sig.takeProfit2 - sig.stopLoss) : (sig.stopLoss - sig.takeProfit2);
                    const currentOffset = isLong ? (sig.currentPrice - sig.stopLoss) : (sig.stopLoss - sig.currentPrice);
                    let progressPct = Math.min(100, Math.max(0, (currentOffset / (deltaTotal || 1)) * 100));

                    return (
                      <motion.div
                        key={sig.id}
                        layout
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.25 }}
                        className={`bg-gradient-to-br from-[#1e293b]/40 to-[#0f172a]/40 border rounded-[24px] overflow-hidden transition-all ${
                          isExpanded ? 'border-[#f0b90b]/40 shadow-xl shadow-yellow-500/[0.02]' : 'border-white/[0.08] hover:border-white/[0.15]'
                        }`}
                      >
                        {/* Core Card Heading Header row */}
                        <div 
                          onClick={() => setExpandedSignal(isExpanded ? null : sig.id)}
                          className="p-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 cursor-pointer select-none"
                        >
                          <div className="flex flex-wrap items-center gap-3">
                            <span className="p-2.5 bg-black/20 rounded-xl border border-white/[0.05] inline-flex items-center">
                              <Coins className="w-5 h-5 text-[#f0b90b]" />
                            </span>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xl font-extrabold tracking-tight text-white font-sans">{sig.symbol}</span>
                                <span className="text-[10px] text-slate-400 font-mono bg-black/30 px-2 py-0.5 rounded-md border border-white/[0.05]">
                                  {sig.pair}
                                </span>
                                {sig.aiStatus && (
                                  <span className="text-[8px] font-black text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 px-1.5 py-0.5 rounded uppercase flex items-center gap-0.5 tracking-wider font-mono">
                                    ⭐ EXPERT
                                  </span>
                                )}
                              </div>
                              <span className="text-xs text-[#64748b] flex items-center gap-1 mt-0.5">
                                <Clock className="w-3.5 h-3.5 text-slate-500" />
                                {sig.timeIn}
                              </span>
                            </div>
                          </div>

                          {/* Trigger Direction Badge */}
                          <div className="flex items-center gap-3.5">
                            <span className={`px-3 py-1.5 rounded-lg text-xs font-extrabold uppercase flex items-center gap-1.5 tracking-wide ${
                              isLong 
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' 
                                : 'bg-rose-500/15 text-rose-400 border border-rose-500/20'
                            }`}>
                              {isLong ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                              <span>{sig.direction}</span>
                            </span>

                            {/* Status and Profit Performance */}
                            <div className="flex flex-col items-end">
                              <span className={`px-2.5 py-0.5 rounded-full border text-[10px] font-bold uppercase ${statusColor}`}>
                                {sig.status}
                              </span>
                              {sig.pnl !== undefined && sig.pnl !== 0 && (
                                <span className={`text-xs font-bold font-mono mt-1 ${sig.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                  {sig.pnl >= 0 ? '+' : ''}{sig.pnl}%
                                </span>
                              )}
                            </div>

                            {/* Expansion bracket toggle */}
                            <span className="text-slate-500 bg-black/20 p-2 rounded-lg border border-white/[0.05]">
                              {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                            </span>
                          </div>
                        </div>

                        {/* Expandable Panel Breakdown */}
                        {isExpanded && (
                          <div className="border-t border-white/[0.04] bg-black/40 p-6 space-y-6">
                            
                             {/* Stats Target Layout Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                              {[
                                {
                                  label: "Enter Area",
                                  val: sig.entry,
                                  colorClass: "text-white",
                                  desc: "Wait for trigger entry"
                                },
                                {
                                  label: "Take Profit 1",
                                  val: sig.takeProfit1,
                                  colorClass: "text-emerald-400",
                                  desc: "Target 1 threshold"
                                },
                                {
                                  label: "Take Profit 2",
                                  val: sig.takeProfit2,
                                  colorClass: "text-teal-400",
                                  desc: "Target 2 threshold"
                                },
                                {
                                  label: "Stop Loss",
                                  val: sig.stopLoss,
                                  colorClass: "text-rose-400",
                                  desc: "Invalidation level"
                                }
                              ].map((card, idx) => (
                                <div key={idx} className="bg-black/20 border border-white/[0.05] rounded-xl p-4 flex flex-col justify-between">
                                  <span className={`text-xs font-semibold uppercase tracking-wider ${card.colorClass}`}>
                                    {card.label}
                                  </span>
                                  <div className="mt-1">
                                    <div className={`text-lg font-bold font-mono ${card.colorClass}`}>${card.val}</div>
                                    <span className="text-[10px] text-slate-500">{card.desc}</span>
                                  </div>
                                </div>
                              ))}
                            </div>

                            {/* Visual Target Range Silder Tracker */}
                            <div className="bg-black/20 border border-white/[0.05] rounded-xl p-4">
                              <div className="flex justify-between items-center mb-3">
                                <span className="text-xs text-slate-400 font-semibold flex items-center gap-1.5">
                                  <Target className="w-3.5 h-3.5 text-[#f0b90b]" />
                                  Live Target Visualizer Progress
                                </span>
                                <span className="text-xs font-mono font-bold text-slate-300 relative flex items-center gap-1.5">
                                  <span className={`w-1.5 h-1.5 rounded-full ${isLong ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500 animate-pulse'}`} />
                                  Live Price: ${sig.currentPrice}
                                </span>
                              </div>

                              {/* Target map bar */}
                              <div className="relative h-2 bg-[#12192e] rounded-full mx-1.5 mt-4 mb-2">
                                <div 
                                  className="absolute top-0 bottom-0 rounded-full transition-all duration-300 bg-gradient-to-r from-rose-500 via-[#f0b90b] to-[#4ade80]"
                                  style={{ left: '0%', right: `${100 - progressPct}%` }}
                                />
                                <div 
                                  className="absolute w-3.5 h-3.5 bg-white border-2 border-slate-950 rounded-full top-1/2 -translate-y-1/2 -translate-x-1/2 shadow-lg transition-all duration-300 z-10" 
                                  style={{ left: `${progressPct}%` }}
                                />
                              </div>

                              <div className="flex justify-between text-[11px] text-slate-500 font-mono pt-1">
                                <span className="text-rose-400 font-bold">🛡️ SL (${sig.stopLoss})</span>
                                <span className="text-[#f0b90b] font-bold">Entry (${sig.entry})</span>
                                <span className="text-slate-400">TP1 (${sig.takeProfit1})</span>
                                <span className="text-[#4ade80] font-bold">🎯 TP2 (${sig.takeProfit2})</span>
                              </div>
                            </div>

                            {/* Dual panel Grid (Metadata calculations + Copy instructions) */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                              
                              <div className="md:col-span-2 space-y-4">
                                <h4 className="text-xs text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                                  <Info className="w-3.5 h-3.5 text-[#64748b]" />
                                  Algorithmic Model Calculations
                                </h4>
                                
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                  <div className="bg-black/20 border border-white/[0.04] rounded-xl p-3">
                                    <div className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">RSI (14)</div>
                                    <div className="text-xs font-medium font-mono text-slate-200 mt-1">{sig.rsi}</div>
                                    <span className={`text-[10px] ${sig.rsi < 44 ? 'text-emerald-400' : sig.rsi > 56 ? 'text-rose-400' : 'text-slate-500'}`}>
                                      {sig.rsi < 44 ? 'Oversold' : sig.rsi > 56 ? 'Overbought' : 'Neutral'}
                                    </span>
                                  </div>

                                  <div className="bg-black/20 border border-white/[0.04] rounded-xl p-3">
                                    <div className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold font-sans">MACD Hist</div>
                                    <div className="text-xs font-medium font-mono text-slate-200 mt-1">{sig.histogram}</div>
                                    <span className={`text-[10px] ${sig.histogram > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                      {sig.histogram > 0 ? 'Bullish Force' : 'Bearish Force'}
                                    </span>
                                  </div>

                                  <div className="bg-black/20 border border-white/[0.04] rounded-xl p-3">
                                    <div className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold font-sans">Confidence</div>
                                    <div className="text-xs font-medium font-mono text-[#f0b90b] mt-1">{sig.confidence}%</div>
                                    <span className="text-[10px] text-slate-500">Weight priority</span>
                                  </div>

                                  <div className="bg-black/20 border border-white/[0.04] rounded-xl p-3">
                                    <div className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold font-sans font-sans">Vol. Surge</div>
                                    <div className="text-xs font-medium font-mono text-slate-200 mt-1">
                                      {sig.volumeSurge ? "Detected" : "Subdued"}
                                    </div>
                                    <span className={`text-[10px] ${sig.volumeSurge ? 'text-[#4ade80] font-bold' : 'text-slate-500'}`}>
                                      {sig.volumeSurge ? '▲ Critical Spike' : 'Average Flow'}
                                    </span>
                                  </div>
                                </div>

                                {/* Senior Traders Advisory Desk Panel */}
                                <div className="bg-[#0b1322]/40 border border-[#f0b90b]/15 rounded-xl p-4 relative overflow-hidden text-left">
                                  <div className="absolute top-0 right-0 w-32 h-32 bg-[#f0b90b]/[0.02] rounded-full blur-2xl pointer-events-none" />
                                  
                                  <div className="flex justify-between items-center mb-3">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-sm">🛡️</span>
                                      <span className="text-[10px] font-black uppercase tracking-wider text-[#f0b90b] font-sans">
                                        Senior Traders Advisory Consensus & Action
                                      </span>
                                    </div>
                                    <span className="px-1.5 py-0.5 rounded bg-yellow-500/10 border border-yellow-500/20 text-[#f0b90b] text-[8px] font-black tracking-wider uppercase font-mono">
                                      {sig.aiStatus || "EXPERT APPROVED"}
                                    </span>
                                  </div>

                                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5 items-center">
                                    <div className="sm:border-r border-white/[0.05] sm:pr-4">
                                      <div className="text-[8px] text-slate-400 uppercase tracking-widest font-bold mb-0.5">VETERAN CONFIDENCE INDEX</div>
                                      <div className="text-xl font-black font-mono text-emerald-400 tracking-tight">
                                        {sig.aiConfidence || 88}%
                                      </div>
                                    </div>
                                    <div className="sm:col-span-3">
                                      <div className="text-[8px] text-slate-400 uppercase tracking-widest font-bold mb-0.5">Senior Analyst Desk Review</div>
                                      <p className="text-[11px] text-slate-200 leading-relaxed font-sans italic">
                                        "{sig.aiAnalysis || 'Humne dynamic ranges and asset liquidations ko verify kiya hai. Momentum alignment positive direction trajectory par confirm ho chuki hai.'}"
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <div className="bg-black/20 border border-white/[0.04] rounded-xl p-4 flex flex-col justify-between">
                                <div>
                                  <h4 className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Execution Actions</h4>
                                  <p className="text-slate-500 text-[11px] leading-relaxed mb-3">
                                    Configure customized trial margin & leverage to execute this simulated position.
                                  </p>

                                  {/* Custom Parameter Selections */}
                                  {!currentUser?.copiedTrades?.some((t: any) => t.signalId === sig.id) && (
                                    <div className="space-y-4 mb-4 border-t border-white/[0.04] pt-3 text-left">
                                      {/* Margin Input */}
                                      <div>
                                        <div className="flex justify-between items-center mb-1">
                                          <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold font-sans">
                                            📊 Trial Margin Amount
                                          </span>
                                          <span className="text-[9px] text-[#f0b90b] font-mono font-bold">
                                            Bal: ${currentUser ? currentUser.simulatedBalance.toLocaleString("en-US", { maximumFractionDigits: 0 }) : "10,000"} USDT
                                          </span>
                                        </div>
                                        <div className="flex gap-1.5 align-middle">
                                          <div className="relative w-1/2">
                                            <input
                                              type="number"
                                              className="w-full bg-[#05070a] border border-white/[0.08] px-2 py-1.5 rounded-lg text-xs font-mono font-bold text-slate-100 focus:outline-none focus:border-[#f0b90b]/40 pr-8"
                                              min="10"
                                              max={currentUser ? currentUser.simulatedBalance : 10000}
                                              value={margins[sig.id] !== undefined ? margins[sig.id] : 500}
                                              onChange={(e) => {
                                                const maxBal = currentUser ? currentUser.simulatedBalance : 10000;
                                                const v = Math.max(10, Math.min(maxBal, Number(e.target.value)));
                                                setMargins(prev => ({ ...prev, [sig.id]: v }));
                                              }}
                                            />
                                            <span className="absolute right-2 top-2 text-[9px] font-bold text-slate-500 font-mono">USDT</span>
                                          </div>
                                          <div className="flex-1 flex gap-1">
                                            {[100, 500, 1000, 2000].map((preset) => (
                                              <button
                                                key={preset}
                                                type="button"
                                                onClick={() => {
                                                  const maxBal = currentUser ? currentUser.simulatedBalance : 10000;
                                                  const activeVal = preset > maxBal ? maxBal : preset;
                                                  setMargins(prev => ({ ...prev, [sig.id]: activeVal }));
                                                }}
                                                className={`flex-1 text-[9px] font-bold font-mono py-1 rounded transition-colors ${
                                                  (margins[sig.id] !== undefined ? margins[sig.id] : 500) === preset
                                                    ? 'bg-yellow-500/10 border border-yellow-500/20 text-[#f0b90b]'
                                                    : 'bg-stone-905 border border-white/[0.04] text-slate-400 hover:text-slate-200 hover:bg-stone-800'
                                                }`}
                                              >
                                                ${preset}
                                              </button>
                                            ))}
                                          </div>
                                        </div>
                                      </div>

                                      {/* Leverage Selection (1x to 5x) */}
                                      <div>
                                        <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold font-sans mb-1.5 flex justify-between">
                                          <span>⚖️ Leverage Selector</span>
                                          <span className="text-[#f0b90b] text-[10px] font-black">{(leverages[sig.id] !== undefined ? leverages[sig.id] : 5)}x Max</span>
                                        </div>
                                        <div className="grid grid-cols-5 gap-1">
                                          {[1, 2, 3, 4, 5].map((lev) => (
                                            <button
                                              key={lev}
                                              type="button"
                                              onClick={() => setLeverages(prev => ({ ...prev, [sig.id]: lev }))}
                                              className={`py-1.5 rounded text-center text-[10px] font-black font-mono transition-all ${
                                                (leverages[sig.id] !== undefined ? leverages[sig.id] : 5) === lev
                                                  ? 'bg-[#f0b90b] text-black shadow-lg shadow-yellow-500/10 font-black'
                                                  : 'bg-slate-950 border border-white/[0.04] text-slate-400 hover:text-slate-200 hover:bg-[#1a2034]'
                                              }`}
                                            >
                                              {lev}x
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                                <div className="space-y-2">
                                  <button
                                    onClick={() => handleCopySignal(sig.id)}
                                    disabled={currentUser?.copiedTrades?.some((t: any) => t.signalId === sig.id)}
                                    className={`w-full py-2.5 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold cursor-pointer transition-all ${
                                      currentUser?.copiedTrades?.some((t: any) => t.signalId === sig.id)
                                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 cursor-not-allowed'
                                        : 'bg-[#f0b90b] hover:brightness-110 border-transparent text-black active:scale-[0.98]'
                                    }`}
                                  >
                                    <Activity className="w-4 h-4 animate-pulse" />
                                    <span>
                                      {currentUser?.copiedTrades?.some((t: any) => t.signalId === sig.id)
                                        ? "Trade Active"
                                        : "⚡ Copy Trade to Trial"}
                                    </span>
                                  </button>

                                  <button
                                    onClick={() => executeCopy(sig)}
                                    className={`w-full py-2 rounded-xl border flex items-center justify-center gap-2 text-xs font-medium cursor-pointer transition-all ${
                                      copiedId === sig.id 
                                        ? 'bg-[#f0b90b]/15 border-[#f0b90b]/30 text-[#f0b90b]' 
                                        : 'bg-slate-900/60 hover:bg-slate-800 border-white/[0.05] text-slate-300'
                                    }`}
                                  >
                                    {copiedId === sig.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                    <span>{copiedId === sig.id ? "Copied Info!" : "Copy Signal Text"}</span>
                                  </button>
                                </div>
                              </div>

                            </div>

                            {/* Embedded high-fidelity Interactive Live TradingView Charts */}
                            <div className="space-y-3">
                              <h4 className="text-xs text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                                <Activity className="w-3.5 h-3.5 text-blue-400" />
                                Interactive Live Candlestick Analysis ({sig.symbol}/USDT)
                              </h4>
                              <iframe
                                title={`${sig.symbol} Real-time Technical Chart`}
                                src={`https://s.tradingview.com/widgetembed/?frameElementId=tradingview_chart&symbol=${SYMBOL_TV_MAP[sig.symbol] || `BINANCE:${sig.symbol}USDT`}&interval=15&hidesidetoolbar=1&symboledit=1&saveimage=0&toolbarbg=121624&studies=%5B%5D&theme=dark&style=1&timezone=Asia%2FKarachi&locale=en`}
                                className="w-full h-80 rounded-2xl border border-white/[0.04]"
                                style={{ border: "0" }}
                                referrerPolicy="no-referrer"
                              />
                            </div>

                          </div>
                        )}
                      </motion.div>
                    );
                  })
                ) : (
                  <div className="bg-gradient-to-br from-[#101625]/90 to-[#12182b]/95 border border-white/[0.06] p-12 rounded-3xl text-center relative overflow-hidden shadow-2xl">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-[1px] bg-gradient-to-r from-transparent via-[#f0b90b]/45 to-transparent"></div>
                    
                    <div className="relative mb-5 inline-flex">
                      <div className="absolute inset-0 bg-[#f0b90b]/10 rounded-full blur-xl animate-pulse"></div>
                      <div className="w-16 h-16 bg-[#f0b90b]/10 border border-[#f0b90b]/20 rounded-2xl flex items-center justify-center relative shadow-lg shadow-yellow-500/5">
                        <Activity className="w-8 h-8 text-[#f0b90b] animate-pulse" />
                      </div>
                    </div>
                    
                    {/* Urdu Notification Text */}
                    <div className="text-center space-y-3 max-w-xl mx-auto mb-6">
                      <p className="text-[#f0b90b] font-extrabold font-display leading-tight tracking-wide text-sm sm:text-base uppercase flex justify-center items-center gap-2">
                        <span>⚠️</span> مارکیٹ الرٹ: سگنل سچویشن فعال نہیں ہے
                      </p>
                      <p className="text-slate-200 text-sm font-semibold font-sans leading-relaxed">
                        مارکیٹ میں اس وقت کوئی مضبوط اور فلٹر شدہ سگنل دستیاب نہیں ہے۔ ہمارے الگورتھم انتہائی محتاط اور فلٹر شدہ سگنلز (80٪+ پرافٹ ریشو) تلاش کر رہے ہیں تاکہ نقصان کا کوئی چانس نہ ہو اور آپ کا سرمایہ سو فیصد محفوظ رہے۔
                      </p>
                    </div>

                    <div className="w-16 h-[1px] bg-white/[0.08] mx-auto my-4"></div>

                    {/* English Details */}
                    <div className="text-center space-y-2 max-w-md mx-auto">
                      <h4 className="text-white text-[11px] font-bold tracking-widest font-mono uppercase">
                        Algorithmic Momentum Scan In Progress
                      </h4>
                      <p className="text-slate-400 text-xs leading-relaxed">
                        No trade setups are matching our strict, high-winrate entry criteria at the moment. Please wait while our background scanners monitor the orderbooks. Alternatively, hit the <strong className="text-[#f0b90b] cursor-pointer hover:underline" onClick={handleScan}>Scan Market</strong> button to query Binance indicators immediately.
                      </p>
                    </div>

                    {/* Quick indicator lights */}
                    <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-[10px] font-mono text-slate-500">
                      <span className="flex items-center gap-1.5 bg-white/[0.02] border border-white/[0.04] px-3 py-1.5 rounded-full">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span>
                        SCANNERS ALIVE
                      </span>
                      <span className="flex items-center gap-1.5 bg-white/[0.02] border border-white/[0.04] px-3 py-1.5 rounded-full">
                        <span className="w-1.5 h-1.5 bg-[#f0b90b] rounded-full"></span>
                        30-40 DAILY SELECTION SETUP
                      </span>
                    </div>
                  </div>
                )}
              </AnimatePresence>
            </div>
          </>
        ) : activeTab === "PORTFOLIO" ? (
          /* Portfolio & Authentication management */
          currentUser === null ? (
            /* Authentication login / registration panel */
            <div className="max-w-md mx-auto bg-gradient-to-br from-[#151b2d]/80 to-[#0c1020]/80 border border-white/[0.08] rounded-[24px] p-6 sm:p-8 space-y-6 shadow-2xl">
              <div className="text-center space-y-2">
                <div className="inline-flex items-center gap-1.5 bg-[#f0b90b]/10 border border-[#f0b90b]/20 text-[#f0b90b] text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full animate-pulse">
                  🛡️ VIP Trial Pass
                </div>
                <h2 className="text-xl font-extrabold text-slate-100 font-sans tracking-tight">
                  {authMode === "REGISTER" ? "Claim Your 3-Day VIP Trial" : "Access Your VIP Terminal"}
                </h2>
                <p className="text-slate-400 text-xs leading-relaxed max-w-sm mx-auto">
                  Experience instant copy-trading simulation, live technical analysis indicators, and accuracy-focused results premium insights.
                </p>
              </div>

              {authError && (
                <div className="bg-rose-500/15 border border-rose-500/20 text-rose-400 rounded-xl p-3.5 text-xs font-medium flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-ping"></span>
                  <span>{authError}</span>
                </div>
              )}

              <form onSubmit={handleAuthSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Choose Username
                  </label>
                  <input 
                    type="text" 
                    required
                    placeholder="e.g. Satoshi_99"
                    value={authForm.username}
                    onChange={(e) => setAuthForm(prev => ({ ...prev, username: e.target.value }))}
                    className="w-full bg-[#0d1527] border border-white/[0.06] rounded-xl px-4 py-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-[#f0b90b]/50 transition-all font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Access Password
                  </label>
                  <input 
                    type="password" 
                    required
                    placeholder="••••••••"
                    value={authForm.password}
                    onChange={(e) => setAuthForm(prev => ({ ...prev, password: e.target.value }))}
                    className="w-full bg-[#0d1527] border border-white/[0.06] rounded-xl px-4 py-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-[#f0b90b]/50 transition-all font-mono"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isAuthLoading}
                  className="w-full py-3 bg-[#f0b90b] hover:brightness-110 active:scale-[0.99] hover:shadow-lg hover:shadow-yellow-500/5 text-black font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer disabled:opacity-50"
                >
                  {isAuthLoading ? "Processing credentials..." : authMode === "REGISTER" ? "Get Free VIP Access Now" : "Secure Log In"}
                </button>
              </form>

              <div className="border-t border-white/[0.04] pt-4 text-center">
                <button
                  onClick={() => {
                    setAuthMode(authMode === "LOGIN" ? "REGISTER" : "LOGIN");
                    setAuthError("");
                  }}
                  className="text-xs text-[#64748b] hover:text-slate-300 transition-colors font-medium cursor-pointer"
                >
                  {authMode === "REGISTER" ? "Already have a trial pass? Sign In" : "Don't have an account yet? Register Free"}
                </button>
              </div>

              <div className="bg-[#05070a]/40 p-4 rounded-xl border border-white/[0.02] flex items-start gap-3">
                <span className="text-yellow-400 text-sm">💡</span>
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  Your 3-day Trial gives you <b>$10,000 USDT practice capital</b>. Copy active alerts and see live gains tracked in real-time. Upgrades are available instantly!
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Portfolio Performance metrics */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                
                <div className="bg-gradient-to-br from-[#151b2d]/80 to-[#0c1020]/80 border border-white/[0.06] p-5 rounded-2xl">
                  <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 mb-1.5">
                    <Activity className="w-3.5 h-3.5 text-yellow-400" />
                    Simulated Balance
                  </span>
                  <div className="text-2xl font-black font-mono text-slate-100">
                    ${currentUser.simulatedBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </div>
                  <span className="text-[10px] text-slate-500 block mt-1">Starting capital: $10,000 USDT</span>
                </div>

                <div className="bg-gradient-to-br from-[#151b2d]/80 to-[#0c1020]/80 border border-white/[0.06] p-5 rounded-2xl">
                  <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 mb-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                    Open Positions
                  </span>
                  <div className="text-2xl font-black font-mono text-emerald-400">
                    {currentUser.copiedTrades?.filter((t: any) => t.status === "ACTIVE").length || 0} Trades
                  </div>
                  <span className="text-[10px] text-slate-500 block mt-1">Simulating in real-time</span>
                </div>

                <div className="bg-gradient-to-br from-[#151b2d]/80 to-[#0c1020]/80 border border-white/[0.06] p-5 rounded-2xl">
                  <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 mb-1.5">
                    <Award className="w-3.5 h-3.5 text-[#f0b90b]" />
                    Realized PnL Profit
                  </span>
                  <div className={`text-2xl font-black font-mono ${
                    (currentUser.copiedTrades?.filter((t: any) => t.status !== "ACTIVE").reduce((acc: number, item: any) => acc + item.pnl, 0) || 0) >= 0 
                      ? 'text-emerald-400' 
                      : 'text-rose-400'
                  }`}>
                    {(currentUser.copiedTrades?.filter((t: any) => t.status !== "ACTIVE").reduce((acc: number, item: any) => acc + item.pnl, 0) || 0).toFixed(2)}%
                  </div>
                  <span className="text-[10px] text-slate-500 block mt-1">Across all completed trades</span>
                </div>

                <div className="bg-gradient-to-br from-[#151b2d]/80 to-[#0c1020]/80 border border-white/[0.06] p-5 rounded-2xl flex flex-col justify-between">
                  <div>
                    <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest block mb-1">
                      Account Tier Pass
                    </span>
                    <div className="text-xs font-bold font-mono text-[#f0b90b]">
                      {currentUser.subscriptionLevel === "Trial" ? "🎁 3-DAY TRIAL LIMIT" : "👑 LIFETIME UNLIMITED VIP"}
                    </div>
                  </div>
                  <div className="mt-2 pt-2 border-t border-white/[0.04] flex items-center justify-between">
                    <button
                      onClick={handleResetBalance}
                      className="text-[10px] hover:text-rose-400 text-slate-400 transition-colors uppercase font-mono font-bold cursor-pointer"
                    >
                      Reset Sim Wallet
                    </button>
                    {currentUser.subscriptionLevel === "Trial" && (
                      <button
                        onClick={() => setShowPaymentModal(true)}
                        className="text-[10px] bg-yellow-500/10 hover:bg-yellow-500/20 text-[#f0b90b] px-2 py-0.5 rounded font-bold cursor-pointer transition-colors"
                      >
                        Buy VIP Upgrade
                      </button>
                    )}
                  </div>
                </div>

              </div>

              {portfolioStatus.message && (
                <div className={`p-4 rounded-xl border flex items-center gap-2.5 text-xs ${
                  portfolioStatus.type === "success" 
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" 
                    : "bg-rose-500/10 border-rose-500/30 text-rose-400"
                }`}>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-current"></span>
                  </span>
                  <span>{portfolioStatus.message}</span>
                </div>
              )}

              {/* ACTIVE POSITIONS SECTION */}
              <div className="bg-[#151b2d]/45 border border-white/[0.06] rounded-[24px] p-5">
                <div className="flex items-center justify-between pb-3.5 border-b border-white/[0.05] mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-200">Active Copied Positions</h3>
                    <p className="text-slate-500 text-[11px] mt-0.5 leading-relaxed">Trades currently executing. Live prices update every spot scanner pulse.</p>
                  </div>
                  <span className="text-[10px] font-bold bg-[#f0b90b]/10 text-[#f0b90b] px-2.5 py-1 rounded-full uppercase tracking-wider font-mono">
                    {currentUser.copiedTrades?.filter((t: any) => t.status === "ACTIVE").length || 0} Trades Running
                  </span>
                </div>

                {(!currentUser.copiedTrades || currentUser.copiedTrades.filter((t: any) => t.status === "ACTIVE").length === 0) ? (
                  <div className="py-12 text-center">
                    <TrendingUp className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                    <h4 className="text-xs text-slate-400 font-semibold">No active copy trades found</h4>
                    <p className="text-[11px] text-slate-500 max-w-sm mx-auto mt-1 leading-relaxed">
                      Visit the <b>Signals Feed</b> tab, open any active indicator card, and tap <b>⚡ Copy Trade to Trial</b> to start trailing gains in real-time.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-white/[0.03] text-slate-500 text-[10px] uppercase font-bold tracking-wider text-slate-400">
                          <th className="py-2.5">Market Token</th>
                          <th className="py-2.5">Position</th>
                          <th className="py-2.5">Entry Price</th>
                          <th className="py-2.5">Current Price</th>
                          <th className="py-2.5 text-center">Live Target SL/TP</th>
                          <th className="py-2.5 text-right">Running P&L Benefit</th>
                          <th className="py-2.5 text-right">Action Interface</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.02]">
                        {currentUser.copiedTrades.filter((t: any) => t.status === "ACTIVE").map((trade: any) => {
                          const isLong = trade.direction === "LONG";
                          // Calculate exact relative PNL percent based on live indicator pricing
                          const change = ((trade.currentPrice - trade.entryPrice) / trade.entryPrice) * 100;
                          const livePnl = isLong ? change : -change;
                          const leverage = trade.leverage || 5;
                          const margin = trade.margin || 500;
                          const leveragePnl = livePnl * leverage;
                          const usdtPnl = margin * (livePnl / 100) * leverage;
                          
                          return (
                            <tr key={trade.id} className="text-xs text-slate-200 hover:bg-white/[0.01]">
                              <td className="py-3 font-semibold font-mono text-[#f0b90b]">
                                <div>{trade.pair}</div>
                                <div className="text-[10px] text-slate-400 font-sans font-medium mt-0.5">
                                  Margin: <span className="text-white font-mono">${margin}</span> | Lev: <span className="text-yellow-400 font-mono">{leverage}x</span>
                                </div>
                              </td>
                              <td className="py-3 font-sans">
                                <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${isLong ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'}`}>
                                  {trade.direction}
                                </span>
                              </td>
                              <td className="py-3 font-mono">${trade.entryPrice}</td>
                              <td className="py-3 font-mono text-slate-100">${trade.currentPrice}</td>
                              <td className="py-3 text-center space-y-0.5 font-mono">
                                <div className="text-[10px] text-emerald-400">TP1: ${trade.takeProfit1} | TP2: ${trade.takeProfit2}</div>
                                <div className="text-[10px] text-rose-400 font-mono">SL: ${trade.stopLoss}</div>
                              </td>
                              <td className="py-3 text-right">
                                <span className={`font-mono font-bold block ${livePnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                  {livePnl >= 0 ? "+" : ""}{leveragePnl.toFixed(2)}%
                                </span>
                                <span className={`text-[10px] font-mono block mt-0.5 ${livePnl >= 0 ? "text-emerald-400/80" : "text-rose-400/80"}`}>
                                  {livePnl >= 0 ? "+" : ""}${usdtPnl.toFixed(2)} USDT
                                </span>
                              </td>
                              <td className="py-3 text-right">
                                <button
                                  onClick={() => handleCloseTrade(trade.id)}
                                  disabled={closingTradeId === trade.id}
                                  className="px-2.5 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-bold text-[10px] uppercase tracking-wider border border-rose-500/25 transition-all cursor-pointer disabled:opacity-50"
                                >
                                  {closingTradeId === trade.id ? "Closing..." : "Close Position"}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* CLOSED TRADES REGISTRY JOURNAL */}
              <div className="bg-[#151b2d]/45 border border-white/[0.06] rounded-[24px] p-5">
                <div className="pb-3.5 border-b border-white/[0.05] mb-4">
                  <h3 className="text-sm font-bold text-slate-200">Mock Trading Journal & Realized Log</h3>
                  <p className="text-slate-500 text-[11px] mt-0.5 leading-relaxed">Historically completed trades copied during your 3-day VIP trial.</p>
                </div>

                {(!currentUser.copiedTrades || currentUser.copiedTrades.filter((t: any) => t.status !== "ACTIVE").length === 0) ? (
                  <div className="py-8 text-center text-slate-500 text-xs">
                    No closed trades found in simulation journal. Close any open positions or wait for SL/TP price triggers.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-white/[0.03] text-slate-500 text-[10px] uppercase font-bold tracking-wider text-slate-400">
                          <th className="py-2">Contract</th>
                          <th className="py-2">Type</th>
                          <th className="py-2">Entry Price</th>
                          <th className="py-2">Close Price</th>
                          <th className="py-2">Final Outcome</th>
                          <th className="py-2 text-right">Realized PnL</th>
                          <th className="py-2 text-right">Closed At</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.02] font-mono text-[11px]">
                        {currentUser.copiedTrades.filter((t: any) => t.status !== "ACTIVE").map((trade: any) => {
                          const isWin = trade.pnl >= 0;
                          const leverage = trade.leverage || 5;
                          const margin = trade.margin || 500;
                          const leveragePnl = trade.pnl * leverage;
                          const usdtPnl = margin * (trade.pnl / 100) * leverage;
                          return (
                            <tr key={trade.id} className="text-slate-300 hover:bg-white/[0.01]">
                              <td className="py-2.5 text-slate-100 font-bold">
                                <div>{trade.pair}</div>
                                <div className="text-[10px] text-slate-500 font-sans font-normal mt-0.5">
                                  Margin: ${margin} | Lev: {leverage}x
                                </div>
                              </td>
                              <td className="py-2.5">
                                <span className={trade.direction === "LONG" ? "text-emerald-400" : "text-rose-400"}>
                                  {trade.direction}
                                </span>
                              </td>
                              <td className="py-2.5">${trade.entryPrice}</td>
                              <td className="py-2.5">${trade.closePrice || trade.currentPrice}</td>
                              <td className="py-2.5 font-bold">
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-sans ${
                                  trade.status === "TP1 HIT" || trade.status === "TP2 HIT" 
                                    ? "bg-emerald-500/10 text-emerald-400" 
                                    : trade.status === "SL HIT" 
                                    ? "bg-rose-500/10 text-rose-400" 
                                    : "bg-slate-500/10 text-slate-400"
                                }`}>
                                  {trade.status}
                                </span>
                              </td>
                              <td className="py-2.5 text-right font-bold">
                                <span className={`block ${isWin ? "text-emerald-400" : "text-rose-400"}`}>
                                  {isWin ? "+" : ""}{leveragePnl.toFixed(2)}%
                                </span>
                                <span className={`text-[10px] text-slate-400 block mt-0.5 ${isWin ? "text-emerald-400/80" : "text-rose-400/80"}`}>
                                  {isWin ? "+" : ""}${usdtPnl.toFixed(2)} USDT
                                </span>
                              </td>
                              <td className="py-2.5 text-right text-slate-500 text-[10px]">
                                {trade.closedAt ? new Date(trade.closedAt).toLocaleTimeString("en-PK", { timeZone: "Asia/Karachi" }) : "N/A"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )
        ) : activeTab === "TUTORIAL" ? (
          /* Strategy & Instruction Tutorial Tab */
          <div className="bg-gradient-to-br from-[#1e293b]/30 to-[#0f172a]/30 border border-white/[0.08] p-6 sm:p-8 rounded-[24px] space-y-6">
            <div>
              <h2 className="text-lg font-bold font-sans text-[#f0b90b] mb-2 flex items-center gap-2">
                <span>🛡️</span> Institutional Analyst Desk & Capital Protection Guide
              </h2>
              <p className="text-slate-400 text-xs leading-relaxed">
                Vanguard Elite Club represents a private strategic circle of veteran futures traders. Hum trading signals ke liye automated standard retail indicators ya robots par trust nahi karte. Every entry is manually processed and verified by our senior trading desk having 10+ years of active market experience, aiming for a highly precise and consistent 80%+ win-rate target:
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-black/20 p-4 rounded-xl border border-white/[0.04]">
                <h3 className="font-bold text-slate-200 flex items-center gap-1.5 mb-2">
                  <span className="w-2 h-2 rounded-full bg-[#f0b90b] inline-block"></span>
                  1. Experienced Curation
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Har signal hamare senior expert analysts ke thorough experience aur capital positioning filters se pass hota hai hum target precision preserve rakhte hain.
                </p>
              </div>

              <div className="bg-black/20 p-4 rounded-xl border border-white/[0.04]">
                <h3 className="font-bold text-slate-200 flex items-center gap-1.5 mb-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500 inline-block"></span>
                  2. Dynamic Range Check
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Market orders flow aur true support ranges ko carefully verify kiya jata hai taaki fakeouts aur retail traps se safe trade initiate ho.
                </p>
              </div>

              <div className="bg-black/20 p-4 rounded-xl border border-white/[0.04]">
                <h3 className="font-bold text-slate-200 flex items-center gap-1.5 mb-2">
                  <span className="w-2 h-2 rounded-full bg-cyan-500 inline-block"></span>
                  3. Pure Price Action
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Standard lagging indicators ko bypass karke hum pure market structure transitions use karte hain, jo entries ko extreme accuracy provide karti hain.
                </p>
              </div>

              <div className="bg-black/20 p-4 rounded-xl border border-white/[0.04]">
                <h3 className="font-bold text-slate-200 flex items-center gap-1.5 mb-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
                  4. Capital Protection
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Stop losses aur target entry levels are designed strictly corresponding to current market ranges, preventing unnecessary margin drawdowns.
                </p>
              </div>
            </div>

            <div className="bg-black/20 p-5 rounded-xl border border-white/[0.04] space-y-4">
              <h3 className="font-bold text-slate-100 font-sans">💡 Elite Risk Management Guidelines</h3>
              <ul className="space-y-2 text-slate-400 text-xs list-disc pl-5">
                <li>Vanguard Elite Club parameters confirm that placing corresponding trigger orders promptly on your Exchange is critical to secure maximum profit.</li>
                <li>Secure partial profits at <strong>Take Profit 1 (TP1)</strong> step. Shift your stop-loss boundary to your entry range (Breakeven) risk-free as soon as TP1 is accomplished.</li>
                <li>Risk dynamic parameters always show that keeping exposure below 1% to 2% of total capital margin maintains long-term portfolio growth.</li>
              </ul>
            </div>
            
            <div className="text-slate-500 text-[11px] text-center pt-2">
              ⚠️ <strong>Disclaimer</strong>: Cryptocurrencies and futures trading involve substantial market volatility. Our shared curated positions are backed by premium internal research and strategy analysis.
            </div>
          </div>
        ) : (
          /* VIP PLAN AND EXCLUSIVE PAYMENT VIEW */
          <div className="space-y-6">
            {!currentUser ? (
              <div className="max-w-md mx-auto text-center bg-[#151b2d]/60 border border-white/[0.08] p-8 rounded-[24px] space-y-4">
                <div className="w-14 h-14 bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 rounded-full flex items-center justify-center mx-auto mb-2 text-xl font-bold">
                  🔐
                </div>
                <h3 className="text-lg font-black tracking-tight text-white font-sans">
                  Account Registration Required
                </h3>
                <p className="text-slate-400 text-xs leading-relaxed">
                  VIP plans, payment addresses, and receipt upload ledger system ko dekhne ke liye pehle apna free account register ya log in karein.
                </p>
                <button
                  onClick={() => setActiveTab("PORTFOLIO")}
                  className="bg-gradient-to-r from-yellow-400 to-[#f0b90b] hover:brightness-110 text-black px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-150 shadow-lg shadow-yellow-500/10 cursor-pointer"
                >
                  Go to Portfolio to Login / Register ➔
                </button>
              </div>
            ) : currentUser.subscriptionLevel !== "Trial" ? (
              /* Already VIP */
              <div className="max-w-xl mx-auto bg-gradient-to-br from-[#121c2c]/80 to-[#0b101b]/95 border-2 border-yellow-500/30 rounded-[28px] p-6 sm:p-8 space-y-6 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-44 h-44 bg-yellow-500/5 rounded-full blur-3xl pointer-events-none" />
                
                <div className="text-center space-y-3">
                  <div className="inline-flex items-center gap-1.5 bg-yellow-500/15 border border-yellow-500/30 text-[#f0b90b] text-[11px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full animate-pulse shadow-md">
                    👑 VIP LIFETIME ACTIVE MEMBER
                  </div>
                  <h3 className="text-2xl font-black text-white tracking-tight font-sans">
                    Aapka VIP Level Active Hai!
                  </h3>
                  <p className="text-slate-300 text-xs max-w-sm mx-auto leading-relaxed">
                    Mubarak Ho! Aapka lifetime VIP profile status successfully upgraded aur synchronized hai. Ab aap unlimited 24/7 senior signals bina kisi limit ke copy aur trade kar sakte hain.
                  </p>
                </div>

                <div className="bg-black/35 rounded-2xl p-4 sm:p-5 border border-white/[0.05] space-y-3 font-mono text-xs">
                  <div className="flex justify-between border-b border-white/[0.03] pb-2 text-slate-400">
                    <span>Active Account Name:</span>
                    <span className="font-bold text-slate-100">{currentUser.username}</span>
                  </div>
                  <div className="flex justify-between border-b border-white/[0.03] pb-2 text-slate-400">
                    <span>VIP Member ID:</span>
                    <span className="font-bold text-yellow-500">VNG-{currentUser.username.toUpperCase()}-VIP</span>
                  </div>
                  <div className="flex justify-between border-b border-white/[0.03] pb-2 text-slate-400">
                    <span>Subscription Status:</span>
                    <span className="font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 text-[10px] uppercase">
                      LIFETIME INFINITE PASS
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Signal Accuracy Level:</span>
                    <span className="font-bold text-slate-100">98.7% Certified Pro Desk</span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setActiveTab("SIGNALS")}
                    className="flex-1 bg-[#f0b90b] hover:brightness-110 active:scale-95 text-black font-extrabold text-xs py-3 rounded-xl transition-all cursor-pointer text-center"
                  >
                    View Premium Signals Feed
                  </button>
                  <button
                    onClick={() => setActiveTab("PORTFOLIO")}
                    className="flex-1 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] text-slate-300 font-extrabold text-xs py-3 rounded-xl transition-all cursor-pointer text-center"
                  >
                    Manage Trades Portfolio
                  </button>
                </div>
              </div>
            ) : (
              /* Upgradable status */
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                
                {/* Left side: features list */}
                <div className="lg:col-span-5 bg-gradient-to-br from-[#101424] to-[#070b14] border border-white/[0.05] rounded-[24px] p-6 space-y-5 text-left">
                  <div>
                    <span className="px-2.5 py-0.5 bg-yellow-500/10 border border-yellow-500/20 text-[#f0b90b] text-[9px] font-black uppercase tracking-wider rounded-full">
                      Lifetime Unlock
                    </span>
                    <h3 className="text-lg font-black text-white mt-1.5 tracking-tight">
                      Vanguard VIP Elite Strategy
                    </h3>
                    <p className="text-slate-400 text-xs mt-1">
                      Professional financial operations and high-accuracy positions.
                    </p>
                  </div>

                  <div className="space-y-3.5 border-t border-white/[0.04] pt-4 text-xs text-slate-300 leading-normal">
                    <div className="flex items-start gap-2.5">
                      <span className="p-1 rounded-full bg-emerald-500/15 text-emerald-400 text-xs shrink-0 mt-0.5 font-bold">✓</span>
                      <div>
                        <strong className="text-slate-200">24/7 Live Crypto Signals</strong>
                        <p className="text-slate-500 text-[11px] mt-0.5">Bina kisi limit ke tamam active dynamic premium signals copy karein.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span className="p-1 rounded-full bg-emerald-500/15 text-emerald-400 text-xs shrink-0 mt-0.5 font-bold">✓</span>
                      <div>
                        <strong className="text-slate-200">Senior Analyst Curation</strong>
                        <p className="text-slate-500 text-[11px] mt-0.5">90% se zyada verified winrate wale senior veteran levels access karein.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span className="p-1 rounded-full bg-emerald-500/15 text-emerald-400 text-xs shrink-0 mt-0.5 font-bold">✓</span>
                      <div>
                        <strong className="text-slate-200">Automated Simulated Trading</strong>
                        <p className="text-slate-500 text-[11px] mt-0.5">Trial user copy limits remove ho jayen gi aur direct balance simulation active ho gi.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span className="p-1 rounded-full bg-emerald-500/15 text-emerald-400 text-xs shrink-0 mt-0.5 font-bold">✓</span>
                      <div>
                        <strong className="text-slate-200">Lifetime One-Time payment</strong>
                        <p className="text-slate-500 text-[11px] mt-0.5">Bina kisi monthly fees ke hamesha ke liye VIP signals free access karein.</p>
                      </div>
                    </div>
                  </div>

                  {/* Pricing Badge */}
                  <div className="bg-yellow-500/[0.03] border border-yellow-500/10 p-4 rounded-xl text-center space-y-1">
                    <span className="text-[10px] text-yellow-500 font-bold uppercase tracking-wider block">Special Lifetime Deal</span>
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="text-slate-500 line-through text-xs">$120 USDT</span>
                      <span className="text-xl font-extrabold text-white">$50 USDT</span>
                      <span className="text-xs text-slate-400">/ 14,000 PKR</span>
                    </div>
                    <p className="text-[10px] text-slate-500 italic">One time fee only - No monthly charges</p>
                  </div>
                </div>

                {/* Right side: payment form */}
                <div className="lg:col-span-7 bg-[#151b2d]/50 border border-white/[0.05] rounded-[24px] overflow-hidden flex flex-col">
                  
                  {/* Tab switches for Cryptocurrency vs Mobile Bank inside tab */}
                  <div className="flex gap-0.5 bg-black/20 p-1 border-b border-white/[0.04]">
                    <button
                      onClick={() => setPaymentTab('crypto')}
                      className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                        paymentTab === 'crypto'
                          ? 'bg-[#1e293b] text-yellow-500 border border-white/[0.05]'
                          : 'text-slate-400 hover:text-slate-300'
                      }`}
                    >
                      <Wallet className="w-4 h-4" />
                      Cryptocurrency USDT
                    </button>
                    <button
                      onClick={() => setPaymentTab('bank')}
                      className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                        paymentTab === 'bank'
                          ? 'bg-[#1e293b] text-yellow-500 border border-white/[0.05]'
                          : 'text-slate-400 hover:text-slate-300'
                      }`}
                    >
                      <CreditCard className="w-4 h-4" />
                      Local Bank / EasyPaisa
                    </button>
                  </div>

                  {/* Payment Info Display area */}
                  <div className="p-5 space-y-4">
                    {paymentTab === 'crypto' ? (
                      <div className="space-y-3.5 text-left">
                        {/* Selector grid */}
                        <div>
                          <label className="text-[10px] text-slate-400 uppercase tracking-wider font-bold block mb-1.5">
                            Deposit Coin (Select Network):
                          </label>
                          <div className="grid grid-cols-3 gap-2">
                            {['USDT (TRC-20)', 'USDT (BEP-20)', 'Bitcoin (BTC)'].map(coin => (
                              <button
                                key={coin}
                                onClick={() => setSelectedCoin(coin)}
                                className={`py-2 rounded-lg text-[11px] font-mono font-bold border transition-all cursor-pointer ${
                                  selectedCoin === coin
                                    ? 'bg-[#f0b90b] text-black border-transparent shadow-md'
                                    : 'bg-black/30 border-white/[0.05] text-slate-400 hover:text-slate-200'
                                }`}
                              >
                                {coin}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Copy details */}
                        <div className="bg-black/40 border border-white/[0.04] p-3.5 rounded-xl space-y-2">
                          <span className="text-[10px] text-yellow-500 font-bold uppercase tracking-wider block">
                            Copy Send Address
                          </span>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              readOnly
                              value={
                                selectedCoin === 'USDT (TRC-20)' 
                                  ? 'TXS9x7uBmWghyLg8uQ931gKpS2v6RmqL5C'
                                  : selectedCoin === 'USDT (BEP-20)'
                                  ? '0x71C7656EC7ab88b098defB751B7401B5f6d14766'
                                  : 'bc1qxy2kg3ut7yt62g6g23t6y8z7tj5xpwy5v7ecwd'
                              }
                              className="flex-1 bg-black/60 border border-white/[0.08] px-3 py-1.5 rounded-lg text-xs font-mono text-slate-200 focus:outline-none"
                            />
                            <button
                              onClick={() => {
                                const addr = selectedCoin === 'USDT (TRC-20)' 
                                  ? 'TXS9x7uBmWghyLg8uQ931gKpS2v6RmqL5C'
                                  : selectedCoin === 'USDT (BEP-20)'
                                  ? '0x71C7656EC7ab88b098defB751B7401B5f6d14766'
                                  : 'bc1qxy2kg3ut7yt62g6g23t6y8z7tj5xpwy5v7ecwd';
                                navigator.clipboard.writeText(addr);
                                setCopiedAddressField(true);
                                setTimeout(() => setCopiedAddressField(false), 2000);
                                showInAppToast("📋 Copied!", "Deposit Address successfully copied.", "success");
                              }}
                              className="bg-yellow-500/10 border border-yellow-500/20 px-3 py-1.5 rounded-lg text-xs text-yellow-500 hover:bg-yellow-500/20 font-bold transition-all flex items-center gap-1 cursor-pointer"
                            >
                              {copiedAddressField ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                              <span>{copiedAddressField ? "Copied" : "Copy"}</span>
                            </button>
                          </div>
                          <p className="text-[10px] text-slate-500 leading-normal">
                            ⚠️ Note: Please only transfer <strong>{selectedCoin.split(" ")[0]}</strong> via the correct <strong>{selectedCoin.split(" ")[1] || "Normal"}</strong> blockchain network.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4 text-left">
                        {/* Pakistan Bank Account */}
                        <div className="bg-black/35 rounded-xl p-4 border border-white/[0.03] space-y-2">
                          <span className="text-[10px] text-yellow-500 font-bold uppercase tracking-wider flex items-center gap-1.5">
                            🟢 Meezan Bank Deposit Account (FAST/IMFT Transfc)
                          </span>
                          
                          <div className="space-y-1.5 text-xs font-sans">
                            <div className="flex justify-between border-b border-white/[0.03] pb-1">
                              <span className="text-slate-500">Bank Title</span>
                              <span className="text-slate-300 font-bold">Meezan Bank Limited</span>
                            </div>
                            <div className="flex justify-between border-b border-white/[0.03] pb-1">
                              <span className="text-slate-500">Account Owner</span>
                              <span className="text-slate-300 font-bold text-right">Forex & Crypto Signaly Pro (Pvt) Ltd</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-slate-500">IBAN Account</span>
                              <span className="font-mono text-slate-300 font-bold flex items-center gap-1.5">
                                <span>PK42MEZN0034010998243</span>
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText("PK42MEZN0034010998243");
                                    showInAppToast("📋 Account Copied", "Meezan IBAN copied successfully!", "success");
                                  }}
                                  className="text-[#f0b90b] text-[10px] border border-yellow-500/10 hover:border-yellow-500/30 px-1.5 py-0.5 rounded cursor-pointer"
                                >
                                  Copy
                                </button>
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Mobile wallet */}
                        <div className="bg-black/35 rounded-xl p-4 border border-white/[0.03] space-y-2">
                          <span className="text-[10px] text-[#f0b90b] font-bold uppercase tracking-wider">
                            🟢 Mobile Payments (EasyPaisa / JazzCash)
                          </span>
                          <div className="space-y-1.5 text-xs font-sans">
                            <div className="flex justify-between border-b border-white/[0.03] pb-1">
                              <span className="text-slate-500">Account Title</span>
                              <span className="text-slate-300 font-bold">Signal Pro Mobile Ledger</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-slate-500">Account Number</span>
                              <span className="font-mono text-slate-300 font-bold flex items-center gap-1.5">
                                <span>+92 300 1234567</span>
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText("+923001234567");
                                    showInAppToast("📋 Mobile No Copied", "Phone number copied!", "success");
                                  }}
                                  className="text-[#f0b90b] text-[10px] border border-yellow-500/10 hover:border-yellow-500/30 px-1.5 py-0.5 rounded cursor-pointer"
                                >
                                  Copy
                                </button>
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Submit Verification inside Tab */}
                    <div className="border-t border-white/[0.04] pt-4 text-left space-y-3">
                      <h4 className="text-xs text-slate-300 font-black uppercase tracking-wider flex items-center gap-1.5">
                        <QrCode className="w-3.5 h-3.5 text-yellow-500" />
                        Apni Transferred Payment Receipt Submit Karein:
                      </h4>

                      <div className="space-y-3">
                        <div>
                          <label className="text-[10px] text-slate-500 uppercase font-black block mb-1">
                            TxID / Sender Bank Account User Title
                          </label>
                          <input
                            type="text"
                            value={txDetails}
                            onChange={(e) => setTxDetails(e.target.value)}
                            placeholder="e.g. Transaction Hash Hash-Ref ID ya easy paisa account holder name"
                            className="w-full bg-black/45 border border-white/[0.06] px-3 py-2 rounded-lg text-xs font-mono font-bold text-slate-200 focus:outline-none focus:border-yellow-500/40"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[10px] text-slate-500 uppercase font-black block mb-1">
                              Amount Transferred ({paymentTab === 'crypto' ? 'USDT' : 'PKR'})
                            </label>
                            <input
                              type="text"
                              value={paymentAmount}
                              onChange={(e) => setPaymentAmount(e.target.value)}
                              placeholder={paymentTab === 'crypto' ? '50 USDT' : '14000 PKR'}
                              className="w-full bg-black/45 border border-white/[0.06] px-3 py-2 rounded-lg text-xs font-mono font-bold text-slate-200 focus:outline-none focus:border-yellow-500/40"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] text-slate-500 uppercase font-black block mb-1">
                              Deposit Slip Image
                            </label>
                            
                            {receiptUploadProgress !== null ? (
                              <div className="bg-black/20 border border-white/[0.05] rounded-lg p-2 flex flex-col justify-center h-[34px]">
                                <div className="w-full bg-slate-900 rounded-full h-1 overflow-hidden">
                                  <div 
                                    className="bg-[#f0b90b] h-full transition-all duration-150" 
                                    style={{ width: `${receiptUploadProgress}%` }}
                                  />
                                </div>
                                <span className="text-[8px] text-slate-400 mt-1 font-mono text-center">
                                  Uploading Receipt: {receiptUploadProgress}%
                                </span>
                              </div>
                            ) : receiptFileName ? (
                              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-2 py-1.5 text-emerald-400 text-[10px] font-bold flex items-center justify-between h-[34px]">
                                <span className="truncate max-w-[115px]">📎 {receiptFileName}</span>
                                <button 
                                  type="button" 
                                  onClick={() => setReceiptFileName('')}
                                  className="text-emerald-500 hover:text-white"
                                >
                                  ✕
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setReceiptUploadProgress(0);
                                  let p = 0;
                                  const iv = setInterval(() => {
                                    p += 20;
                                    setReceiptUploadProgress(p);
                                    if (p >= 100) {
                                      clearInterval(iv);
                                      setReceiptUploadProgress(null);
                                      setReceiptFileName(`Receipt_Ref_${Math.floor(Math.random() * 9000 + 1000)}.jpg`);
                                      showInAppToast("📎 Attached Successfully", "Deposit transaction screenshot attached dynamically!", "success");
                                    }
                                  }, 250);
                                }}
                                className="w-full bg-yellow-500/5 hover:bg-yellow-500/10 border border-yellow-500/15 text-yellow-500 tracking-wider font-extrabold uppercase rounded-lg text-[9px] flex items-center justify-center gap-1.5 h-[34px] cursor-pointer"
                              >
                                <Upload className="w-3 h-3" />
                                Upload receipt
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Submission triggers */}
                  <div className="p-5 bg-black/20 border-t border-white/[0.04] space-y-2">
                    <button
                      onClick={async () => {
                        if (!txDetails.trim()) {
                          showInAppToast("❌ Form अधورا ہے", "Meezan account title ya Transaction Hash reference standard lazmi likhein.", "warn");
                          return;
                        }
                        if (!receiptFileName) {
                          showInAppToast("❌ Receipt Missing", "Transfer transaction slip image or receipt copy attach karein.", "warn");
                          return;
                        }

                        setIsSubmittingPayment(true);
                        
                        try {
                          await new Promise(r => setTimeout(r, 2200));
                          
                          const res = await fetch("/api/user/upgrade", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ username: sessionUsername })
                          });
                          
                          const data = await res.json();
                          if (res.ok && data.success) {
                            setCurrentUser(prev => prev ? { 
                              ...prev, 
                              subscriptionLevel: data.subscriptionLevel, 
                              trialExpiresAt: data.trialExpiresAt 
                            } : null);

                            showInAppToast("👑 VIP UNLOCKED SUCCESSFULLY", "Shabash! Aapka checking ledger account verify ho gaya hai! Premium access dynamic updated.", "success");
                            playSignalChime("LONG");
                            setShowPaymentModal(false);
                          } else {
                            showInAppToast("❌ Upgrade Fail", data.error || "Could not synchronize server levels.", "warn");
                          }
                        } catch (e: any) {
                          console.error(e);
                          showInAppToast("❌ Server Error", "Could not connect to verification server backend node.", "warn");
                        } finally {
                          setIsSubmittingPayment(false);
                        }
                      }}
                      disabled={isSubmittingPayment}
                      className="w-full bg-gradient-to-r from-yellow-400 via-[#f0b90b] to-yellow-500 hover:brightness-110 active:scale-[0.98] transition-all py-3.5 rounded-xl text-black font-extrabold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-yellow-500/20"
                    >
                      {isSubmittingPayment ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin text-black" />
                          <span>Verifying dynamic transaction slip in cloud ledger...</span>
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="w-4.5 h-4.5 text-black" />
                          <span>Verfiy & Activate Lifetime Premium VIP Pass Now</span>
                        </>
                      )}
                    </button>
                    <p className="text-[10px] text-slate-500 font-sans text-center">
                      🔐 Instant verification matching engine updates your status to lifetime unlimited signals in real-time.
                    </p>
                  </div>

                </div>

              </div>
            )}
          </div>
        )}

        {/* Sleek Interface Premium Subscription Info Bottom Deck */}
        <footer className="mt-8 bg-[#f0b90b]/5 border border-[#f0b90b]/10 p-5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="premium-info text-center sm:text-left">
            <h4 className="text-base font-bold text-[#f0b90b] flex items-center justify-center sm:justify-start gap-1.5 font-sans">
              <ShieldCheck className="w-4 h-4 text-[#f0b90b] animate-pulse" />
              Veteran Desk Analysis Active
            </h4>
            <p className="text-xs text-[#64748b] mt-1">
              Manual expert scanning across multiple major liquid assets. Signed in as <strong>Elite Trader ({subscriptionOwner})</strong>.
            </p>
          </div>
          <button 
            onClick={handleScan}
            disabled={isScanning}
            className="bg-[#f0b90b] hover:brightness-110 active:scale-[0.98] text-black font-extrabold px-6 py-3 rounded-xl text-xs transition-all uppercase tracking-wider cursor-pointer shadow-lg shadow-yellow-500/10"
          >
            {isScanning ? "Scanning Market..." : "VIEW ALL SIGNALS"}
          </button>
        </footer>

        {/* PlayStore Compliant Dynamic Crypto Risk Disclaimer Box */}
        <div className="mt-6 bg-[#080c16]/80 border border-white/[0.05] p-5 rounded-[22px] text-left space-y-4 shadow-xl">
          <div className="flex items-center gap-2 border-b border-white/[0.04] pb-3">
            <span className="p-1.5 bg-yellow-500/10 rounded-lg text-yellow-500">
              <Info className="w-4 h-4" />
            </span>
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-300 font-sans">
                Professional Risk Disclaimer &amp; Liability Release
              </h4>
              <p className="text-[10px] text-slate-500">
                Play Store Compliance Guide • Educational &amp; Interactive Information Utility Only
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs text-slate-400 leading-relaxed font-sans">
            {/* English Version */}
            <div className="space-y-2 border-r border-white/[0.03] pr-0 md:pr-4">
              <div className="flex items-center gap-1.5 text-slate-300 font-bold uppercase text-[10px] tracking-wide">
                🇬🇧 Risk Disclosure
              </div>
              <p className="text-[11px] text-slate-400">
                This application is strictly an educational, signal-based showcase, and interactive simulator interface. All signals, parameters, historical data, and copied positions are generated as predictive data for virtual tracking. We do not provide real financial, trade planning, legal, or investment advice. 
              </p>
              <p className="text-[11px] text-yellow-500/70 font-semibold">
                ⚠️ Futures &amp; Cryptocurrency markets are subject to extreme systemic volatility. You are solely responsible for all personal financial decisions. We explicitly release and deny any liability for any financial profit or loss incurred.
              </p>
            </div>

            {/* Urdu Version */}
            <div className="space-y-2 text-right" style={{ direction: 'rtl' }}>
              <div className="flex items-center justify-start gap-1.5 text-slate-300 font-bold uppercase text-[10px] tracking-wide">
                🇵🇰 اہم قانونی اعلامیہ اور خطرہ کی وارننگ
              </div>
              <p className="text-[12px] text-slate-400 font-sans leading-normal">
                یہ ایپلی کیشن خالصتاً تعلیمی، معلوماتی اور ورچوئل سمولیٹر سروس فراہم کرتی ہے۔ یہاں پیش کردہ تمام لائیو مارکیٹ پوزیشنز، تجزیے اور قیمتیں صرف تعلیمی اور ریسیرچ مقاصد کے لیے تیار کی گئی ہیں۔ ہم کسی قسم کی سرکاری مالیاتی مشورہ یا انویسٹمنٹ ایڈوائس نہیں دیتے۔
              </p>
              <p className="text-[12px] text-yellow-500/80 font-bold leading-normal">
                ⚠️ کرپٹو کرنسی اور فیوچرز ٹریڈنگ میں مارکیٹ کے اتار چڑھاؤ کی وجہ سے نفع نقصان کا خطرہ بہت زیادہ ہوتا ہے۔ آپ کے کسی بھی قسم کے نفع یا نقصان کی ذمہ داری ایپلی کیشن یا اس کے مالکان پر ہرگز نہیں ہوگی اور ہم اس کے کسی صورت ذمہ دار نہیں ہیں۔
              </p>
            </div>
          </div>
        </div>

        {/* Floating Custom Toast Alerts Wrapper */}
        <div className="fixed top-24 right-4 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none">
          <AnimatePresence>
            {toasts.map(toast => (
              <motion.div
                key={toast.id}
                layout
                initial={{ opacity: 0, x: 50, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 50, scale: 0.95 }}
                className={`p-4 rounded-xl border pointer-events-auto shadow-2xl backdrop-blur-md flex gap-3 items-start ${
                  toast.type === "success" 
                    ? 'bg-[#093020]/95 border-emerald-500/40 text-emerald-200' 
                    : toast.type === "warn"
                    ? 'bg-[#2d0f12]/95 border-rose-500/40 text-rose-200'
                    : 'bg-[#151c26]/95 border-[#f0b90b]/40 text-slate-100'
                }`}
              >
                <div className="text-sm mt-0.5">
                  {toast.type === "success" ? "🎯" : toast.type === "warn" ? "🚨" : "🤖"}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-bold uppercase tracking-wider font-display text-white">
                    {toast.title}
                  </h4>
                  <p className="text-[11px] mt-1 text-slate-300 leading-relaxed">
                    {toast.message}
                  </p>
                </div>
                <button 
                  onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                  className="text-slate-400 hover:text-white text-xs p-1 cursor-pointer transition-colors"
                >
                  ✕
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* CUSTOM CHECKOUT AND PREMIUM UPGRADE GATEWAY */}
        <AnimatePresence>
          {showPaymentModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
              {/* Overlay Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowPaymentModal(false)}
                className="fixed inset-0 bg-black/85 backdrop-blur-md cursor-pointer"
              />

              {/* Modal Body Container */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 30 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 30 }}
                transition={{ type: "spring", duration: 0.5 }}
                className="relative bg-[#0d1222] border border-yellow-500/20 rounded-[28px] max-w-lg w-full overflow-hidden shadow-2xl shadow-yellow-500/[0.04] z-[101]"
              >
                {/* Header glow */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-yellow-500 via-amber-400 to-yellow-500" />
                
                <div className="p-6 pb-4 border-b border-white/[0.04]">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="px-2 py-0.5 rounded-full bg-yellow-500/10 border border-yellow-500/10 text-[#f0b90b] text-[10px] uppercase font-black tracking-wider">
                        👑 VIP LEVEL EXCLUSIVE
                      </span>
                      <h3 className="text-lg font-black tracking-tight text-white font-sans mt-2">
                        Premium VIP Professional Pass
                      </h3>
                      <p className="text-slate-400 text-xs mt-1">
                        Manual high accuracy senior analyst signals unlocked 24/7 forever
                      </p>
                    </div>
                    <button
                      onClick={() => setShowPaymentModal(false)}
                      className="bg-black/20 text-slate-400 hover:text-white p-1.5 rounded-full border border-white/[0.05] text-xs cursor-pointer select-none"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* Sub Tab Selections */}
                <div className="px-6 py-4 flex gap-2.5 bg-black/10">
                  <button
                    onClick={() => setPaymentTab('crypto')}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-2 cursor-pointer ${
                      paymentTab === 'crypto'
                        ? 'bg-yellow-500/10 border-yellow-500/35 text-yellow-500'
                        : 'bg-[#080c16]/50 border-white/[0.02] text-slate-400 hover:text-slate-300'
                    }`}
                  >
                    <Wallet className="w-4 h-4" />
                    Cryptocurrency USDT
                  </button>
                  <button
                    onClick={() => setPaymentTab('bank')}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-2 cursor-pointer ${
                      paymentTab === 'bank'
                        ? 'bg-yellow-500/10 border-yellow-500/35 text-yellow-500'
                        : 'bg-[#080c16]/50 border-white/[0.02] text-slate-400 hover:text-slate-300'
                    }`}
                  >
                    <CreditCard className="w-4 h-4" />
                    Local Bank / EasyPaisa
                  </button>
                </div>

                {/* Tab content fields */}
                <div className="p-6 space-y-5 max-h-[360px] overflow-y-auto">
                  
                  {paymentTab === 'crypto' ? (
                    <div className="space-y-4 text-left">
                      <div className="bg-black/35 rounded-xl p-3 border border-white/[0.03]">
                        <label className="text-[10px] text-slate-400 uppercase tracking-wider font-bold block mb-2">
                          Select Wallet Currency:
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {['USDT (TRC-20)', 'USDT (BEP-20)', 'Bitcoin (BTC)'].map(coin => (
                            <button
                              key={coin}
                              onClick={() => setSelectedCoin(coin)}
                              className={`py-1.5 rounded-lg text-xs font-mono font-bold border transition-all ${
                                selectedCoin === coin
                                  ? 'bg-[#f0b90b] text-black border-transparent'
                                  : 'bg-black/40 border-white/[0.05] text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              {coin}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Display address & copy options */}
                      <div className="bg-black/45 border border-white/[0.04] p-4 rounded-xl space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-slate-400 uppercase font-mono tracking-widest text-[#f0b90b] font-black">
                            {selectedCoin} Deposit Wallet Address
                          </span>
                          <span className="text-[10px] font-bold text-slate-500 font-mono">
                            Auto network verify
                          </span>
                        </div>

                        <div className="flex gap-2">
                          <input
                            type="text"
                            readOnly
                            value={
                              selectedCoin === 'USDT (TRC-20)' 
                                ? 'TXS9x7uBmWghyLg8uQ931gKpS2v6RmqL5C'
                                : selectedCoin === 'USDT (BEP-20)'
                                ? '0x71C7656EC7ab88b098defB751B7401B5f6d14766'
                                : 'bc1qxy2kg3ut7yt62g6g23t6y8z7tj5xpwy5v7ecwd'
                            }
                            className="flex-1 bg-black/60 border border-white/[0.08] px-3 py-2 rounded-lg text-xs font-mono font-bold text-slate-200 focus:outline-none"
                          />
                          <button
                            onClick={() => {
                              const addr = selectedCoin === 'USDT (TRC-20)' 
                                ? 'TXS9x7uBmWghyLg8uQ931gKpS2v6RmqL5C'
                                : selectedCoin === 'USDT (BEP-20)'
                                ? '0x71C7656EC7ab88b098defB751B7401B5f6d14766'
                                : 'bc1qxy2kg3ut7yt62g6g23t6y8z7tj5xpwy5v7ecwd';
                              navigator.clipboard.writeText(addr);
                              setCopiedAddressField(true);
                              setTimeout(() => setCopiedAddressField(false), 2000);
                              showInAppToast("📋 Copied!", "Address successfully saved to clipboard.", "success");
                            }}
                            className="bg-yellow-500/10 border border-yellow-500/25 px-3 py-2 rounded-lg text-xs text-yellow-500 hover:bg-yellow-500/20 font-bold transition-all flex items-center gap-1"
                          >
                            {copiedAddressField ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                            <span>{copiedAddressField ? "Copied" : "Copy"}</span>
                          </button>
                        </div>
                        <p className="text-[10px] text-yellow-500/70 font-sans leading-normal">
                          ⚠️ Warning: Sirf <strong>{selectedCoin.split(" ")[0]} ({selectedCoin.split(" ")[1] || "Core"})</strong> network par deposit send karein. Wrong blockchain block network se loss ho sakta hai.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4 text-left">
                      <div className="bg-black/35 rounded-xl p-4 border border-white/[0.03] space-y-3">
                        <span className="text-[10px] text-yellow-500 font-bold uppercase tracking-widest flex items-center gap-1">
                          🟢 Pakistan Bank Details (Meezan Bank Ltd)
                        </span>
                        
                        <div className="space-y-2.5 font-sans">
                          <div className="grid grid-cols-3 text-xs border-b border-white/[0.04] pb-1.5 font-sans">
                            <span className="text-slate-500 font-bold">Bank Name</span>
                            <span className="col-span-2 text-slate-200 font-bold">Meezan Bank Limited</span>
                          </div>
                          <div className="grid grid-cols-3 text-xs border-b border-white/[0.04] pb-1.5 font-sans">
                            <span className="text-slate-500 font-bold">Account Title</span>
                            <span className="col-span-2 text-slate-200 font-bold">Forex & Crypto Signaly Pro (Pvt) Ltd</span>
                          </div>
                          <div className="grid grid-cols-3 text-xs border-b border-white/[0.04] pb-1.5 items-center font-sans">
                            <span className="text-slate-500 font-bold">IBAN / Account</span>
                            <span className="col-span-2 font-mono text-slate-200 font-bold flex justify-between items-center">
                              <span>PK42MEZN0034010998243</span>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText("PK42MEZN0034010998243");
                                  showInAppToast("📋 Account Copied", "IBAN number coped successfully!", "success");
                                }}
                                className="text-[#f0b90b] text-[10px] border border-yellow-500/10 hover:border-yellow-500/30 px-1.5 py-0.5 rounded ml-2"
                              >
                                Copy
                              </button>
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-black/35 rounded-xl p-4 border border-white/[0.03] space-y-2.5">
                        <span className="text-[10px] text-[#f0b90b] font-bold uppercase tracking-widest flex items-center gap-1">
                          🟢 Mobile Wallets (EasyPaisa / JazzCash)
                        </span>
                        <div className="space-y-2 font-sans">
                          <div className="grid grid-cols-3 text-xs border-b border-white/[0.04] pb-1.5 font-sans">
                            <span className="text-slate-500 font-bold">Wallet Title</span>
                            <span className="col-span-2 text-slate-200 font-bold">Signal Pro Mobile Ledger</span>
                          </div>
                          <div className="grid grid-cols-3 text-xs items-center font-sans">
                            <span className="col-span-2 font-mono text-slate-200 font-bold flex justify-between items-center font-mono font-bold">
                              <span>+92 300 1234567</span>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText("+923001234567");
                                  showInAppToast("📋 Mobile No Copied", "Saved to clipboard", "success");
                                }}
                                className="text-[#f0b90b] text-[10px] border border-yellow-500/10 hover:border-yellow-500/30 px-1.5 py-0.5 rounded ml-2"
                              >
                                Copy
                              </button>
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Attachment receipt / submission details form */}
                  <div className="border-t border-white/[0.04] pt-4 text-left">
                    <h4 className="text-xs text-slate-400 font-black uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <QrCode className="w-3.5 h-3.5 text-yellow-500" />
                      Submit Verification Details
                    </h4>

                    <div className="space-y-3">
                      <div>
                        <label className="text-[10px] text-slate-500 uppercase font-black tracking-wide block mb-1">
                          Tx ID / Bank Sender Account Title
                        </label>
                        <input
                          type="text"
                          value={txDetails}
                          onChange={(e) => setTxDetails(e.target.value)}
                          placeholder="e.g. TxHash ID or Meezan Account User Name Title"
                          className="w-full bg-black/45 border border-white/[0.06] px-3 py-2 rounded-lg text-xs font-mono font-bold text-slate-200 focus:outline-none focus:border-yellow-500/40"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] text-slate-500 uppercase font-black tracking-wide block mb-1">
                            Amount Transferred ({paymentTab === 'crypto' ? 'USDT' : 'PKR'})
                          </label>
                          <input
                            type="text"
                            value={paymentAmount}
                            onChange={(e) => setPaymentAmount(e.target.value)}
                            placeholder={paymentTab === 'crypto' ? '50 USDT' : '14000 PKR'}
                            className="w-full bg-black/45 border border-white/[0.06] px-3 py-2 rounded-lg text-xs font-mono font-bold text-slate-200 focus:outline-none focus:border-yellow-500/40"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] text-slate-500 uppercase font-black tracking-wide block mb-1">
                            Deposit Receipt Image
                          </label>
                          
                          {receiptUploadProgress !== null ? (
                            <div className="bg-black/20 border border-white/[0.05] rounded-lg p-2 flex flex-col justify-center h-[34px]">
                              <div className="w-full bg-slate-900 rounded-full h-1 overflow-hidden">
                                <div 
                                  className="bg-[#f0b90b] h-full transition-all duration-150" 
                                  style={{ width: `${receiptUploadProgress}%` }}
                                />
                              </div>
                              <span className="text-[8px] text-slate-400 mt-1 font-mono text-center">
                                Uploading Receipt: {receiptUploadProgress}%
                              </span>
                            </div>
                          ) : receiptFileName ? (
                            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-2 py-1.5 text-emerald-400 text-[10px] font-bold flex items-center justify-between h-[34px]">
                              <span className="truncate max-w-[110px]">📎 {receiptFileName}</span>
                              <button 
                                type="button" 
                                onClick={() => setReceiptFileName('')}
                                className="text-emerald-500 hover:text-white"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setReceiptUploadProgress(0);
                                let p = 0;
                                const iv = setInterval(() => {
                                  p += 20;
                                  setReceiptUploadProgress(p);
                                  if (p >= 100) {
                                    clearInterval(iv);
                                    setReceiptUploadProgress(null);
                                    setReceiptFileName(`Receipt_Ref_${Math.floor(Math.random() * 9000 + 1000)}.jpg`);
                                    showInAppToast("📎 Attached Successfully", "Deposit receipt jpg attached dynamically!", "success");
                                  }
                                }, 250);
                              }}
                              className="w-full bg-yellow-500/5 hover:bg-yellow-500/10 border border-yellow-500/15 text-yellow-500 tracking-wider font-extrabold uppercase rounded-lg text-[9px] flex items-center justify-center gap-1.5 h-[34px] cursor-pointer"
                            >
                              <Upload className="w-3 h-3" />
                              Upload receipt
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Footer submit button */}
                <div className="p-6 bg-black/25 border-t border-white/[0.04] flex flex-col gap-2">
                  <button
                    onClick={async () => {
                      if (!txDetails.trim()) {
                        showInAppToast("❌ Missed Details", "Bank reference account title ya Transaction Hash form complete karein.", "warn");
                        return;
                      }
                      if (!receiptFileName) {
                        showInAppToast("❌ Receipt Missing", "Transfer transaction slip / payment receipt upload karein.", "warn");
                        return;
                      }

                      setIsSubmittingPayment(true);
                      
                      try {
                        await new Promise(r => setTimeout(r, 2200));
                        
                        const res = await fetch("/api/user/upgrade", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ username: sessionUsername })
                        });
                        
                        const data = await res.json();
                        if (res.ok && data.success) {
                          setCurrentUser(prev => prev ? { 
                            ...prev, 
                            subscriptionLevel: data.subscriptionLevel, 
                            trialExpiresAt: data.trialExpiresAt 
                          } : null);

                          showInAppToast("👑 VIP UNLOCKED SUCCESS", "Aapka dynamic checking receipt verify ho chuka hai! Elite group activated.", "success");
                          playSignalChime("LONG");
                          setShowPaymentModal(false);
                        } else {
                          showInAppToast("❌ Upgrade Fail", data.error || "Please verify your active profile sync status.", "warn");
                        }
                      } catch (e: any) {
                        console.error(e);
                        showInAppToast("❌ Backend Error", "Could not connect to verification servers.", "warn");
                      } finally {
                        setIsSubmittingPayment(false);
                      }
                    }}
                    disabled={isSubmittingPayment}
                    className="w-full bg-[#f0b90b] hover:brightness-110 active:scale-[0.98] transition-all py-3.5 rounded-xl text-black font-extrabold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-yellow-500/10 select-none"
                  >
                    {isSubmittingPayment ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-black" />
                        <span>Verifying Ledger Receipt (Instant Approval)...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4.5 h-4.5 text-black" />
                        <span>VERIFY & UPGRADE TO PREMIUM Pass</span>
                      </>
                    )}
                  </button>
                  <p className="text-[10px] text-slate-500 font-sans text-center mt-1">
                    Auto-check payment matching locks you into premium automatically. 100% Guaranteed safe.
                  </p>
                </div>

              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
