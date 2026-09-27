import { flags } from "@mirafive/sdk-browser/flags"
import { MiraProvider } from "@mirafive/sdk-tanstack"
import { createRootRoute, HeadContent, Link, Outlet, Scripts } from "@tanstack/react-router"
import type { ReactNode } from "react"

import { getFlagBootstrap } from "../flags"

export const Route = createRootRoute({
  head: () => ({
    meta: [{ charSet: "utf-8" }, { title: "MIRA FIVE + TanStack Start" }]
  }),
  // The bootstrap only matters for the first server render; the browser SDK keeps flags fresh afterwards.
  loader: () => getFlagBootstrap(),
  staleTime: Infinity,
  shellComponent: RootDocument,
  component: RootComponent
})

function RootComponent() {
  const bootstrap = Route.useLoaderData()

  return (
    // Renders the mirafive-flags block and hands the same answers to the flag hooks.
    <MiraProvider websiteKey={import.meta.env.VITE_MIRAFIVE_KEY} bootstrap={bootstrap} plugins={[flags()]}>
      <nav>
        <Link to="/">Home</Link> <Link to="/checkout">Checkout</Link>
      </nav>
      <Outlet />
    </MiraProvider>
  )
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
