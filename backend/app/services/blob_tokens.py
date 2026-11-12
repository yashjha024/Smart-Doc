"""Client upload tokens for Vercel Blob, so browsers upload straight to Blob
(Vercel functions only accept 4.5 MB request bodies).

The Python SDK can't mint these, so this ports `generateClientTokenFromReadWriteToken`
from @vercel/blob (packages/blob/src/client.ts):
  payload  = base64(JSON({pathname, validUntil, maximumSizeInBytes, ...}))
  sig      = hex(HMAC-SHA256(key=read-write token, data=payload))
  token    = "vercel_blob_client_<storeId>_" + base64(sig + "." + payload)
The browser library (@vercel/blob/client upload()) calls our endpoint with
{"type": "blob.generate-client-token", "payload": {"pathname": ...}} and expects
{"type": "blob.generate-client-token", "clientToken": ...} back.
"""
import base64
import hashlib
import hmac
import json
import time


def generate_client_token(read_write_token: str, pathname: str, *, maximum_size_in_bytes: int,
                          valid_for_seconds: int = 600) -> str:
    parts = read_write_token.split("_")
    if len(parts) < 5 or parts[0] != "vercel" or parts[2] != "rw":
        raise ValueError("BLOB_READ_WRITE_TOKEN is not a Vercel Blob read-write token.")
    store_id = parts[3]
    payload = {
        "pathname": pathname,
        "validUntil": int(time.time() * 1000) + valid_for_seconds * 1000,
        "maximumSizeInBytes": maximum_size_in_bytes,
        "addRandomSuffix": False,
        "allowOverwrite": False,
    }
    payload_b64 = base64.b64encode(json.dumps(payload, separators=(",", ":")).encode()).decode()
    signature = hmac.new(read_write_token.encode(), payload_b64.encode(), hashlib.sha256).hexdigest()
    return f"vercel_blob_client_{store_id}_" + base64.b64encode(f"{signature}.{payload_b64}".encode()).decode()
