# Cloudflare R2 Presign Worker

This worker exposes a `/presign` endpoint that returns presigned PUT URLs for uploading files to Cloudflare R2.

## Bucket configuration

- Bucket name: `sansotec-files`

## Required environment variables

- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET`

## Example `wrangler.toml`

```toml
name = "sansotec-r2-presign"
main = "src/index.ts"
compatibility_date = "2024-05-01"

[vars]
R2_ACCOUNT_ID = "${R2_ACCOUNT_ID}"
R2_ACCESS_KEY_ID = "${R2_ACCESS_KEY_ID}"
R2_SECRET_ACCESS_KEY = "${R2_SECRET_ACCESS_KEY}"
R2_BUCKET = "sansotec-files"

[dev]
port = 8787

[triggers]
crons = []

[env.production]
route = "sansotec-upload.workers.dev"
```

With this configuration, the presign endpoint would be available at:

```
https://sansotec-upload.workers.dev/presign
```

## Testing the endpoint

Use `curl` to request a presigned URL:

```bash
curl -X POST \
  https://sansotec-upload.workers.dev/presign \
  -H "Content-Type: application/json" \
  -d '{"filename":"example.pdf","contentType":"application/pdf"}'
```

The response includes the `uploadUrl`, `publicUrl`, and `key` fields that can be used to upload the file directly to R2.
