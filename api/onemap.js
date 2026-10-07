const ONEMAP_TOKEN_URL = 'https://www.onemap.gov.sg/api/auth/post/getToken';
const ONEMAP_SEARCH_URL = 'https://www.onemap.gov.sg/api/common/elastic/search';
const ONEMAP_REVGEOCODE_URL = 'https://www.onemap.gov.sg/api/public/revgeocode';

// In-memory cache for the 3-day OneMap JWT token
let cachedToken = null;
let cachedExpiryMs = 0;

/**
 * Helper to resolve a pre-minted token from Vercel Environment Variables if provided
 */
function getEnvToken() {
  return (
    process.env.ONEMAP_TOKEN ||
    process.env.ONEMAP_API_TOKEN ||
    process.env.ONEMAP_ACCESS_TOKEN ||
    process.env.VITE_ONEMAP_TOKEN ||
    null
  );
}

/**
 * Retrieves the OneMap API token from Vercel Environment Variables (`ONEMAP_TOKEN`)
 * or mints a fresh 3-day token via POST https://www.onemap.gov.sg/api/auth/post/getToken
 * if `ONEMAP_EMAIL` & `ONEMAP_PASSWORD` are set.
 */
export async function getOneMapToken({ forceRefresh = false } = {}) {
  const now = Date.now();

  // 1. Check in-memory cached token first
  if (!forceRefresh && cachedToken && cachedExpiryMs > now + 5 * 60 * 1000) {
    return {
      access_token: cachedToken,
      expiry_timestamp: Math.floor(cachedExpiryMs / 1000),
      source: 'memory_cache',
    };
  }

  // 2. Check Vercel Environment Variable token (ONEMAP_TOKEN)
  const envToken = getEnvToken();
  if (!forceRefresh && envToken) {
    return {
      access_token: envToken,
      expiry_timestamp: null,
      source: 'vercel_env_token',
    };
  }

  // 3. Otherwise, mint a 3-day token using ONEMAP_EMAIL and ONEMAP_PASSWORD
  const resolvedEmail = process.env.ONEMAP_EMAIL;
  const resolvedPassword = process.env.ONEMAP_PASSWORD;

  if (!resolvedEmail || !resolvedPassword) {
    if (envToken) {
      return {
        access_token: envToken,
        expiry_timestamp: null,
        source: 'vercel_env_token',
      };
    }
    throw new Error(
      'OneMap token not configured yet. Add ONEMAP_TOKEN (or ONEMAP_EMAIL & ONEMAP_PASSWORD) in Vercel Environment Variables.'
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(ONEMAP_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        email: resolvedEmail,
        password: resolvedPassword,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const data = await response.json();

    if (!response.ok || !data?.access_token) {
      throw new Error(
        data?.error || data?.message || `OneMap token minting failed (HTTP ${response.status})`
      );
    }

    cachedToken = data.access_token;
    const expirySeconds = Number(data.expiry_timestamp);
    cachedExpiryMs =
      !Number.isNaN(expirySeconds) && expirySeconds > 0
        ? expirySeconds * 1000
        : now + 3 * 24 * 60 * 60 * 1000;

    return {
      access_token: cachedToken,
      expiry_timestamp: data.expiry_timestamp,
      source: 'minted_from_credentials',
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function getOneMapTokenStatus() {
  const hasEnvToken = Boolean(getEnvToken());
  const hasEnvCredentials = Boolean(process.env.ONEMAP_EMAIL && process.env.ONEMAP_PASSWORD);
  const now = Date.now();
  const isTokenCachedAndValid = Boolean(cachedToken && cachedExpiryMs > now);

  return {
    endpoint: ONEMAP_TOKEN_URL,
    configured: hasEnvToken || hasEnvCredentials || isTokenCachedAndValid,
    tokenCached: hasEnvToken || isTokenCachedAndValid,
    source: hasEnvToken
      ? 'ONEMAP_TOKEN (Vercel Env)'
      : isTokenCachedAndValid
      ? 'Auto-Minted 3-Day Token'
      : hasEnvCredentials
      ? 'ONEMAP_EMAIL/PASSWORD Ready'
      : 'Awaiting Vercel Env Var',
    expiresAt: isTokenCachedAndValid ? new Date(cachedExpiryMs).toISOString() : null,
  };
}

/**
 * Serverless & Express handler for /api/onemap
 * Supports:
 * - GET /api/onemap?action=search&searchVal=...
 * - GET /api/onemap?action=revgeocode&location=lat,lng
 * - GET /api/onemap (returns token configuration status)
 * - POST /api/onemap (triggers token refresh from env vars)
 */
export async function oneMapTokenHandler(req, res) {
  try {
    const result = await getOneMapToken({ forceRefresh: Boolean(req.body?.forceRefresh) });
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.status(200).json({
      status: 'OK',
      source: result.source,
      expiry_timestamp: result.expiry_timestamp,
      tokenPreview: `${result.access_token.slice(0, 12)}...`,
    });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : 'Failed to resolve OneMap token',
    });
  }
}

export async function oneMapSearchHandler(req, res) {
  const searchVal = typeof req.query.searchVal === 'string' ? req.query.searchVal.trim() : '';
  if (!searchVal) {
    return res.status(400).json({ error: 'Query parameter "searchVal" is required' });
  }

  try {
    const headers = { Accept: 'application/json' };
    try {
      const tokenData = await getOneMapToken();
      if (tokenData?.access_token) {
        headers.Authorization = tokenData.access_token;
      }
    } catch {
      // Elastic search works with or without token
    }

    const url = `${ONEMAP_SEARCH_URL}?searchVal=${encodeURIComponent(searchVal)}&returnGeom=Y&getAddrDetails=Y&pageNum=1`;
    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`OneMap Search responded with HTTP ${response.status}`);
    }
    const data = await response.json();
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.status(200).json(data);
  } catch (error) {
    res.status(502).json({
      error: error instanceof Error ? error.message : 'OneMap address search failed',
    });
  }
}

export async function oneMapRevGeocodeHandler(req, res) {
  const location = typeof req.query.location === 'string' ? req.query.location.trim() : '';
  if (!location) {
    return res.status(400).json({ error: 'Query parameter "location" (lat,lng) is required' });
  }

  try {
    const tokenData = await getOneMapToken();
    const url = `${ONEMAP_REVGEOCODE_URL}?location=${encodeURIComponent(location)}&buffer=40&addressType=All&otherFeatures=N`;
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        Authorization: tokenData.access_token,
      },
    });

    if (!response.ok) {
      throw new Error(`OneMap Reverse Geocode responded with HTTP ${response.status}`);
    }

    const data = await response.json();
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.status(200).json(data);
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : 'OneMap reverse geocode failed',
    });
  }
}

export default async function onemapServerlessHandler(req, res) {
  if (req.method === 'POST') {
    return oneMapTokenHandler(req, res);
  }
  if (req.query?.searchVal) {
    return oneMapSearchHandler(req, res);
  }
  if (req.query?.location) {
    return oneMapRevGeocodeHandler(req, res);
  }
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  return res.status(200).json(getOneMapTokenStatus());
}
