# Bounty Hunter

Wild-west insurance lead board for San Francisco property agents — *customer acquisition on the frontier.*

Rank underinsured homeowners on a Mapbox map, review coverage gaps, chat with AI personas, and pursue leads into Orange Slice outbound with Slack alerts.

**Full guide:** [docs/BOUNTY_HUNTER.md](./docs/BOUNTY_HUNTER.md)

---

## Quick start

```bash
cp .env.local.example .env.local   # Mapbox, Google Maps, Convex URL
npm install
npm run convex:dev                 # terminal 1
npm run dev                        # terminal 2 → localhost:3000
./scripts/import-insurance-leads.sh
```

## Deploy (local machine only)

GitHub stores **static code**. Production is deployed manually from your computer:

```bash
npx convex deploy -y
npx vercel --prod
```

Do not assume Git push triggers hosting unless you configure that yourself.

## Match score

**Risk (45) + Timing (30) + Fit (25) = 100**

Fit is census-based household receptivity (`acsReceptivityScore`). See [docs/BOUNTY_HUNTER.md#match-scoring-45--30--25](./docs/BOUNTY_HUNTER.md#match-scoring-45--30--25).

## Docs

| File | Topic |
|------|-------|
| [docs/BOUNTY_HUNTER.md](./docs/BOUNTY_HUNTER.md) | Architecture, deploy, scoring, env vars |
| [BRIEF.md](./BRIEF.md) | Product brief |
| [docs/DATA_INTEGRATION.md](./docs/DATA_INTEGRATION.md) | Lead import |
| [docs/ORANGE_SLICE_INSURANCE.md](./docs/ORANGE_SLICE_INSURANCE.md) | Outbound pipeline |
| [scoring/SCORING.md](./scoring/SCORING.md) | Python ETL |
