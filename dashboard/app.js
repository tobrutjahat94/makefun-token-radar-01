// app.js — Token Launch Radar dashboard.
//
// Renders window.RADAR (written by main.ts as data.js) with no network: the
// board, a detail view per protocol, filters and sorting. The farm steps
// shown here are built from the same templates as lib/model.ts, from the
// same three inputs (name, category, primary chain), so the page and the
// board agree step for step. This file runs in the browser; under Node (no
// document) only the pure functions load, so the steps can be checked
// against board.json without a browser.

// ---------------------------------------------------------------------------
// Farm plans — same templates as lib/model.ts. Keep them in sync: the
// verifier compares every board row's steps against these, byte for byte.
// ---------------------------------------------------------------------------

var PLAYS = {
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

var DEFAULT_PLAY = {
  first: "use the protocol's main product",
  asset: "position",
  second: "try a second feature of the same product",
};

function playFor(category) {
  if (category && PLAYS[category]) return PLAYS[category];
  return DEFAULT_PLAY;
}

function gasNote(chain) {
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

function farmSteps(name, category, chain) {
  var play = playFor(category);
  var gas = gasNote(chain);
  return [
    "Open a fresh wallet, bridge $200 in stablecoins to " + chain + " for farming, and keep enough aside for gas at " + gas + ". Use this wallet only for " + name + " so the activity stays clean (30–45 minutes to set up).",
    "Make a first move on " + name + ": " + play.first + " with $25–$50 only, confirm the receipt on " + chain + ", save the transaction hash, and check the position shows in the app (about 15 minutes).",
    "Scale up to a steady " + play.asset + ": put $100–$250 to work across 2–3 transactions over the coming week, so the activity reads as real use rather than a single burst (about 1 hour in total).",
    "Go one level deeper: " + play.second + " with part of the position, and leave it running for at least two weeks so the protocol records sustained use (30 minutes to set up).",
    "Come back every week for 6–8 weeks: repeat the main action once a week, and check " + name + " for points, quests or a leaderboard each visit so no task is missed (10 minutes a week).",
    "Stay safe: keep the farming position under 5% of your crypto, never use leverage you do not understand, and review and revoke token approvals once a month (10 minutes a month, no cost).",
    "Watch for the launch: follow " + name + "'s official announcements, note any snapshot or eligibility date the day it is posted, and be ready to claim inside the window, because unclaimed allocations usually expire (5 minutes a week).",
  ];
}

// ---------------------------------------------------------------------------
// Value model, recomputed here so the detail view shows its arithmetic.
// ---------------------------------------------------------------------------

function peerInfo(category) {
  var table = DATA.meta.peer_table;
  var stat = table ? table[category] : null;
  if (!stat) return { ratio: DATA.meta.global_median_ratio, peers: 0 };
  return { ratio: stat.shrunk, peers: stat.peers };
}

function growthOf(change) {
  var c = change === null || change === undefined ? 0 : Math.max(-30, Math.min(30, change));
  return 1 + 0.5 * (c / 100);
}

function ageOf(months) {
  return 0.9 + 0.1 * (Math.min(months, 48) / 48);
}

// ---------------------------------------------------------------------------
// Data and formatting
// ---------------------------------------------------------------------------

var DATA = typeof window !== "undefined" ? window.RADAR : null;

function toRow(a) {
  return {
    rank: a[0],
    slug: a[1],
    name: a[2],
    category: a[3],
    chain: a[4],
    chains: a[5],
    tvl: a[6],
    change: a[7],
    months: a[8],
    value: a[9],
    watch: a[10] === 1,
  };
}

function fmtUsd(value) {
  if (value >= 1000000000) return "$" + (value / 1000000000).toFixed(2) + "B";
  if (value >= 1000000) return "$" + (value / 1000000).toFixed(1) + "M";
  if (value >= 1000) return "$" + (value / 1000).toFixed(1) + "K";
  return "$" + Math.round(value);
}

function fmtInt(value) {
  return value.toLocaleString("en-US");
}

function fmtPct(value) {
  if (value === null || value === undefined) return "n/a";
  return (value > 0 ? "+" : "") + value.toFixed(1) + "%";
}

function esc(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ---------------------------------------------------------------------------
// Browser UI — only runs where document exists.
// ---------------------------------------------------------------------------

function init() {
  var rows = DATA.rows.map(toRow);
  var meta = DATA.meta;

  var metaBox = document.getElementById("metaBox");
  metaBox.innerHTML =
    "Snapshot <b>" + esc(meta.as_of) + "</b> · floor <b>" + fmtUsd(meta.floor_usd) + "</b>\n" +
    "<b>" + fmtInt(meta.rows_total) + "</b> rows · watchlist <b>" + meta.watchlist_total + "</b> · " +
    "pre-token <b>" + fmtInt(meta.pre_token_total) + "</b>\n" +
    "Global median mcap/TVL <b>" + meta.global_median_ratio.toFixed(3) + "</b>";

  var catSel = document.getElementById("cat");
  var cats = {};
  rows.forEach(function (r) { cats[r.category] = true; });
  Object.keys(cats).sort().forEach(function (c) {
    var opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    catSel.appendChild(opt);
  });

  var peerRows = document.getElementById("peerRows");
  var peerEntries = Object.keys(meta.peer_table || {}).map(function (c) {
    return { category: c, stat: meta.peer_table[c] };
  });
  peerEntries.sort(function (a, b) { return b.stat.peers - a.stat.peers; });
  var peerHtml = peerEntries.map(function (e) {
    return "<tr><td>" + esc(e.category) + "</td><td class=\"num\">" + e.stat.peers +
      "</td><td class=\"num\">" + e.stat.median.toFixed(3) +
      "</td><td class=\"num\">" + e.stat.shrunk.toFixed(3) + "</td></tr>";
  }).join("");
  peerHtml += "<tr><td>Categories with no live-token peer</td><td class=\"num\">0</td>" +
    "<td class=\"num\">—</td><td class=\"num\">" + meta.global_median_ratio.toFixed(3) +
    " (global median)</td></tr>";
  peerRows.innerHTML = peerHtml;

  var qInput = document.getElementById("q");
  var sortSel = document.getElementById("sort");
  var watchBox = document.getElementById("watch");
  var tbody = document.getElementById("rows");
  var countEl = document.getElementById("count");
  var boardView = document.getElementById("boardView");
  var detailView = document.getElementById("detailView");
  var detailEl = document.getElementById("detail");

  function currentFilter() {
    return {
      q: qInput.value.trim().toLowerCase(),
      cat: catSel.value,
      watch: watchBox.checked,
      sort: sortSel.value,
    };
  }

  function filteredRows() {
    var f = currentFilter();
    var list = rows.filter(function (r) {
      if (f.watch && !r.watch) return false;
      if (f.cat && r.category !== f.cat) return false;
      if (f.q && r.name.toLowerCase().indexOf(f.q) === -1 &&
          r.slug.toLowerCase().indexOf(f.q) === -1) return false;
      return true;
    });
    if (f.sort === "tvl") {
      list = list.slice().sort(function (a, b) { return b.tvl - a.tvl; });
    } else if (f.sort === "growth") {
      list = list.slice().sort(function (a, b) {
        return (b.change === null ? -999 : b.change) - (a.change === null ? -999 : a.change);
      });
    } else if (f.sort === "age") {
      list = list.slice().sort(function (a, b) { return b.months - a.months; });
    }
    return list;
  }

  function renderBoard() {
    var list = filteredRows();
    countEl.textContent = "Showing " + list.length + " of " + rows.length + " rows";
    tbody.innerHTML = list.map(function (r) {
      var chg = r.change === null ? "n/a" : fmtPct(r.change);
      var chgCls = r.change === null ? "" : (r.change >= 0 ? "up" : "down");
      return "<tr data-slug=\"" + esc(r.slug) + "\" class=\"" + (r.watch ? "watch" : "") + "\">" +
        "<td class=\"num\">" + r.rank + "</td>" +
        "<td>" + esc(r.name) + "<span class=\"slug\"> " + esc(r.slug) + "</span>" +
        (r.watch ? "<span class=\"badge\">WATCHLIST</span>" : "") + "</td>" +
        "<td>" + esc(r.category) + "</td>" +
        "<td>" + esc(r.chain) + (r.chains > 1 ? " +" + (r.chains - 1) : "") + "</td>" +
        "<td class=\"num\">" + fmtUsd(r.tvl) + "</td>" +
        "<td class=\"num " + chgCls + "\">" + chg + "</td>" +
        "<td class=\"num\"><b>" + fmtUsd(r.value) + "</b></td>" +
        "<td class=\"num\">" + r.months + " mo</td></tr>";
    }).join("");
  }

  function renderDetail(slug) {
    var r = null;
    rows.forEach(function (x) { if (x.slug === slug) r = x; });
    if (!r) {
      detailEl.innerHTML = "<p>Unknown protocol: " + esc(slug) + "</p>";
    } else {
      var info = peerInfo(r.category);
      var growth = growthOf(r.change);
      var age = ageOf(r.months);
      var formula = Math.round(r.tvl * info.ratio * growth * age);
      var steps = farmSteps(r.name, r.category, r.chain);
      detailEl.innerHTML =
        "<h2>" + esc(r.name) + " <span class=\"slug\">" + esc(r.slug) + "</span>" +
        (r.watch ? "<span class=\"badge\">WATCHLIST</span>" : "") + "</h2>" +
        "<p class=\"sub\">Rank #" + r.rank + " · " + esc(r.category) + " · " +
        esc(r.chain) + (r.chains > 1 ? " + " + (r.chains - 1) + " more chains" : "") +
        " · Records no token in the snapshot.</p>" +
        "<div class=\"stats\">" +
        "<div class=\"stat\"><div class=\"k\">Implied value</div><div class=\"v\">" + fmtUsd(r.value) + "</div></div>" +
        "<div class=\"stat\"><div class=\"k\">TVL</div><div class=\"v\">" + fmtUsd(r.tvl) + "</div></div>" +
        "<div class=\"stat\"><div class=\"k\">7-day change</div><div class=\"v\">" + fmtPct(r.change) + "</div></div>" +
        "<div class=\"stat\"><div class=\"k\">Months listed</div><div class=\"v\">" + r.months + "</div></div>" +
        "<div class=\"stat\"><div class=\"k\">Peer ratio (" + esc(r.category) + ")</div><div class=\"v\">" + info.ratio.toFixed(3) + " · " + info.peers + " peers</div></div>" +
        "</div>" +
        "<div class=\"math\">" + fmtUsd(r.tvl) + " TVL × " + info.ratio.toFixed(3) + " peer ratio" +
        " × " + growth.toFixed(3) + " growth × " + age.toFixed(3) + " age" +
        " = " + fmtUsd(formula) + " (model) → " + fmtUsd(r.value) + " ranked value</div>" +
        "<h3>How to farm it — 7 steps</h3>" +
        "<ol class=\"steps\">" + steps.map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("") + "</ol>" +
        "<h3>Why it ranks here</h3>" +
        "<p>" + esc(r.name) + " holds " + fmtUsd(r.tvl) + " in TVL with " +
        (r.change === null ? "no reported 7-day change" : "a 7-day change of " + fmtPct(r.change)) +
        ", has run " + r.months + " months, and records no token. Its category's live-token " +
        "peers trade at a median " + info.ratio.toFixed(3) + "× TVL" +
        (info.peers === 0 ? " (no live-token peer in this category, so the global median applies)" : " (" + info.peers + " live-token peers)") +
        ". The implied value is this radar's claim, not a promise: the snapshot records no token, it does not prove the protocol has none.</p>";
    }
    boardView.hidden = true;
    detailView.hidden = false;
    document.getElementById("modelView").hidden = true;
    document.getElementById("peersView").hidden = true;
    window.scrollTo(0, 0);
  }

  function showBoard() {
    boardView.hidden = false;
    detailView.hidden = true;
    document.getElementById("modelView").hidden = false;
    document.getElementById("peersView").hidden = false;
    renderBoard();
  }

  function route() {
    var hash = window.location.hash || "";
    var m = hash.match(/^#\/p\/(.+)$/);
    if (m) {
      renderDetail(decodeURIComponent(m[1]));
      return;
    }
    var c = hash.match(/^#\/c\/(.+)$/);
    if (c) {
      catSel.value = decodeURIComponent(c[1]);
      showBoard();
      return;
    }
    showBoard();
  }

  tbody.addEventListener("click", function (event) {
    var tr = event.target.closest("tr[data-slug]");
    if (tr) window.location.hash = "#/p/" + encodeURIComponent(tr.getAttribute("data-slug"));
  });
  document.getElementById("backBtn").addEventListener("click", function () {
    window.location.hash = "";
  });
  qInput.addEventListener("input", renderBoard);
  catSel.addEventListener("change", renderBoard);
  sortSel.addEventListener("change", renderBoard);
  watchBox.addEventListener("change", renderBoard);
  document.querySelectorAll("th[data-sort]").forEach(function (th) {
    th.addEventListener("click", function () {
      sortSel.value = th.getAttribute("data-sort");
      renderBoard();
    });
  });
  document.querySelectorAll(".crumbs button").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var routeName = btn.getAttribute("data-route");
      if (routeName === "model") {
        showBoard();
        document.getElementById("modelView").scrollIntoView();
      } else if (routeName === "peers") {
        showBoard();
        document.getElementById("peersView").scrollIntoView();
      } else {
        window.location.hash = "";
        window.scrollTo(0, 0);
      }
    });
  });
  window.addEventListener("hashchange", route);
  route();
}

if (typeof document !== "undefined" && typeof window !== "undefined" && window.RADAR) {
  init();
}
