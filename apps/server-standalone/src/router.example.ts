// Full monorepo integration example
// This file shows how to use ALL existing routers from apps/server/src/routers/
// Uncomment the imports you need and update src/router.ts accordingly

// Async routers (no database required for some)
import { asyncRouter } from '../../server/src/routers/async';
// Tools routers (may require API keys)
import { toolsRouter } from '../../server/src/routers/tools';
import { router } from './context.js';

// Lambda routers (require database, redis, full infrastructure)
// import { lambdaRouter } from '../../server/src/routers/lambda';

export const fullRouter = router({
  async: asyncRouter,
  tools: toolsRouter,
  // lambda: lambdaRouter, // Uncomment when database is configured
});
