export interface Env {
  R2_ACCOUNT_ID: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  R2_BUCKET: string;
}

const ALLOWED_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

const HEX_CHARS = Array.from({ length: 16 }, (_, i) => i.toString(16));

function toHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let out = "";
  for (const byte of bytes) {
    out += HEX_CHARS[byte >>> 4];
    out += HEX_CHARS[byte & 0xf];
  }
  return out;
}

async function hmac(key: ArrayBuffer | CryptoKey, data: string): Promise<ArrayBuffer> {
  const enc = new TextEncoder();
  const keyObj =
    key instanceof CryptoKey
      ? key
      : await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", keyObj, enc.encode(data));
}

async function sha256(data: string): Promise<string> {
  const enc = new TextEncoder();
  const hash = await crypto.subtle.digest("SHA-256", enc.encode(data));
  return toHex(hash);
}

function sanitizeFilename(filename: string): string {
  const baseName = filename.split("/").pop() ?? "upload";
  const sanitized = baseName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return sanitized.length > 0 ? sanitized : "upload";
}

function formatDate(date: Date): { amzDate: string; shortDate: string; folder: string } {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const min = String(date.getUTCMinutes()).padStart(2, "0");
  const ss = String(date.getUTCSeconds()).padStart(2, "0");
  return {
    amzDate: `${yyyy}${mm}${dd}T${hh}${min}${ss}Z`,
    shortDate: `${yyyy}${mm}${dd}`,
    folder: `${yyyy}-${mm}-${dd}`,
  };
}

function encodeRfc3986(str: string): string {
  return encodeURIComponent(str)
    .replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(/%2F/gi, "/");
}

function createKey(folder: string, filename: string): string {
  const randomBytes = new Uint8Array(4);
  crypto.getRandomValues(randomBytes);
  const randomHex = Array.from(randomBytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${folder}/${randomHex}-${filename}`;
}

function buildPublicUrl(accountId: string, bucket: string, key: string): string {
  return `https://${accountId}.r2.cloudflarestorage.com/${bucket}/${encodeRfc3986(key)}`;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== "POST") {
      return new Response("Not Found", { status: 404 });
    }

    const url = new URL(request.url);
    if (url.pathname !== "/presign") {
      return new Response("Not Found", { status: 404 });
    }

    if (!env.R2_ACCOUNT_ID || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY || !env.R2_BUCKET) {
      return new Response("Missing R2 configuration", { status: 500 });
    }

    let body: { filename?: string; contentType?: string };
    try {
      body = await request.json();
    } catch (error) {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const filename = typeof body.filename === "string" ? body.filename : "";
    const contentType = typeof body.contentType === "string" ? body.contentType : "";

    if (!filename || !contentType) {
      return new Response(JSON.stringify({ error: "filename and contentType are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
      return new Response(JSON.stringify({ error: "Unsupported contentType" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const sanitizedFilename = sanitizeFilename(filename);
    const now = new Date();
    const { amzDate, shortDate, folder } = formatDate(now);
    const key = createKey(folder, sanitizedFilename);

    const host = `${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
    const canonicalUri = `/${env.R2_BUCKET}/${encodeRfc3986(key)}`;

    const credentialScope = `${shortDate}/auto/r2/aws4_request`;
    const baseQueryParams: Record<string, string> = {
      "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
      "X-Amz-Credential": `${env.R2_ACCESS_KEY_ID}/${credentialScope}`,
      "X-Amz-Date": amzDate,
      "X-Amz-Expires": "600",
      "X-Amz-SignedHeaders": "host",
      "X-Amz-Content-Sha256": "UNSIGNED-PAYLOAD",
    };

    const canonicalQuery = Object.entries(baseQueryParams)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${encodeRfc3986(key)}=${encodeRfc3986(value)}`)
      .join("&");

    const canonicalHeaders = `host:${host}\n`;
    const signedHeaders = "host";
    const payloadHash = "UNSIGNED-PAYLOAD";

    const canonicalRequest = [
      "PUT",
      canonicalUri,
      canonicalQuery,
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join("\n");

    const hashedCanonicalRequest = await sha256(canonicalRequest);

    const stringToSign = [
      "AWS4-HMAC-SHA256",
      amzDate,
      credentialScope,
      hashedCanonicalRequest,
    ].join("\n");

    const enc = new TextEncoder();
    const kDate = await hmac(enc.encode(`AWS4${env.R2_SECRET_ACCESS_KEY}`), shortDate);
    const kRegion = await hmac(kDate, "auto");
    const kService = await hmac(kRegion, "r2");
    const kSigning = await hmac(kService, "aws4_request");
    const signature = toHex(await hmac(kSigning, stringToSign));

    const finalQuery = [
      ...Object.entries(baseQueryParams),
      ["X-Amz-Signature", signature],
    ]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${encodeRfc3986(key)}=${encodeRfc3986(value)}`)
      .join("&");

    const uploadUrl = `https://${host}${canonicalUri}?${finalQuery}`;
    const publicUrl = buildPublicUrl(env.R2_ACCOUNT_ID, env.R2_BUCKET, key);

    return new Response(
      JSON.stringify({
        uploadUrl,
        publicUrl,
        key,
      }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  },
};
