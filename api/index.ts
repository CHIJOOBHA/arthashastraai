/** Vercel serverless entry: all /api/* requests are handled by the Express app. */
import { createApp } from "../server/app.js";

const app = createApp();
export default app;
