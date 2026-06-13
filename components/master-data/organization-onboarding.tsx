"use client"

import { useMemo, useState, type FormEvent, type ReactNode } from "react"
import { Check, ChevronLeft, ChevronRight, Copy, Plus } from "lucide-react"

import { useCurrentUser } from "@/components/rbac/current-user-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { mockRoleHeaders } from "@/src/lib/rbac/mock-auth"
import { Role } from "@/src/lib/rbac/roles"

const steps = ["Organization details", "Organization owner", "Subscription / trial", "Feature access", "Review & create"]
const subscriptionOptions = [
  { key: "trial-30", label: "Trial 30 days", detail: "30-day setup and pilot period" },
  { key: "starter-monthly", label: "Starter Monthly", detail: "Starter plan, monthly billing" },
  { key: "starter-annual", label: "Starter Annual", detail: "Starter plan, annual billing" },
  { key: "growth-monthly", label: "Growth Monthly", detail: "Growth plan, monthly billing" },
  { key: "growth-annual", label: "Growth Annual", detail: "Growth plan, annual billing" },
  { key: "enterprise-manual", label: "Enterprise Manual", detail: "Enterprise plan with manual billing setup" },
] as const
const featureOptions = [
  ["canUseScheduling", "Scheduling"],
  ["canUseAttendance", "Attendance"],
  ["canUseTimesheets", "Timesheets"],
  ["canUseInvoices", "Invoices"],
  ["canUsePayments", "Payments"],
  ["canUseReports", "Reports"],
  ["canUseKiosk", "Kiosk"],
  ["canUseStaffing", "Staffing"],
] as const

const initialForm = {
  organization: {
    name: "", slug: "", legalBusinessName: "", contactName: "", contactEmail: "", contactPhone: "",
    billingAddress: "", billingCity: "", billingState: "", billingZip: "",
  },
  owner: { firstName: "", lastName: "", email: "" },
  subscriptionOption: "trial-30",
  features: {
    canUseScheduling: true, canUseAttendance: false, canUseTimesheets: true, canUseInvoices: true,
    canUsePayments: false, canUseReports: true, canUseKiosk: false, canUseStaffing: false, reason: "",
  },
}

