import { fetchPsiData } from './psi.js';
import { fetchPm25Data } from './pm25.js';

export default async function airQualityHandler(req, res) {
  try {
    const date = req.query?.date;
    const [psi, pm25] = await Promise.all([
      fetchPsiData(date),
      fetchPm25Data(date),
    ]);

    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.status(200).json({
      psi,
      pm25,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    res.status(502).json({
      error: error instanceof Error ? error.message : 'Failed to fetch NEA real-time air quality data',
    });
  }
}
