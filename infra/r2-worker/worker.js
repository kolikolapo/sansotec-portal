const ALLOWED_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

const TEXT_ENCODER = new TextEncoder();

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "content-type",
    },
  });
}

function sanitizeFilename(filename) {
  if (!filename || typeof filename !== "string") {
    return "file";
  }
  const normalized = filename.trim().replace(/\s+/g, "-");
  const sanitized = normalized.replace(/[^a-zA-Z0-9._-]/g, "");
  return sanitized.length > 0 ? sanitized : "file";
}

function formatDateParts(date = new Date()) {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const HH = String(date.getUTCHours()).padStart(2, "0");
  const MM = String(date.getUTCMinutes()).padStart(2, "0");
  const SS = String(date.getUTCSeconds()).padStart(2, "0");
  return {
    shortDate: `${yyyy}${mm}${dd}`,
    datePath: `${yyyy}-${mm}-${dd}`,
    amzDate: `${yyyy}${mm}${dd}T${HH}${MM}${SS}Z`,
  };
}

function toHex(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return hex;
}

function encodePath(path) {
  return path
    .split("/")
    .map((segment) =>
      encodeURIComponent(segment).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
    )
    .join("/");
}

function encodeRfc3986(value) {
  return encodeURIComponent(value)
    .replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(/%7E/g, "~");
}

async function hmac(key, data) {
  const algo = { name: "HMAC", hash: "SHA-256" };
  let cryptoKey;
  if (key instanceof CryptoKey) {
    cryptoKey = key;
  } else {
    cryptoKey = await crypto.subtle.importKey(
      "raw",
      key,
      algo,
      false,
      ["sign"]
    );
  }
  const buffer = typeof data === "string" ? TEXT_ENCODER.encode(data) : data;
  return crypto.subtle.sign(algo, cryptoKey, buffer);
}

async function getSignatureKey(secretKey, dateStamp, regionName, serviceName) {
  const kSecret = TEXT_ENCODER.encode(`AWS4${secretKey}`);
  const kDate = await hmac(kSecret, dateStamp);
  const kRegion = await hmac(kDate, regionName);
  const kService = await hmac(kRegion, serviceName);
  const kSigning = await hmac(kService, "aws4_request");
  return kSigning;
}

async function createPresignedUrl(env, key, contentType) {
  const { shortDate, amzDate } = formatDateParts();
  const region = "auto";
  const service = "s3";
  const host = `${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  const canonicalUri = `/${encodePath(env.R2_BUCKET)}/${encodePath(key)}`;

  const credentialScope = `${shortDate}/${region}/${service}/aws4_request`;
  const credential = `${env.R2_ACCESS_KEY_ID}/${credentialScope}`;

  const queryParams = new URLSearchParams({
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": credential,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": "600",
    "X-Amz-SignedHeaders": "host",
  });

  const canonicalQueryString = Array.from(queryParams.entries())
    .map(([k, v]) => `${encodeRfc3986(k)}=${encodeRfc3986(v)}`)
    .sort()
    .join("&");

  const canonicalHeaders = `host:${host}\n`;
  const signedHeaders = "host";
  const payloadHash = "UNSIGNED-PAYLOAD";

  const canonicalRequest = [
    "PUT",
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const hashBuffer = await crypto.subtle.digest("SHA-256", TEXT_ENCODER.encode(canonicalRequest));
  const hashedCanonicalRequest = toHex(hashBuffer);

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    `${shortDate}/${region}/${service}/aws4_request`,
    hashedCanonicalRequest,
  ].join("\n");

  const signingKey = await getSignatureKey(env.R2_SECRET_ACCESS_KEY, shortDate, region, service);
  const signature = toHex(await hmac(signingKey, stringToSign));

  const finalQuery = `${canonicalQueryString}&X-Amz-Signature=${signature}`;
  const baseUrl = `https://${host}${canonicalUri}`;
  const uploadUrl = `${baseUrl}?${finalQuery}`;
  const publicUrl = `https://${env.R2_BUCKET}.r2.dev/${encodePath(key)}`;

  return { uploadUrl, publicUrl, key };
}

function generateObjectKey(filename) {
  const { datePath } = formatDateParts();
  const randomBytes = crypto.getRandomValues(new Uint8Array(4));
  const randomHex = Array.from(randomBytes, (b) => b.toString(16).padStart(2, "0")).join("");
  const sanitized = sanitizeFilename(filename);
  return `${datePath}/${randomHex}-${sanitized}`;
}

async function handlePresign(request, env) {
  if (request.method === "OPTIONS") {
    return jsonResponse({ ok: true });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let body;
  try {
    body = await request.json();
  } catch (error) {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  const { filename, contentType } = body || {};

  if (!filename || typeof filename !== "string") {
    return jsonResponse({ error: "filename is required" }, 400);
  }

  if (!contentType || typeof contentType !== "string") {
    return jsonResponse({ error: "contentType is required" }, 400);
  }

  if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
    return jsonResponse({ error: "Unsupported contentType" }, 400);
  }

  const key = generateObjectKey(filename);

  try {
    const presign = await createPresignedUrl(env, key, contentType);
    return jsonResponse(presign);
  } catch (error) {
    return jsonResponse({ error: "Failed to generate presigned URL" }, 500);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== "/presign") {
      return jsonResponse({ error: "Not found" }, 404);
    }

    for (const field of ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"]) {
      if (!env[field]) {
        return jsonResponse({ error: `Missing required env: ${field}` }, 500);
      }
    }

    return handlePresign(request, env);
  },
};