export function OrganizationOnboarding() {
  const { currentUser } = useCurrentUser()
  const isPlatform = currentUser.role === Role.PLATFORM_OWNER || currentUser.role === Role.PLATFORM_ADMIN
  const headers = useMemo(() => mockRoleHeaders(currentUser.role), [currentUser.role])
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)
  const [form, setForm] = useState(initialForm)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [result, setResult] = useState<{ organizationName: string; ownerEmail: string; inviteLink: string } | null>(null)

  if (!isPlatform) return null

  function start() {
    setForm(initialForm)
    setStep(0)
    setError("")
    setResult(null)
    setOpen(true)
  }

  function updateOrganization(key: keyof typeof form.organization, value: string) {
    setForm((current) => ({ ...current, organization: { ...current.organization, [key]: value } }))
  }

  function updateOwner(key: keyof typeof form.owner, value: string) {
    setForm((current) => ({ ...current, owner: { ...current.owner, [key]: value } }))
  }

  function updateFeature(key: keyof typeof form.features, value: boolean | string) {
    setForm((current) => ({ ...current, features: { ...current.features, [key]: value } }))
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (step < steps.length - 1) {
      setStep((current) => current + 1)
      return
    }

    setBusy(true)
    setError("")
    try {
      const response = await fetch("/api/organizations/onboard", {
        method: "POST",
        headers: { "content-type": "application/json", ...headers },
        body: JSON.stringify(form),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error)
      setResult(body)
      window.dispatchEvent(new Event("talentnest:organizations-changed"))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to onboard organization.")
    } finally {
      setBusy(false)
    }
  }

  const inviteUrl = result ? `${window.location.origin}${result.inviteLink}` : ""

  return (
    <>
      <Button onClick={start}><Plus /> Create Client Organization</Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="overflow-y-auto sm:max-w-2xl">
          {result ? (
            <div className="space-y-6 p-4">
              <SheetHeader className="px-0">
                <SheetTitle>Organization setup created</SheetTitle>
                <SheetDescription>{result.organizationName} is ready for setup. No email was sent.</SheetDescription>
              </SheetHeader>
              <div className="rounded-xl border bg-muted/30 p-4">
                <p className="text-sm font-medium">Organization Owner</p>
                <p className="mt-1 text-sm text-muted-foreground">{result.ownerEmail}</p>
                <p className="mt-4 text-sm font-medium">Invitation link</p>
                <p className="mt-1 break-all rounded-lg border bg-background p-3 font-mono text-xs">{inviteUrl}</p>
                <Button className="mt-3" variant="outline" onClick={() => void navigator.clipboard.writeText(inviteUrl)}><Copy /> Copy invite link</Button>
              </div>
              <Button onClick={() => setOpen(false)}>Done</Button>
            </div>
          ) : (
            <form className="flex min-h-full flex-col" onSubmit={submit}>
              <SheetHeader>
                <SheetTitle>Create Client Organization</SheetTitle>
                <SheetDescription>Step {step + 1} of {steps.length}: {steps[step]}</SheetDescription>
              </SheetHeader>
              <div className="px-4">
                <div className="mb-6 grid grid-cols-5 gap-2">
                  {steps.map((label, index) => <div key={label} className="space-y-1"><div className={`h-1.5 rounded-full ${index <= step ? "bg-primary" : "bg-muted"}`} /><p className="hidden text-[10px] text-muted-foreground md:block">{label}</p></div>)}
                </div>
                {step === 0 && <OrganizationStep form={form.organization} update={updateOrganization} />}
                {step === 1 && <OwnerStep form={form.owner} update={updateOwner} />}
                {step === 2 && <SubscriptionStep value={form.subscriptionOption} update={(value) => setForm((current) => ({ ...current, subscriptionOption: value }))} />}
                {step === 3 && <FeatureStep features={form.features} update={updateFeature} />}
                {step === 4 && <ReviewStep form={form} />}
                {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
              </div>
              <SheetFooter className="flex-row justify-between">
                <Button type="button" variant="outline" disabled={step === 0 || busy} onClick={() => setStep((current) => current - 1)}><ChevronLeft /> Back</Button>
                <Button disabled={busy} type="submit">{step === steps.length - 1 ? (busy ? "Creating..." : "Create organization") : "Continue"}{step < steps.length - 1 && <ChevronRight />}</Button>
              </SheetFooter>
            </form>
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}

function OrganizationStep({ form, update }: { form: typeof initialForm.organization; update: (key: keyof typeof form, value: string) => void }) {
  return <div className="grid gap-4 md:grid-cols-2">
    <Field label="Display name"><Input required value={form.name} onChange={(event) => update("name", event.target.value)} /></Field>
    <Field label="Slug"><Input required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={form.slug} onChange={(event) => update("slug", event.target.value.toLowerCase())} /></Field>
    <Field label="Legal business name"><Input required value={form.legalBusinessName} onChange={(event) => update("legalBusinessName", event.target.value)} /></Field>
    <Field label="Primary contact"><Input required value={form.contactName} onChange={(event) => update("contactName", event.target.value)} /></Field>
    <Field label="Contact email"><Input required type="email" value={form.contactEmail} onChange={(event) => update("contactEmail", event.target.value)} /></Field>
    <Field label="Contact phone"><Input value={form.contactPhone} onChange={(event) => update("contactPhone", event.target.value)} /></Field>
    <Field label="Billing address"><Input value={form.billingAddress} onChange={(event) => update("billingAddress", event.target.value)} /></Field>
    <Field label="Billing city"><Input value={form.billingCity} onChange={(event) => update("billingCity", event.target.value)} /></Field>
    <Field label="Billing state"><Input value={form.billingState} onChange={(event) => update("billingState", event.target.value)} /></Field>
    <Field label="Billing ZIP"><Input value={form.billingZip} onChange={(event) => update("billingZip", event.target.value)} /></Field>
  </div>
}

function OwnerStep({ form, update }: { form: typeof initialForm.owner; update: (key: keyof typeof form, value: string) => void }) {
  return <div className="grid gap-4 md:grid-cols-2">
    <Field label="First name"><Input required value={form.firstName} onChange={(event) => update("firstName", event.target.value)} /></Field>
    <Field label="Last name"><Input required value={form.lastName} onChange={(event) => update("lastName", event.target.value)} /></Field>
    <div className="md:col-span-2"><Field label="Email"><Input required type="email" value={form.email} onChange={(event) => update("email", event.target.value)} /></Field></div>
    <p className="text-sm text-muted-foreground md:col-span-2">An unlinked Organization Owner user and invitation token will be created. Email delivery will be added when a provider is configured.</p>
  </div>
}

function SubscriptionStep({ value, update }: { value: string; update: (value: string) => void }) {
  return <div className="grid gap-3 md:grid-cols-2">{subscriptionOptions.map((option) => <label key={option.key} className={`cursor-pointer rounded-xl border p-4 ${value === option.key ? "border-primary bg-primary/5" : ""}`}><input className="sr-only" type="radio" name="subscription" checked={value === option.key} onChange={() => update(option.key)} /><span className="font-medium">{option.label}</span><span className="mt-1 block text-sm text-muted-foreground">{option.detail}</span></label>)}</div>
}

function FeatureStep({ features, update }: { features: typeof initialForm.features; update: (key: keyof typeof features, value: boolean | string) => void }) {
  return <div className="space-y-4"><div className="grid gap-3 md:grid-cols-2">{featureOptions.map(([key, label]) => <label key={key} className="flex cursor-pointer items-center gap-3 rounded-xl border p-4"><input type="checkbox" checked={features[key]} onChange={(event) => update(key, event.target.checked)} /><span>{label}</span></label>)}</div><Field label="Override reason"><Input value={features.reason} onChange={(event) => update("reason", event.target.value)} /></Field></div>
}

function ReviewStep({ form }: { form: typeof initialForm }) {
  const subscription = subscriptionOptions.find((option) => option.key === form.subscriptionOption)
  const enabled = featureOptions.filter(([key]) => form.features[key]).map(([, label]) => label)
  return <div className="space-y-4">
    <Review title="Organization" value={`${form.organization.name} · ${form.organization.legalBusinessName}`} />
    <Review title="Owner" value={`${form.owner.firstName} ${form.owner.lastName} · ${form.owner.email}`} />
    <Review title="Subscription" value={subscription?.label ?? form.subscriptionOption} />
    <Review title="Enabled features" value={enabled.join(", ") || "None"} />
    <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"><Check className="size-4 shrink-0" />This creates setup records only. Stripe checkout and feature enforcement remain disabled.</div>
  </div>
}

function Review({ title, value }: { title: string; value: string }) {
  return <div className="rounded-xl border p-4"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p><p className="mt-1 text-sm">{value}</p></div>
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block space-y-1.5 text-sm font-medium"><span>{label}</span>{children}</label>
}
