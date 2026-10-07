import { Router } from 'express';
import healthHandler from './health.js';
import psiHandler from './psi.js';
import pm25Handler from './pm25.js';
import airQualityHandler from './air-quality.js';

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

export default apiRouter;
