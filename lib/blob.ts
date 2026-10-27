import { get, put } from "@vercel/blob";

/**
 * Durable JSON storage.
 *
 * Locally the app writes plain files under data/. On Vercel the runtime
 * filesystem is read-only and each request may hit a different instance, so the
 * same documents live in a private Vercel Blob store. Presence of the store id
 * (or a read-write token) switches the backend — nothing else changes.
 */
export function blobEnabled(): boolean {
  return Boolean(process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN);
}

export async function blobRead<T>(pathname: string): Promise<T | null> {
  const result = await get(pathname, { access: "private", useCache: false });
  if (!result || result.statusCode !== 200) return null;
  const text = await new Response(result.stream).text();
  if (!text) return null;
  return JSON.parse(text) as T;
}

export async function blobWrite(pathname: string, value: unknown): Promise<void> {
  await put(pathname, JSON.stringify(value), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 0,
  });
}
