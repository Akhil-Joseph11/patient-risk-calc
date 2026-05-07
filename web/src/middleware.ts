import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

/** Dashboard UI only — APIs enforce JSON 401 via auth() inside route handlers. */
const isProtectedDashboard = createRouteMatcher(["/dashboard(.*)"]);

export default clerkMiddleware((auth, req) => {
  if (isProtectedDashboard(req)) {
    auth().protect();
  }
});

/**
 * Clerk-recommended matcher (skips static assets reliably on Vercel Edge).
 * @see https://clerk.com/docs/references/nextjs/clerk-middleware
 */
export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
