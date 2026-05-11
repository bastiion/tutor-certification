import { serve } from "bun";
import index from "./index.html";

const parsed = Number.parseInt(process.env.PORT ?? "", 10);
const port = Number.isFinite(parsed) && parsed > 0 ? parsed : 3000;

const server = serve({
  port,
  routes: {
    "/*": index,
  },

  development: process.env.NODE_ENV !== "production" && {
    hmr: true,
    console: true,
  },
});

console.log(`🚀 Server running at ${server.url}`);
