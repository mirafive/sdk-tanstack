import { useTrackOnMount } from "@mirafive/sdk-tanstack"
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/checkout")({ component: Checkout })

function Checkout() {
  useTrackOnMount("checkout_viewed")

  return (
    <main>
      <h1>Checkout</h1>
    </main>
  )
}
