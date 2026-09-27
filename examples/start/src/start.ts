import { miraMiddleware } from "@mirafive/sdk-tanstack/start"
import { createStart } from "@tanstack/react-start"

// Every request gets context.mira and context.flagsFor; events are flushed once the response is ready.
// On Workers or Vercel pass the platform's waitUntil: miraMiddleware({ waitUntil }).
export const startInstance = createStart(() => ({
  requestMiddleware: [miraMiddleware()]
}))
