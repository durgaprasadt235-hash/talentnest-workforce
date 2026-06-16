"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

type Invitation = {
  email: string
  firstName: string
  lastName: string
  role: string
  status: string
  expiresAt: string
  organization: { name: string; legalBusinessName?: string | null } | null
}

export function InvitationDetails({ token }: { token: string }) {
  const [invitation, setInvitation] = useState<Invitation | null>(null)
  const [error, setError] = useState("")
  const [invitationKind, setInvitationKind] = useState<"user" | "organization">("user")
  const destination =
    invitationKind === "organization"
      ? `/organization-onboarding?token=${encodeURIComponent(token)}`
      : "/dashboard"
  const signUpUrl = `/sign-up?redirect_url=${encodeURIComponent(destination)}`
  const signInUrl = `/sign-in?redirect_url=${encodeURIComponent(destination)}`

  useEffect(() => {
    async function loadInvitation() {
      const userResponse = await fetch(`/api/user-invitations/${encodeURIComponent(token)}`)
      const userBody = await userResponse.json()
      if (userResponse.ok) {
        setInvitationKind("user")
        setInvitation(userBody.invitation)
        return
      }

      const organizationResponse = await fetch(`/api/invitations/${encodeURIComponent(token)}`)
      const organizationBody = await organizationResponse.json()
      if (!organizationResponse.ok) throw new Error(organizationBody.error || userBody.error)
      setInvitationKind("organization")
      setInvitation(organizationBody.invitation)
    }

    loadInvitation().catch((caught: Error) => setError(caught.message))
  }, [token])

  return <main className="mx-auto flex min-h-screen max-w-2xl items-center px-6 py-12">
    <Card className="w-full">
      <CardHeader><h1 className="text-2xl font-semibold">TalentNest Workforce invitation</h1></CardHeader>
      <CardContent className="space-y-5">
        {error && <p className="text-sm text-destructive">{error}</p>}
        {!error && !invitation && <p className="text-sm text-muted-foreground">Loading invitation...</p>}
        {invitation && <>
          <div className="flex items-center justify-between gap-4"><div><p className="font-medium">{invitation.organization?.name ?? "TalentNest Workforce"}</p><p className="text-sm text-muted-foreground">{invitation.organization?.legalBusinessName}</p></div><Badge>{invitation.status}</Badge></div>
          <div className="rounded-xl border bg-muted/30 p-4 text-sm"><p>You are invited as <strong>{invitation.role.replaceAll("_", " ")}</strong>.</p><p className="mt-2">Use <strong>{invitation.email}</strong> when signing in or creating your Clerk account. TalentNest will link the account by email.</p><p className="mt-2 text-muted-foreground">Invitation expires {new Date(invitation.expiresAt).toLocaleString()}.</p></div>
          {(invitation.status === "PENDING" || invitation.status === "SENT") && <div className="flex flex-wrap gap-3">
            <Button asChild><Link href={signUpUrl}>Create account</Link></Button>
            <Button asChild variant="outline"><Link href={signInUrl}>Sign in</Link></Button>
          </div>}
          {invitation.status === "ACCEPTED" && <div className="space-y-3">
            <p className="text-sm text-muted-foreground">This invitation has been accepted. Sign in to continue organization setup.</p>
            <Button asChild><Link href={signInUrl}>Continue to sign in</Link></Button>
          </div>}
          {invitation.status !== "PENDING" && invitation.status !== "SENT" && invitation.status !== "ACCEPTED" && <p className="text-sm text-muted-foreground">This invitation is no longer active. Contact your TalentNest administrator to request a new invitation.</p>}
        </>}
      </CardContent>
    </Card>
  </main>
}
