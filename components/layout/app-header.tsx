"use client"

import { useState } from "react"
import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs"
import { Menu, ShieldCheck } from "lucide-react"

import { AppSidebar } from "@/components/layout/app-sidebar"
import { useCurrentUser } from "@/components/rbac/current-user-provider"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { ROLE_LABELS, ROLES, type Role } from "@/src/lib/rbac/roles"

export function AppHeader() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const { currentUser, setCurrentRole } = useCurrentUser()

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center border-b bg-background/95 px-4 backdrop-blur-sm sm:px-6 lg:px-10">
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="lg:hidden">
            <Menu />
            <span className="sr-only">Open navigation</span>
          </Button>
        </SheetTrigger>
        <SheetContent
          side="left"
          showCloseButton={false}
          className="w-64 gap-0 border-0 p-0 sm:max-w-64"
        >
          <SheetTitle className="sr-only">Main navigation</SheetTitle>
          <SheetDescription className="sr-only">
            Navigate TalentNest Workforce
          </SheetDescription>
          <AppSidebar onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>
      <p className="ml-3 text-sm font-semibold text-foreground lg:ml-0">
        TalentNest Workforce
      </p>
      <div className="ml-auto flex items-center gap-2">
        <label className="flex items-center gap-2">
          <ShieldCheck className="hidden size-4 text-muted-foreground sm:block" />
          <span className="sr-only">Current mock role</span>
          <select
            aria-label="Current mock role"
            value={currentUser.role}
            onChange={(event) => setCurrentRole(event.target.value as Role)}
            className="h-9 max-w-56 rounded-lg border bg-background px-3 text-sm font-medium text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </select>
        </label>
        <Show when="signed-out">
          <SignInButton mode="modal">
            <Button variant="outline" size="sm">
              Sign in
            </Button>
          </SignInButton>
          <SignUpButton mode="modal">
            <Button size="sm">Sign up</Button>
          </SignUpButton>
        </Show>
        <Show when="signed-in">
          <UserButton />
        </Show>
      </div>
    </header>
  )
}
