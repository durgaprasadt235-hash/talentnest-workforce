"use client"

import { useState } from "react"
import { Show, SignInButton, SignUpButton, SignOutButton, UserButton } from "@clerk/nextjs"
import { Bell, HelpCircle, LogOut, Menu, Plus, Search, ShieldCheck } from "lucide-react"

import { AppSidebar } from "@/components/layout/app-sidebar"
import { useCurrentUser } from "@/components/rbac/current-user-provider"
import { Badge } from "@/components/ui/badge"
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
      <p className="ml-3 hidden text-sm font-semibold text-foreground sm:block lg:ml-0">
        TalentNest Workforce
      </p>
      <div className="ml-auto flex items-center gap-2">
        <label className="relative hidden min-w-64 lg:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <span className="sr-only">Global Search</span>
          <input
            placeholder="Search clients, tickets, kiosks..."
            className="h-9 w-full rounded-lg border bg-background pl-9 pr-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </label>
        <Button variant="outline" size="sm" className="hidden md:inline-flex">
          <Plus className="size-4" />
          Create
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label="Notifications">
          <Bell className="size-4" />
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label="Help">
          <HelpCircle className="size-4" />
        </Button>
        {process.env.NODE_ENV !== "production" && (
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
        )}
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
          <div className="hidden text-right md:block">
            <p className="text-sm font-semibold">
              {[currentUser.firstName, currentUser.lastName].filter(Boolean).join(" ") || currentUser.email}
            </p>
            <div className="mt-0.5 flex items-center justify-end gap-1.5 text-xs text-muted-foreground">
              <Badge className="px-2 py-0.5">{currentUser.role}</Badge>
              {currentUser.companyName && <span>· {currentUser.companyName}</span>}
            </div>
          </div>
          <UserButton />
          <SignOutButton>
            <Button variant="ghost" size="icon-sm" aria-label="Logout">
              <LogOut className="size-4" />
            </Button>
          </SignOutButton>
        </Show>
      </div>
    </header>
  )
}
