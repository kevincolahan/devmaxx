import { Router } from 'express';
import { db } from '../lib/db';
import { runCreatorProspectingPipeline } from '../agents/creator-prospecting';
import { withTimeout, BATCH_JOB_TIMEOUT_MS } from '../lib/timeout';

export const creatorProspectingRouter = Router();

creatorProspectingRouter.post('/', async (_req, res) => {
  try {
    const result = await withTimeout(
      runCreatorProspectingPipeline(db),
      BATCH_JOB_TIMEOUT_MS,
      'CreatorProspecting:manual'
    );

    res.json({
      success: true,
      prospectsFound: result.prospectsFound,
      prospectsScored: result.prospectsStored,
      outreachQueued: result.outreachQueued,
      gamesScanned: result.gamesScanned,
      errors: result.errors,
    });
  } catch (err) {
    console.error('CreatorProspectingAgent manual trigger failed:', err);
    res.status(500).json({ error: 'Agent run failed', details: String(err) });
  }
});

// Diagnostic: test which Roblox API endpoints are reachable from Railway
creatorProspectingRouter.get('/test-apis', async (_req, res) => {
  const urls = [
    'https://games.roblox.com/v1/games?universeIds=1818',
    'https://games.roblox.com/v1/games/list?model.keyword=tycoon&model.maxRows=10&model.startRows=0&model.gameFilter=0',
    'https://games.roblox.com/v1/games/sorts?model.gameSortsContext=HomeSorts',
    'https://games.roblox.com/v1/games/1818/game-passes?limit=10&sortOrder=Asc',
    'https://apis.roblox.com/explore-api/v1/get-sorts?sessionId=test',
    'https://catalog.roblox.com/v1/search/items?category=Game&keyword=tycoon&limit=10',
    'https://apis.roblox.com/search-api/omni-search?searchQuery=tycoon&pageType=all',
    'https://develop.roblox.com/v1/universes?ids=1818',
  ];

  const results: Array<{ url: string; status: number | string; body: string }> = [];

  for (const url of urls) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10_000);
      const r = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      const body = await r.text();
      results.push({ url, status: r.status, body: body.slice(0, 300) });
    } catch (err) {
      results.push({ url, status: `ERROR: ${String(err)}`, body: '' });
    }
  }

  res.json({ results });
});
