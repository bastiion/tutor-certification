import { serve } from "bun";
import tutorIndex from "./apps/tutor/index.html";
import participantIndex from "./apps/participant/index.html";
import verifyIndex from "./apps/verify/index.html";

const parsed = Number.parseInt(process.env.PORT ?? "", 10);
const port = Number.isFinite(parsed) && parsed > 0 ? parsed : 3000;

function redirect(location: string, status = 302): Response {
  return new Response(null, {
    status,
    headers: { Location: location },
  });
}

const server = serve({
  port,
  routes: {
    "/": redirect("/tutor/", 302),
    "/tutor": redirect("/tutor/", 307),
    "/tutor/": tutorIndex,
    "/tutor/*": tutorIndex,
    "/enroll": redirect("/enroll/", 307),
    "/enroll/": participantIndex,
    "/enroll/*": participantIndex,
    "/verify": redirect("/verify/", 307),
    "/verify/": verifyIndex,
    "/verify/*": verifyIndex,
  },

  development: process.env.NODE_ENV !== "production" && {
    hmr: true,
    console: true,
  },
});

console.log(`🚀 Server running at ${server.url}`);
