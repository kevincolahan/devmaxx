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
    // CONFIRMED WORKING
    'https://games.roblox.com/v1/games?universeIds=3956818381',
    'https://catalog.roblox.com/v1/search/items?category=Game&keyword=tycoon&limit=10',
    'https://apis.roblox.com/explore-api/v1/get-sorts?sessionId=test',
    // NEW: place → universe conversion
    'https://apis.roblox.com/universes/v1/places/1818/universe',
    // NEW: explore-api get-games
    'https://apis.roblox.com/explore-api/v1/get-games?gameSetTypeId=23&gameSetTargetId=504&maxRows=10',
    // NEW: economy game passes
    'https://economy.roblox.com/v2/universes/3956818381/game-passes?limit=10&sortOrder=Asc',
    // NEW: user socials
    'https://accountinformation.roblox.com/v1/users/1/promotion-channels',
    // CONFIRMED DEAD (kept for reference)
    'https://games.roblox.com/v1/games/list?model.keyword=tycoon&model.maxRows=10&model.startRows=0&model.gameFilter=0',
    'https://games.roblox.com/v1/games/3956818381/game-passes?limit=10&sortOrder=Asc',
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
