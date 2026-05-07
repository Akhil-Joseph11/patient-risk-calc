import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

/** Dashboard UI only — APIs enforce JSON 401 via auth() inside route handlers. */
const isProtectedDashboard = createRouteMatcher(["/dashboard(.*)"]);

export default clerkMiddleware((auth, req) => {
  if (isProtectedDashboard(req)) {
    auth().protect();
  }
});

/** Must cover any route that calls `auth()` (including `/`) so Clerk can attach context. */
export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
};
