import { createServerFn } from "@tanstack/react-start"

// Runs on the server; context comes from miraMiddleware() in src/start.ts.
export const trackSignup = createServerFn({ method: "POST" })
  .validator((data: { userId: string }) => data)
  .handler(async ({ context, data }) => {
    context.mira.track("signup", { userId: data.userId, properties: { plan: "pro" } })
  })
