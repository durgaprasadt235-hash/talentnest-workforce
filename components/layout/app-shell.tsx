import type { ReactNode } from "react"

import { AppHeader } from "@/components/layout/app-header"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { SubscriptionBanner } from "@/components/features/subscription-banner"
import { CurrentUserProvider } from "@/components/rbac/current-user-provider"
import { PasswordChangeGate } from "@/components/rbac/password-change-gate"

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <CurrentUserProvider>
      <PasswordChangeGate><div className="min-h-screen bg-background">
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">
          <AppSidebar />
        </aside>
        <div className="lg:pl-64">
          <AppHeader />
          <SubscriptionBanner />
          <main className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
            {children}
          </main>
        </div>
      </div></PasswordChangeGate>
    </CurrentUserProvider>
  )
}
