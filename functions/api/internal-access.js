// TEMPORARY diagnostic version.
// After confirming the IP, replace this with the normal version that does not expose clientIp.

export async function onRequestGet(context) {
  const clientIp = (context.request.headers.get("CF-Connecting-IP") || "").trim();
  const configured = (context.env.INTERNAL_ALLOWED_IPS || "").trim();

  const allowedIps = configured
    .split(",")
    .map((ip) => ip.trim())
    .filter(Boolean);

  const allowed = clientIp !== "" && allowedIps.includes(clientIp);

  return new Response(JSON.stringify({
    allowed,
    clientIp
  }), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=UTF-8",
      "cache-control": "no-store, no-cache, must-revalidate"
    }
  });
}
