import { createTRPCRouter } from "~/server/api/trpc";
import { locationRouter } from "./routers/location";
import { userLocationRouter } from "./routers/userlocation";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  location: locationRouter,
  userLocation: userLocationRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
