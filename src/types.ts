export interface Signal {
  id: string;
  symbol: string;         // e.g., "BTC"
  pair: string;           // e.g., "BTCUSDT"
  direction: "LONG" | "SHORT";
  action: "BUY" | "SELL";
  entry: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  currentPrice: number;
  rsi: number;
  histogram: number;
  volumeSurge: boolean;
  confidence: number;
  timestamp: string;      // ISO format
  timeIn: string;         // Pakistan Time or client default
  status: "ACTIVE" | "TP1 HIT" | "TP2 HIT" | "SL HIT" | "EXPIRED";
  pnl?: number;           // Calculated profit/loss percent
  aiStatus?: string;      // e.g. "AI_VERIFIED"
  aiConfidence?: number;  // e.g. 78-88
  aiAnalysis?: string;    // Concise technical breakdown / justification
  tp1Hit?: boolean;       // Tracks if TP1 was hit but trade is active
}

export interface MarketStats {
  totalSignals: number;
  winRate: number;        // e.g., 85 (%)
  activeSignalsCount: number;
  avgConfidence: number;
  lastScanTime: string;
}

export interface UserSubscription {
  userId: string;
  active: boolean;
  subscribedAt: string;
}

export interface CopiedTrade {
  id: string;            // unique trade trade placement id
  signalId: string;      // referencing source Signal
  symbol: string;
  pair: string;
  direction: "LONG" | "SHORT";
  entryPrice: number;
  currentPrice: number;
  takeProfit1: number;
  takeProfit2: number;
  stopLoss: number;
  status: "ACTIVE" | "TP1 HIT" | "TP2 HIT" | "SL HIT" | "CLOSED";
  pnl: number;
  copiedAt: string;
  closedAt?: string;
  closePrice?: number;
  margin?: number;       // custom trial USDT margin allocated
  leverage?: number;     // leverage scale 1 to 5
  tp1Hit?: boolean;      // Tracks if individual trade secured TP1
  origTp1Notified?: boolean; // Avoid double notifying TP1 hits
}

export interface UserProfile {
  username: string;
  registeredAt: string;
  trialExpiresAt: string;
  subscriptionLevel: "Trial" | "VIP Premium";
  simulatedBalance: number;
  copiedTrades: CopiedTrade[];
}

