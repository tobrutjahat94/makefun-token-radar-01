# Token Launch Radar

The best token launch radar: a program that reads a sealed snapshot of every
protocol DefiLlama tracks, works out which ones still record no token and are
not a wrapped or staked product of one that trades, and ranks them by what
their launch would be worth — then hands in a web dashboard with the board, a
detail view for each protocol, and the steps to farm it.

## The model

```
implied value = TVL × peer ratio (category) × growth × age
```

- **Peer ratio.** Each category's live-token protocols (tokens that already
  trade) give the median market-cap-per-TVL. Thin categories are shrunk
  toward the global median: (n × category median + 5 × global median) / (n + 5),
  clamped to 0.01–3.00. No live-token peer means the global median.
- **Growth.** 1 + 0.5 × 7-day TVL change, change clamped to ±30%.
- **Age.** 0.90 + 0.10 × min(months listed, 48) / 48. An overdue launch is
  worth a little more; age never outruns TVL.
- **What is ranked.** Only clean pre-token protocols: no CoinGecko id and no
  ticker in the snapshot, no version suffix, not a bridge, liquid-staking,
  restaking or CEX product, no wrapped/staked word, not named after an
  exchange. The board covers the whole 40-protocol watchlist, then the clean
  pre-token protocols below the $50M floor: 198 rows in all.
- **Farm plans.** Seven concrete steps per protocol, built from its category,
  primary chain and name, each with a cost or a time. The dashboard rebuilds
  the same steps from the same templates, so the page and the board agree.

Implied values are this entry's claim, never a promise. The snapshot records
no token; it does not prove a protocol has none.

## Run it

```
MAKEFUN_OUTPUT_DIR=out node main.ts --input <kit>/input/snapshot.json
```

Node 22 or later, standard library only. The run writes `board.json`,
`dashboard/` (with `data.js`), `screenshots/` and `dossier.json` to the
output directory. Run it twice: the bytes are identical.

## Files

- `main.ts` — entrypoint: reads the snapshot, writes the output set.
- `lib/model.ts` — the value model, the farm-plan templates, the board.
- `vendor/makefun-board.ts` — the kit's dossier library, byte for byte.
- `dashboard/` — the static page: `index.html`, `app.css`, `app.js`
  (renders `data.js`, no network).
- `screenshots/` — the board, a protocol detail view, and a filtered view.
- `.makefun/owner.json` — the wallet this entry is claimed with.

## License

MIT. See LICENSE.
