// Cloudflare Pages Function
// Cloudflare Pages 설정의 환경변수 INTERNAL_ALLOWED_IPS에 허용할 공인 IP를 입력하세요.
// 여러 IP는 쉼표로 구분: 203.0.113.10,198.51.100.25
// CIDR 대역은 이 테스트 버전에서 지원하지 않습니다.

export async function onRequestGet(context) {
  const request = context.request;
  const env = context.env;

  const clientIp = (request.headers.get("CF-Connecting-IP") || "").trim();
  const configured = (env.INTERNAL_ALLOWED_IPS || "").trim();

  const allowedIps = configured
    .split(",")
    .map((ip) => ip.trim())
    .filter(Boolean);

  const allowed = clientIp !== "" && allowedIps.includes(clientIp);

  return new Response(JSON.stringify({ allowed }), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=UTF-8",
      "cache-control": "no-store, no-cache, must-revalidate"
    }
  });
}
