import { Router } from 'express';
import healthHandler from './health.js';
import psiHandler from './psi.js';
import pm25Handler from './pm25.js';
import airQualityHandler from './air-quality.js';
import {
  oneMapTokenHandler,
  oneMapSearchHandler,
  oneMapRevGeocodeHandler,
  getOneMapTokenStatus,
} from './onemap.js';

const apiRouter = Router();

// Health check endpoints
apiRouter.get('/health', healthHandler);
apiRouter.get('/health.js', healthHandler);

// Individual NEA PSI & PM2.5 endpoints
apiRouter.get('/psi', psiHandler);
apiRouter.get('/psi.js', psiHandler);
apiRouter.get('/pm25', pm25Handler);
apiRouter.get('/pm25.js', pm25Handler);

// Combined air quality snapshot endpoint
apiRouter.get('/air-quality', airQualityHandler);
apiRouter.get('/air-quality.js', airQualityHandler);

// Singapore OneMap Auth Token Minting (POST {"email":"...","password":"..."}; lasts 3 days)
apiRouter.post('/onemap/token', oneMapTokenHandler);
apiRouter.post('/onemap.js', oneMapTokenHandler);
apiRouter.get('/onemap/status', (_req, res) => {
  res.json(getOneMapTokenStatus());
});

// Singapore OneMap Postal Code / Address Search & Reverse Geocode
apiRouter.get('/onemap/search', oneMapSearchHandler);
apiRouter.get('/onemap/revgeocode', oneMapRevGeocodeHandler);

export default apiRouter;
