import { miraMiddleware } from "@mirafive/sdk-tanstack/start"
import { createStart } from "@tanstack/react-start"

// Created once here: createStart() runs its factory per request.
// On Workers or Vercel pass the platform's waitUntil: miraMiddleware({ waitUntil }).
const mirafive = miraMiddleware()

// Every request gets context.mira and context.flagsFor; events are flushed once the response is ready.
export const startInstance = createStart(() => ({
  requestMiddleware: [mirafive]
}))
