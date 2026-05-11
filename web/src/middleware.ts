import { clerkMiddleware } from "@clerk/nextjs/server";

/** Dashboard and case APIs work without sign-in; Clerk is optional for persisted cases. */
export default clerkMiddleware();

/**
 * @see https://clerk.com/docs/references/nextjs/clerk-middleware
 */
export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
