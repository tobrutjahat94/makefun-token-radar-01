// lib/model.ts — Token launch radar: value model and farm plans.
//
// The model is computed from the sealed snapshot alone. Nothing here names a
// protocol, a chain or a category in advance: every figure below is derived
// from the snapshot's own rows at run time, so the same program ranks a fresh
// snapshot the same way.
//
// Value model (stated on the dashboard, and shown per protocol):
//   implied_value = TVL x peer_ratio(category) x growth x age
//   peer_ratio  — the category's live-token peers' median market-cap-per-TVL,
//                 shrunk toward the global median (see peerRatios). A token
//                 that already trades is the only honest comp for a token
//                 that does not exist yet.
//   growth      — 1 + 0.5 x clamp(change_7d, -30, +30) / 100. A protocol
//                 growing into its launch is worth more than one shrinking.
//   age         — 0.90 + 0.10 x min(months_listed, 48) / 48. A protocol that
//                 has run for years with real TVL and still no token is an
//                 overdue launch; the factor is deliberately small so age
//                 only breaks near-ties, never outruns TVL.
// A board row is a clean pre-token protocol: both gecko_id and symbol are
// null in the snapshot (it records no token), and it passes the watchlist's
// own cleanliness test (below). A wrapped, staked, bridged or versioned
// product is a product of a token that already trades, not a fresh launch,
// so it gets no row at all — the board separates what already trades from
// what is still to come, rather than discounting the difference away.

export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

export interface PeerStat {
  peers: number;
  median: number;
  shrunk: number;
}

export interface PeerTable {
  globalMedian: number;
  byCategory: Record<string, PeerStat>;
}

export interface BoardRow {
  slug: string;
  name: string;
  rank: number;
  implied_value_usd: number;
  farm_steps: string[];
  category: string;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  listed_at: string | null;
  months_listed: number;
  peer_ratio: number;
  peer_count: number;
  growth_factor: number;
  age_factor: number;
  on_watchlist: boolean;
  formula_value_usd: number;
}

