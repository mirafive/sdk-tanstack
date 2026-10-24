import { MiraProvider } from "@mirafive/sdk-tanstack"
import { createRootRoute, HeadContent, Link, Outlet, Scripts } from "@tanstack/react-router"
import type { ReactNode } from "react"

export const Route = createRootRoute({
  head: () => ({
    meta: [{ charSet: "utf-8" }, { title: "MIRA FIVE + TanStack Start" }]
  }),
  shellComponent: RootDocument,
  component: RootComponent
})

function RootComponent() {
  return (
    <MiraProvider websiteKey={import.meta.env.VITE_MIRAFIVE_KEY}>
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
