"use client"

import { CheckCircle2, Circle, ExternalLink } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"

import { useCurrentUser } from "@/components/rbac/current-user-provider"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Role } from "@/src/lib/rbac/roles"

const setupSteps = [
  { label: "Add legal entities / LLCs", href: "/legal-entities" },
  { label: "Add hotel properties", href: "/properties" },
  { label: "Configure departments", href: "/departments" },
  { label: "Invite your team", href: "/users" },
  { label: "Add employees", href: "/employees" },
]

export function InvitedOrganizationSetup({ token }: { token?: string }) {
  const { currentUser } = useCurrentUser()
  const [status, setStatus] = useState(token ? "Confirming your invitation..." : "")
  const [error, setError] = useState("")

  useEffect(() => {
    if (!token) return

    fetch(`/api/invitations/${encodeURIComponent(token)}`, { method: "POST" })
      .then(async (response) => {
        const body = await response.json()
        if (!response.ok) throw new Error(body.error)
        setStatus(`Invitation accepted for ${body.organization.name}.`)
      })
      .catch((caught: Error) => {
        setError(caught.message)
        setStatus("")
      })
  }, [token])

  const isOwner = currentUser.role === Role.ORGANIZATION_OWNER

  return <div className="space-y-6">
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">Organization setup</h1>
      <p className="mt-2 text-sm text-muted-foreground">Welcome to TalentNest Workforce. Complete these steps to prepare your organization.</p>
    </div>
    {status && <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{status}</p>}
    {error && <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error}</p>}
    {!isOwner && !error && <p className="rounded-xl border p-4 text-sm text-muted-foreground">Loading your organization access...</p>}
    <Card>
      <CardHeader><h2 className="font-semibold">Setup checklist</h2></CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <CheckCircle2 className="size-5 text-emerald-700" />
          <div><p className="font-medium">Organization owner account</p><p className="text-sm text-muted-foreground">{currentUser.email ?? "Linking Clerk account..."}</p></div>
        </div>
        {setupSteps.map((step) => <div key={step.href} className="flex items-center justify-between gap-4 rounded-xl border p-4">
          <div className="flex items-center gap-3"><Circle className="size-5 text-muted-foreground" /><span className="font-medium">{step.label}</span></div>
          <Button asChild size="sm" variant="outline"><Link href={step.href}>Open <ExternalLink /></Link></Button>
        </div>)}
      </CardContent>
    </Card>
  </div>
}
