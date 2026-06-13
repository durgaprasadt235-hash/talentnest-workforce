"use client"

import { useState } from "react"
import { Check } from "lucide-react"

import { useCurrentUser } from "@/components/rbac/current-user-provider"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { BillingCycle, billingPlans, type BillingPlanKey } from "@/src/lib/stripe/plans"
import { Role } from "@/src/lib/rbac/roles"

export function BillingPlans({
  configured,
  title,
}: {
  configured: boolean
  title: string
}) {
  const { currentUser } = useCurrentUser()
  const [busy, setBusy] = useState("")
  const [error, setError] = useState("")
  const canCheckout =
    currentUser.role === Role.PLATFORM_OWNER ||
    currentUser.role === Role.PLATFORM_ADMIN ||
    currentUser.role === Role.ORGANIZATION_OWNER

  async function checkout(planKey: BillingPlanKey, billingCycle: BillingCycle) {
    if (!currentUser.organizationId) {
      return setError("Select an organization during onboarding before starting checkout.")
    }

    const action = `${planKey}-${billingCycle}`
    setBusy(action)
    setError("")
    const response = await fetch("/api/billing/create-checkout-session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        organizationId: currentUser.organizationId,
        planKey,
        billingCycle,
      }),
    })
    const result = await response.json()
    setBusy("")
    if (!response.ok) return setError(result.error)
    if (result.url) window.location.assign(result.url)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Subscription checkout is optional and does not affect current pilot access.
        </p>
      </div>

      {!configured && (
        <p className="rounded-lg border bg-muted/40 p-4 text-sm font-medium text-muted-foreground">
          Stripe billing is not configured yet.
        </p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="grid gap-5 lg:grid-cols-3">
        {billingPlans.map((plan) => (
          <Card key={plan.key} className="flex flex-col">
            <CardHeader>
              <h2 className="text-xl font-semibold">{plan.name}</h2>
              <p className="text-sm text-muted-foreground">
                {limit(plan.maxProperties)} properties · {limit(plan.maxEmployees)} employees · {limit(plan.maxUsers)} users
              </p>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-5">
              <ul className="space-y-2 text-sm">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-2">
                    <Check className="mt-0.5 size-4 text-emerald-600" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-auto grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  disabled={!configured || !canCheckout || busy !== ""}
                  onClick={() => checkout(plan.key, BillingCycle.MONTHLY)}
                >
                  {busy === `${plan.key}-monthly` ? "Opening..." : "Monthly"}
                </Button>
                <Button
                  disabled={!configured || !canCheckout || busy !== ""}
                  onClick={() => checkout(plan.key, BillingCycle.ANNUAL)}
                >
                  {busy === `${plan.key}-annual` ? "Opening..." : "Annual"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

function limit(value: number | null) {
  return value === null ? "Unlimited" : new Intl.NumberFormat("en-US").format(value)
}
