const NEA_ENDPOINTS = {
  psi: 'https://api-open.data.gov.sg/v2/real-time/api/psi',
  pm25: 'https://api-open.data.gov.sg/v2/real-time/api/pm25',
};

async function probeEndpoint(name, url) {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const latencyMs = Date.now() - start;

    if (!res.ok) {
      return {
        name,
        endpoint: url,
        status: 'DEGRADED',
        httpStatus: res.status,
        latencyMs,
        dataTimestamp: null,
        error: `HTTP ${res.status} ${res.statusText}`,
      };
    }

    const json = await res.json();
    const isCodeValid = json && json.code === 0 && json.data && Array.isArray(json.data.items);
    const latestItem = isCodeValid && json.data.items.length > 0 ? json.data.items[0] : null;

    return {
      name,
      endpoint: url,
      status: isCodeValid ? 'NOMINAL' : 'DEGRADED',
      httpStatus: res.status,
      latencyMs,
      code: json?.code ?? null,
      regionsCount: json?.data?.regionMetadata?.length ?? 0,
      dataTimestamp: latestItem?.timestamp ?? null,
      updatedTimestamp: latestItem?.updatedTimestamp ?? null,
      error: isCodeValid ? null : (json?.errorMsg || 'Invalid payload structure'),
    };
  } catch (err) {
    return {
      name,
      endpoint: url,
      status: 'OFFLINE',
      httpStatus: 0,
      latencyMs: Date.now() - start,
      dataTimestamp: null,
      error: err instanceof Error ? err.message : 'Network error',
    };
  }
}

export async function getApiHealthReport() {
  const checkedAt = new Date().toISOString();
  const [psiProbe, pm25Probe] = await Promise.all([
    probeEndpoint('NEA 24-Hr PSI & Sub-Indices API', NEA_ENDPOINTS.psi),
    probeEndpoint('NEA 1-Hr PM2.5 Real-Time API', NEA_ENDPOINTS.pm25),
  ]);

  const allNominal = psiProbe.status === 'NOMINAL' && pm25Probe.status === 'NOMINAL';
  const anyOffline = psiProbe.status === 'OFFLINE' || pm25Probe.status === 'OFFLINE';

  return {
    overallStatus: allNominal ? 'NOMINAL' : anyOffline ? 'CRITICAL' : 'DEGRADED',
    checkedAt,
    averageLatencyMs: Math.round((psiProbe.latencyMs + pm25Probe.latencyMs) / 2),
    services: {
      psi: psiProbe,
      pm25: pm25Probe,
    },
  };
}

export default async function healthHandler(req, res) {
  try {
    const report = await getApiHealthReport();
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.status(200).json(report);
  } catch (error) {
    res.status(500).json({
      overallStatus: 'CRITICAL',
      checkedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unexpected health check failure',
    });
  }
}
