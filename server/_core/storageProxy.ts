import type { Express } from "express";
import express from "express";
import path from "path";
import { ENV } from "./env";

// Keys the remote storage could not serve: answered with 404 straight away and
// logged once, instead of a remote round trip and a log line on every request.
const unavailableKeys = new Set<string>();

export function registerStorageProxy(app: Express) {
  // Serve local copies from <project>/local-storage first; fall back to Manus storage
  app.use("/manus-storage", express.static(path.resolve(process.cwd(), "local-storage")));

  app.get("/manus-storage/*", async (req, res) => {
    const key = (req.params as Record<string, string>)[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }

    if (!ENV.forgeApiUrl || !ENV.forgeApiKey || unavailableKeys.has(key)) {
      res.status(404).send("Not found in local-storage");
      return;
    }

    try {
      const forgeUrl = new URL(
        "v1/storage/presign/get",
        ENV.forgeApiUrl.replace(/\/+$/, "") + "/",
      );
      forgeUrl.searchParams.set("path", key);

      const forgeResp = await fetch(forgeUrl, {
        headers: { Authorization: `Bearer ${ENV.forgeApiKey}` },
      });

      if (!forgeResp.ok) {
        const body = await forgeResp.text().catch(() => "");
        unavailableKeys.add(key);
        console.warn(`[StorageProxy] ${key} is not in local-storage and remote storage answered ${forgeResp.status}; serving 404 from now on. ${body.slice(0, 120)}`);
        res.status(404).send("Not found in local-storage");
        return;
      }

      const { url } = (await forgeResp.json()) as { url: string };
      if (!url) {
        res.status(502).send("Empty signed URL from backend");
        return;
      }

      res.set("Cache-Control", "no-store");
      res.redirect(307, url);
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      res.status(502).send("Storage proxy error");
    }
  });
}
