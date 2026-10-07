const NEA_PM25_ENDPOINT = 'https://api-open.data.gov.sg/v2/real-time/api/pm25';

export async function fetchPm25Data(date) {
  const dateParam = typeof date === 'string' && date.trim() ? `?date=${encodeURIComponent(date.trim())}` : '';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(`${NEA_PM25_ENDPOINT}${dateParam}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`NEA PM2.5 API responded with HTTP ${response.status}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

export default async function pm25Handler(req, res) {
  try {
    const data = await fetchPm25Data(req.query?.date);
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.status(200).json(data);
  } catch (error) {
    res.status(502).json({
      code: -1,
      errorMsg: error instanceof Error ? error.message : 'Failed to fetch NEA PM2.5 data',
    });
  }
}
