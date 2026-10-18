/** Shared origin checks. PayPal webhooks use provider signature verification instead. */
export function mutationOriginAllowed(request: Request): boolean {
  if (request.headers.get('sec-fetch-site') === 'cross-site') return false;
  const origin = request.headers.get('origin');
  if (!origin) return true; // Non-browser API clients have no ambient browser credentials.
  try {
    const supplied=new URL(origin),target=new URL(request.url);
    // Next may normalize its internal URL to localhost. Host is the browser's
    // actual destination; do not accept client-supplied Forwarded-Host aliases.
    return supplied.protocol===target.protocol && supplied.host===(request.headers.get('host')||target.host);
  } catch { return false; }
}
