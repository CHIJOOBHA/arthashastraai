/**
 * Local / Cloud Run entry point.
 *  - Development: Vite middleware serves the React app with hot reload.
 *  - Production:  serves the built app from dist/.
 *  - Optional built-in scheduler (AGENT_SCHEDULER_MINUTES) for long-running hosts.
 * On Vercel, api/index.ts is used instead and Vercel Cron triggers the agents.
 */
import "dotenv/config";
import path from "path";
import fs from "fs";
import express from "express";
import { createApp } from "./server/app.js";
import { config } from "./server/config.js";
import { runCycle } from "./server/agents.js";

process.on("unhandledRejection", (reason) => console.error("[process] Unhandled rejection:", reason));

async function main() {
  const app = createApp();

  if (!config.isProduction) {
    const { createServer } = await import("vite");
    const vite = await createServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const dist = path.resolve(process.cwd(), "dist");
    // Same security headers as on Vercel (single source of truth: vercel.json).
    try {
      const vercel = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), "vercel.json"), "utf8"));
      const global = (vercel.headers || []).find((h: any) => h.source === "/(.*)");
      if (global) app.use((_req, res, next) => (global.headers.forEach((h: any) => res.setHeader(h.key, h.value)), next()));
    } catch {
      /* vercel.json missing: run without extra headers */
    }
    app.use(express.static(dist, { index: false, maxAge: "1h" }));
    app.get("*", (_req, res) => res.sendFile(path.join(dist, "index.html")));
  }

  app.listen(config.port, "0.0.0.0", () => console.log(`[server] Arthashastra AI on http://localhost:${config.port}`));

  const minutes = parseInt(process.env.AGENT_SCHEDULER_MINUTES || "0", 10);
  if (minutes > 0) {
    console.log(`[server] Agent scheduler: one cycle every ${minutes} minutes.`);
    const tick = () => runCycle(minutes * 60_000 * 0.8).then((r) => console.log("[scheduler]", r)).catch((e) => console.error("[scheduler]", e));
    setTimeout(tick, 60_000);
    setInterval(tick, minutes * 60_000);
  }
}

main().catch((e) => {
  console.error("[server] failed to start:", e);
  process.exit(1);
});
