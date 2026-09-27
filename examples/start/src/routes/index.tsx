import { useMira } from "@mirafive/sdk-tanstack"
import { createFileRoute } from "@tanstack/react-router"

import { trackSignup } from "../flags"

export const Route = createFileRoute("/")({ component: Home })

function Home() {
  const mira = useMira()

  return (
    <main>
      <h1>MIRA FIVE + TanStack Start</h1>
      <button
        type="button"
        onClick={() => {
          mira.track("signup_clicked", { plan: "pro" })
          void trackSignup({ data: { userId: "u_42" } })
        }}
      >
        Sign up
      </button>
    </main>
  )
}