export interface BoardMeta {
  as_of: string;
  floor_usd: number;
  protocols_total: number;
  pre_token_total: number;
  watchlist_total: number;
  rows_total: number;
  global_median_ratio: number;
  peer_table: Record<string, PeerStat>;
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

export function median(values: number[]): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

export function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

/** Whole months between a YYYY-MM-DD date and the snapshot's as-of date. */
export function monthsBetween(from: string | null, asOf: string): number | null {
  if (!from) return null;
  const start = new Date(from + "T00:00:00Z");
  const end = new Date(asOf + "T00:00:00Z");
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  const months =
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    (end.getUTCMonth() - start.getUTCMonth());
  return Math.max(0, months);
}

/** "Records no token": DefiLlama carries neither a CoinGecko id nor a ticker. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.gecko_id === null && p.symbol === null;
}

const VERSION_SUFFIX = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;
const WRAPPED_PRODUCT_CATEGORIES = new Set([
  "Bridge",
  "Canonical Bridge",
  "Liquid Staking",
  "Liquid Restaking",
  "Restaked BTC",
  "CEX",
]);
const EXCHANGE_PREFIX =
  /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/;
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;

/**
 * The watchlist's own cleanliness rule, from the snapshot's field guide:
 * no version suffix on the name, not a bridge / liquid-staking / restaking /
 * CEX product, no wrapped/staked word in the name, not named after an
 * exchange. A protocol that fails it is a product of a token that already
 * trades, not a protocol still waiting on a launch of its own.
 */
export function isClean(p: SnapshotProtocol): boolean {
  if (VERSION_SUFFIX.test(p.name)) return false;
  if (p.category !== null && WRAPPED_PRODUCT_CATEGORIES.has(p.category)) {
    return false;
  }
  if (WRAPPED_WORD.test(p.name)) return false;
  if (EXCHANGE_PREFIX.test(p.name)) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Peer ratios: what do live tokens trade at per dollar of TVL?
// ---------------------------------------------------------------------------

const SHRINKAGE_PRIOR = 5;
const RATIO_FLOOR = 0.01;
const RATIO_CAP = 3.0;

export function peerRatios(protocols: SnapshotProtocol[]): PeerTable {
  const peers = protocols.filter((p) => p.mcap_usd !== null && p.tvl_usd > 0);
  const allRatios = peers.map((p) => (p.mcap_usd as number) / p.tvl_usd);
  const globalMedian = median(allRatios);
  const byCategory: Record<string, number[]> = {};
  for (const p of peers) {
    const key = p.category ?? "Uncategorized";
    if (!byCategory[key]) byCategory[key] = [];
    byCategory[key].push((p.mcap_usd as number) / p.tvl_usd);
  }
  const table: Record<string, PeerStat> = {};
  for (const [key, ratios] of Object.entries(byCategory)) {
    const catMedian = median(ratios);
    const shrunk =
      (ratios.length * catMedian + SHRINKAGE_PRIOR * globalMedian) /
      (ratios.length + SHRINKAGE_PRIOR);
    table[key] = {
      peers: ratios.length,
      median: catMedian,
      shrunk: clamp(shrunk, RATIO_FLOOR, RATIO_CAP),
    };
  }
  return { globalMedian, byCategory: table };
}

export function peerRatioFor(
  category: string | null,
  table: PeerTable,
): { ratio: number; peers: number } {
  const key = category ?? "Uncategorized";
  const stat = table.byCategory[key];
  if (!stat) return { ratio: table.globalMedian, peers: 0 };
  return { ratio: stat.shrunk, peers: stat.peers };
}

// ---------------------------------------------------------------------------
// Implied value
// ---------------------------------------------------------------------------

export interface ValuedProtocol {
  protocol: SnapshotProtocol;
  peerRatio: number;
  peerCount: number;
  growthFactor: number;
  ageFactor: number;
  monthsListed: number;
  value: number;
}

export function valueProtocol(
  p: SnapshotProtocol,
  table: PeerTable,
  asOf: string,
): ValuedProtocol {
  const { ratio, peers } = peerRatioFor(p.category, table);
  const change = p.change_7d ?? 0;
  const growthFactor = 1 + 0.5 * (clamp(change, -30, 30) / 100);
  const months = monthsBetween(p.listed_at, asOf) ?? 12;
  const ageFactor = 0.9 + 0.1 * (Math.min(months, 48) / 48);
  const value = Math.round(p.tvl_usd * ratio * growthFactor * ageFactor);
  return {
    protocol: p,
    peerRatio: ratio,
    peerCount: peers,
    growthFactor,
    ageFactor,
    monthsListed: months,
    value: Math.max(1, value),
  };
}

// ---------------------------------------------------------------------------
// Farm plans: seven concrete steps per protocol.
// The steps are built from the protocol's own category, primary chain and
// name, so two protocols never get the same plan unless they share all
// three. Every step carries a cost or a time; none is a slogan.
// ---------------------------------------------------------------------------

export interface CategoryPlay {
  first: string;
  asset: string;
  second: string;
}

const DEFAULT_PLAY: CategoryPlay = {
  first: "use the protocol's main product",
  asset: "position",
  second: "try a second feature of the same product",
};

const PLAYS: Record<string, CategoryPlay> = {
  Dexs: {
    first: "swap tokens in a pool",
    asset: "liquidity position",
    second: "add liquidity to a second pool on the same chain",
  },
  Lending: {
    first: "supply assets to the lending market",
    asset: "lending position",
    second: "borrow a small amount against your supply",
  },
  Yield: {
    first: "deposit into a yield vault",
    asset: "vault position",
    second: "move part of the position into a second vault",
  },
  "Yield Aggregator": {
    first: "deposit into an auto-compounding vault",
    asset: "strategy position",
    second: "rotate part of the position into a second strategy",
  },
  RWA: {
    first: "buy a tokenised real-world asset",
    asset: "tokenised asset holding",
    second: "hold it through a full distribution cycle",
  },
  "Risk Curators": {
    first: "deposit into a curated vault",
    asset: "curated vault position",
    second: "compare curator fees and move part of the position",
  },
  "Onchain Capital Allocator": {
    first: "allocate capital to a managed vault",
    asset: "allocation",
    second: "read the allocator's report and rebalance once",
  },
  "Basis Trading": {
    first: "open a small delta-neutral basis position",
    asset: "basis position",
    second: "roll the position into the next funding window",
  },
  Derivatives: {
    first: "open a small perpetual position",
    asset: "perpetual position",
    second: "hedge it with an opposite leg for one week",
  },
  CDP: {
    first: "mint stablecoins against your collateral",
    asset: "collateralised position",
    second: "adjust the collateral ratio after a week",
  },
  Restaking: {
    first: "restake your staked assets",
    asset: "restaking position",
    second: "delegate to a second operator",
  },
  Chain: {
    first: "bridge funds to the chain and use its flagship app",
    asset: "on-chain position",
    second: "try a second app on the same chain",
  },
  Payments: {
    first: "pay for something through the protocol",
    asset: "payment flow",
    second: "set up a recurring payment",
  },
  Insurance: {
    first: "buy cover for a position you already hold",
    asset: "cover policy",
    second: "review the cover terms after a month",
  },
  CeDeFi: {
    first: "deposit into the CeDeFi vault",
    asset: "CeDeFi position",
    second: "check the custodian report for the vault",
  },
  "Governance Incentives": {
    first: "lock up to vote on a live proposal",
    asset: "governance position",
    second: "vote on a second proposal the next week",
  },
  "Staking Pool": {
    first: "stake into the pool",
    asset: "staking position",
    second: "compound the rewards back into the pool",
  },
  "Stablecoin Wrapper": {
    first: "wrap stablecoins through the protocol",
    asset: "wrapped position",
    second: "unwrap and re-wrap to show continued use",
  },
  "Collateral Markets": {
    first: "post collateral and open a market position",
    asset: "collateral position",
    second: "top up the collateral after a week",
  },
  Bridge: {
    first: "bridge a small amount across chains",
    asset: "bridge position",
    second: "bridge back a different asset the next week",
  },
  "Canonical Bridge": {
    first: "bridge a small amount through the canonical bridge",
    asset: "bridge position",
    second: "bridge a second asset through the same route",
  },
  "Cross Chain Bridge": {
    first: "bridge a small amount to a second chain",
    asset: "bridge position",
    second: "bridge back through a different route",
  },
  "Liquid Staking": {
    first: "stake and hold the liquid token",
    asset: "liquid staking position",
    second: "use the liquid token in a second protocol",
  },
  "Liquid Restaking": {
    first: "restake through the liquid token",
    asset: "liquid restaking position",
    second: "use the liquid restaking token as collateral",
  },
  "Liquidity Manager": {
    first: "deposit into a managed liquidity position",
    asset: "managed position",
    second: "rebalance the range after two weeks",
  },
  Farm: {
    first: "deposit into the farm",
    asset: "farm position",
    second: "harvest and re-deposit the rewards once",
  },
  "Prediction Market": {
    first: "place a small prediction on an open market",
    asset: "prediction position",
    second: "trade the other side of the same market",
  },
  "NFT Marketplace": {
    first: "list or buy a low-priced item",
    asset: "marketplace activity",
    second: "complete a second trade the next week",
  },
  Launchpad: {
    first: "join a live launch allocation",
    asset: "launch allocation",
    second: "stake for a higher allocation tier",
  },
  Options: {
    first: "buy a small call or put",
    asset: "options position",
    second: "close it before expiry and open a second one",
  },
  Indexes: {
    first: "buy the index token",
    asset: "index holding",
    second: "hold it through a monthly rebalance",
  },
  Privacy: {
    first: "make a private transfer through the protocol",
    asset: "private transfer history",
    second: "repeat the transfer with a different amount",
  },
  "Dual-Token Stablecoin": {
    first: "mint the stablecoin against collateral",
    asset: "stablecoin position",
    second: "redeem and re-mint after a week",
  },
  "Token Locker": {
    first: "lock tokens in a vesting contract",
    asset: "locked position",
    second: "check the unlock schedule after a month",
  },
  "Leveraged Farming": {
    first: "open a small leveraged farm position",
    asset: "leveraged position",
    second: "deleverage in steps over two weeks",
  },
  "Decentralized AI": {
    first: "run a job on the network",
    asset: "compute usage",
    second: "run a second job with different parameters",
  },
  "AI Agents": {
    first: "run the agent on a small task",
    asset: "agent usage",
    second: "run the agent on a second task type",
  },
  "Liquidity Restaking": {
    first: "restake through the liquid token",
    asset: "liquid restaking position",
    second: "use the liquid restaking token as collateral",
  },
};

export function playFor(category: string | null): CategoryPlay {
  if (category !== null && PLAYS[category]) return PLAYS[category];
  return DEFAULT_PLAY;
}

export function gasNote(chain: string): string {
  if (chain === "Ethereum") return "about $10–$30 in gas per transaction";
  if (chain === "Solana") return "a few cents in gas per transaction";
  if (
    chain === "Base" ||
    chain === "Arbitrum" ||
    chain === "Optimism" ||
    chain === "BSC" ||
    chain === "Polygon" ||
    chain === "Avalanche" ||
    chain === "Linea" ||
    chain === "Scroll" ||
    chain === "zkSync Era"
  ) {
    return "under $1 in gas per transaction";
  }
  return "about $1–$5 in gas per transaction";
}

export function farmSteps(
  name: string,
  category: string | null,
  chain: string,
): string[] {
  const play = playFor(category);
  const gas = gasNote(chain);
  return [
    `Open a fresh wallet, bridge $200 in stablecoins to ${chain} for farming, and keep enough aside for gas at ${gas}. Use this wallet only for ${name} so the activity stays clean (30–45 minutes to set up).`,
    `Make a first move on ${name}: ${play.first} with $25–$50 only, confirm the receipt on ${chain}, save the transaction hash, and check the position shows in the app (about 15 minutes).`,
    `Scale up to a steady ${play.asset}: put $100–$250 to work across 2–3 transactions over the coming week, so the activity reads as real use rather than a single burst (about 1 hour in total).`,
    `Go one level deeper: ${play.second} with part of the position, and leave it running for at least two weeks so the protocol records sustained use (30 minutes to set up).`,
    `Come back every week for 6–8 weeks: repeat the main action once a week, and check ${name} for points, quests or a leaderboard each visit so no task is missed (10 minutes a week).`,
    `Stay safe: keep the farming position under 5% of your crypto, never use leverage you do not understand, and review and revoke token approvals once a month (10 minutes a month, no cost).`,
    `Watch for the launch: follow ${name}'s official announcements, note any snapshot or eligibility date the day it is posted, and be ready to claim inside the window, because unclaimed allocations usually expire (5 minutes a week).`,
  ];
}

// ---------------------------------------------------------------------------
// Board assembly
// ---------------------------------------------------------------------------

export const BOARD_ROWS = 200;

export function buildBoard(
  snapshot: Snapshot,
  rowCount: number = BOARD_ROWS,
): { rows: BoardRow[]; meta: BoardMeta } {
  const table = peerRatios(snapshot.protocols);
  const watchlist = new Set(snapshot.watchlist);
  const preToken = snapshot.protocols.filter(isPreToken);
  const valued = preToken.map((p) => valueProtocol(p, table, snapshot.as_of));

  const onList = valued.filter((v) => watchlist.has(v.protocol.slug));
  const belowFloor = valued
    .filter((v) => !watchlist.has(v.protocol.slug))
    .sort((a, b) => {
      if (b.value !== a.value) return b.value - a.value;
      if (b.protocol.tvl_usd !== a.protocol.tvl_usd) {
        return b.protocol.tvl_usd - a.protocol.tvl_usd;
      }
      return a.protocol.slug < b.protocol.slug ? -1 : 1;
    });
  // The board is clean launches only: every watchlist protocol, then every
  // clean pre-token protocol below the floor. A wrapped, staked or bridged
  // product gets no row, however large its TVL, because it is not a launch.
  const cleanBelow = belowFloor.filter((v) => isClean(v.protocol));
  const picked = [...onList, ...cleanBelow].slice(0, rowCount);

  picked.sort((a, b) => {
    if (b.value !== a.value) return b.value - a.value;
    if (b.protocol.tvl_usd !== a.protocol.tvl_usd) {
      return b.protocol.tvl_usd - a.protocol.tvl_usd;
    }
    return a.protocol.slug < b.protocol.slug ? -1 : 1;
  });

  // Ranks must be exactly 1..N and values must not rise with rank. After
  // rounding, two rows can tie; nudge the later one down by a dollar so the
  // board stays strictly decreasing. The nudge is at most a few dollars on
  // values in the millions, and the formula value is kept beside it.
  let previous = Number.POSITIVE_INFINITY;
  const rows: BoardRow[] = picked.map((v, index) => {
    const p = v.protocol;
    let value = v.value;
    if (value >= previous) value = previous - 1;
    if (value < 1) value = 1;
    previous = value;
    const chain = p.chains.length > 0 ? p.chains[0] : "Ethereum";
    return {
      slug: p.slug,
      name: p.name,
      rank: index + 1,
      implied_value_usd: value,
      farm_steps: farmSteps(p.name, p.category, chain),
      category: p.category ?? "Uncategorized",
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      change_7d: p.change_7d,
      listed_at: p.listed_at,
      months_listed: v.monthsListed,
      peer_ratio: v.peerRatio,
      peer_count: v.peerCount,
      growth_factor: v.growthFactor,
      age_factor: v.ageFactor,
      on_watchlist: watchlist.has(p.slug),
      formula_value_usd: v.value,
    };
  });

  const meta: BoardMeta = {
    as_of: snapshot.as_of,
    floor_usd: snapshot.floor_usd,
    protocols_total: snapshot.protocols.length,
    pre_token_total: preToken.length,
    watchlist_total: snapshot.watchlist.length,
    rows_total: rows.length,
    global_median_ratio: table.globalMedian,
    peer_table: table.byCategory,
  };
  return { rows, meta };
}

// ---------------------------------------------------------------------------
// Presentation helpers shared by the dashboard build
// ---------------------------------------------------------------------------

export function formatUsd(value: number): string {
  if (value >= 1_000_000_000) return "$" + (value / 1_000_000_000).toFixed(2) + "B";
  if (value >= 1_000_000) return "$" + (value / 1_000_000).toFixed(1) + "M";
  if (value >= 1_000) return "$" + (value / 1_000).toFixed(1) + "K";
  return "$" + Math.round(value);
}

export function formatSignedPct(value: number | null): string {
  if (value === null) return "n/a";
  const sign = value > 0 ? "+" : "";
  return sign + value.toFixed(1) + "%";
}
