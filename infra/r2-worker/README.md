# Cloudflare R2 Presign Worker

This worker generates presigned AWS SigV4 **PUT** URLs for uploading files to Cloudflare R2.

## Environment Variables

Set the following environment variables (e.g., via `wrangler secret put`):

- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET` (e.g., `sansotec-files`)

## Example `wrangler.toml`

```toml
name = "sansotec-r2-presign"
main = "worker.js"
compatibility_date = "2024-05-01"

[vars]
R2_ACCOUNT_ID = "${R2_ACCOUNT_ID}"
R2_ACCESS_KEY_ID = "${R2_ACCESS_KEY_ID}"
R2_SECRET_ACCESS_KEY = "${R2_SECRET_ACCESS_KEY}"
R2_BUCKET = "sansotec-files"

[env.production]
workers_dev = true
```

After deploying, the worker will be available on Workers.dev. For example:

```
https://sansotec-upload.workers.dev/presign
```

Deploy the worker with:

```bash
wrangler deploy
```

## Testing the Endpoint

```bash
curl -X POST https://sansotec-upload.workers.dev/presign \
  -H "content-type: application/json" \
  -d '{
    "filename": "example.pdf",
    "contentType": "application/pdf"
  }'
```

The response includes `uploadUrl`, `publicUrl`, and the generated object `key`.
