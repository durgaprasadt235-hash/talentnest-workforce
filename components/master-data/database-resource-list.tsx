"use client"

import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react"
import { Eye, Pencil, Plus, RotateCcw, UserMinus } from "lucide-react"
import Link from "next/link"

import { useCurrentUser } from "@/components/rbac/current-user-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Table, TableCell, TableHead } from "@/components/ui/table"
import { hasPermission } from "@/src/lib/rbac/guards"
import { mockRoleHeaders } from "@/src/lib/rbac/mock-auth"
import { Permission } from "@/src/lib/rbac/permissions"
import { Role } from "@/src/lib/rbac/roles"

type Kind = "organization" | "property" | "department"
type Item = {
  id: string
  organizationId?: string
  legalEntityId?: string | null
  propertyId?: string
  name: string
  slug?: string
  code?: string
  status: "ACTIVE" | "INACTIVE"
  organizationStatus?: "ONBOARDING" | "ACTIVE" | "SUSPENDED" | "CANCELLED"
  legalBusinessName?: string | null
  contactName?: string | null
  contactEmail?: string | null
  contactPhone?: string | null
  billingAddress?: string | null
  billingCity?: string | null
  billingState?: string | null
  billingZip?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  zipCode?: string | null
  timeZone?: string
  organization?: { id: string; name: string }
  legalEntity?: { id: string; displayName: string } | null
  property?: { id: string; name: string }
  subscription?: {
    planName: string
    billingCycle: string
    status: string
    trialEndsAt: string | null
  } | null
  featureOverride?: Record<string, boolean | string | null> | null
  users?: Array<{ id: string; firstName: string; lastName: string; email: string; clerkUserId: string | null; role: string }>
  invitations?: Array<{
    id: string
    email: string
    status: string
    invitedAt: string
    sentAt: string | null
    expiresAt: string
    lastError: string | null
  }>
  _count?: { legalEntities: number; properties: number }
}
type Option = { id: string; name: string; organizationId?: string }
type LegalEntityOption = { id: string; displayName: string; organizationId: string }
type Form = {
  organizationId: string
  legalEntityId: string
  propertyId: string
  name: string
  slug: string
  code: string
  address: string
  city: string
  state: string
  zipCode: string
  timeZone: string
}

const emptyForm: Form = {
  organizationId: "", legalEntityId: "", propertyId: "", name: "", slug: "", code: "",
  address: "", city: "", state: "", zipCode: "", timeZone: "America/New_York",
}
const selectClass = "h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
const config = {
  organization: {
    title: "Organizations",
    description: "Create and manage organization master records.",
    endpoint: "/api/organizations",
    key: "organizations",
    permission: Permission.MANAGE_ORGANIZATION,
    empty: "No organizations found. Create your first organization.",
  },
  property: {
    title: "Properties",
    description: "Create and manage properties and their organization assignments.",
    endpoint: "/api/properties",
    key: "properties",
    permission: Permission.MANAGE_PROPERTIES,
    empty: "No properties found. Create your first property.",
  },
  department: {
    title: "Departments",
    description: "Create and manage departments and their property assignments.",
    endpoint: "/api/departments",
    key: "departments",
    permission: Permission.MANAGE_DEPARTMENTS,
    empty: "No departments found. Create your first department.",
  },
} as const

export function DatabaseResourceList({ kind }: { kind: Kind }) {
  const settings = config[kind]
  const { currentUser } = useCurrentUser()
  const canManage = hasPermission(currentUser, settings.permission)
  const headers = useMemo(() => mockRoleHeaders(currentUser.role), [currentUser.role])
  const [items, setItems] = useState<Item[]>([])
  const [organizations, setOrganizations] = useState<Option[]>([])
  const [properties, setProperties] = useState<Option[]>([])
  const [legalEntities, setLegalEntities] = useState<LegalEntityOption[]>([])
  const [form, setForm] = useState<Form>(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [detailItem, setDetailItem] = useState<Item | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const response = await fetch(settings.endpoint, { headers })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error)
      setItems(result[settings.key])
      setOrganizations(result.options?.organizations ?? [])
      setProperties(result.options?.properties ?? [])
      setLegalEntities(result.options?.legalEntities ?? [])
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load records.")
    } finally {
      setLoading(false)
    }
  }, [headers, settings.endpoint, settings.key])

  useEffect(() => {
    // Initial remote synchronization is intentionally client-side.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  useEffect(() => {
    if (kind !== "organization") return
    const refresh = () => void load()
    window.addEventListener("talentnest:organizations-changed", refresh)
    return () => window.removeEventListener("talentnest:organizations-changed", refresh)
  }, [kind, load])

  function startCreate() {
    setEditingId(null)
    setForm(emptyForm)
    setOpen(true)
    setError("")
    setMessage("")
  }

  function startEdit(item: Item) {
    setEditingId(item.id)
    setForm({
      organizationId: item.organizationId ?? "",
      legalEntityId: item.legalEntityId ?? "",
      propertyId: item.propertyId ?? "",
      name: item.name,
      slug: item.slug ?? "",
      code: item.code ?? "",
      address: item.address ?? "",
      city: item.city ?? "",
      state: item.state ?? "",
      zipCode: item.zipCode ?? "",
      timeZone: item.timeZone ?? "America/New_York",
    })
    setOpen(true)
    setError("")
    setMessage("")
  }

  function updateForm(key: keyof Form, value: string) {
    setForm((current) => ({
      ...current,
      [key]: value,
      ...(key === "organizationId" ? { propertyId: "", legalEntityId: "" } : {}),
    }))
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError("")
    const payload =
      kind === "organization"
        ? { name: form.name, slug: form.slug }
        : kind === "property"
          ? {
              organizationId: form.organizationId, legalEntityId: form.legalEntityId || null, name: form.name, code: form.code,
              address: form.address || null, city: form.city || null, state: form.state || null,
              zipCode: form.zipCode || null, timeZone: form.timeZone,
            }
          : { organizationId: form.organizationId, propertyId: form.propertyId, name: form.name, code: form.code }
    try {
      const response = await fetch(editingId ? `${settings.endpoint}/${editingId}` : settings.endpoint, {
        method: editingId ? "PATCH" : "POST",
        headers: { "content-type": "application/json", ...headers },
        body: JSON.stringify(payload),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error)
      setOpen(false)
      setMessage(`${singular(settings.title)} ${editingId ? "updated" : "created"}.`)
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save record.")
    } finally {
      setBusy(false)
    }
  }

  async function changeStatus(item: Item) {
    const action = item.status === "ACTIVE" ? "deactivate" : "reactivate"
    if (!window.confirm(`${action === "deactivate" ? "Deactivate" : "Reactivate"} ${item.name}?`)) return
    setError("")
    try {
      const response = await fetch(`${settings.endpoint}/${item.id}/${action}`, { method: "POST", headers })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error)
      setMessage(`${item.name} ${action === "deactivate" ? "deactivated" : "reactivated"}.`)
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update status.")
    }
  }

  const availableProperties = properties.filter((item) => item.organizationId === form.organizationId)
  const availableLegalEntities = legalEntities.filter((item) => item.organizationId === form.organizationId)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{settings.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{settings.description}</p>
        </div>
        {canManage && kind !== "organization" && <Button onClick={startCreate}><Plus /> Create {singular(settings.title)}</Button>}
      </div>
      {message && <p className="text-sm text-emerald-700">{message}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Card>
        <CardHeader><h2 className="font-semibold">{settings.title}</h2></CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-6 text-center text-sm text-muted-foreground">Loading {settings.title.toLowerCase()}...</p>
          ) : (
            <>
              <Table>
                <thead><tr>
                  <TableHead>Name</TableHead>
                  <TableHead>Assignment</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>Status</TableHead>
                  {(canManage || kind === "organization") && <TableHead>Actions</TableHead>}
                </tr></thead>
                <tbody>{items.map((item) => (
                  <tr key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>{item.legalEntity?.displayName ?? item.property?.name ?? item.organization?.name ?? "—"}</TableCell>
                    <TableCell>{detail(kind, item)}</TableCell>
                    <TableCell><Badge className={item.status === "ACTIVE" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : ""}>{item.status}</Badge></TableCell>
                    {(canManage || kind === "organization") && <TableCell><div className="flex flex-wrap gap-2">
                      {kind === "organization" && <Button size="sm" variant="outline" onClick={() => setDetailItem(item)}><Eye /> Details</Button>}
                      {canManage && <><Button size="sm" variant="outline" onClick={() => startEdit(item)}><Pencil /> Edit</Button>
                        <Button size="sm" variant="outline" onClick={() => void changeStatus(item)}>
                          {item.status === "ACTIVE" ? <UserMinus /> : <RotateCcw />}
                          {item.status === "ACTIVE" ? "Deactivate" : "Reactivate"}
                        </Button></>}
                    </div></TableCell>}
                  </tr>
                ))}</tbody>
              </Table>
              {items.length === 0 && !error && <p className="p-6 text-center text-sm text-muted-foreground">{settings.empty}</p>}
            </>
          )}
        </CardContent>
      </Card>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="overflow-y-auto sm:max-w-md">
          <form className="flex min-h-full flex-col" onSubmit={submit}>
            <SheetHeader>
              <SheetTitle>{editingId ? "Edit" : "Create"} {singular(settings.title)}</SheetTitle>
              <SheetDescription>Enter the master record details below.</SheetDescription>
            </SheetHeader>
            <div className="space-y-4 px-4">
              {kind !== "organization" && <Field label="Organization"><select className={selectClass} required value={form.organizationId} onChange={(event) => updateForm("organizationId", event.target.value)}><option value="">Select organization</option>{organizations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>}
              {kind === "property" && <Field label="Legal Entity / LLC"><select className={selectClass} required={!editingId && availableLegalEntities.length > 0} value={form.legalEntityId} onChange={(event) => updateForm("legalEntityId", event.target.value)}><option value="">{availableLegalEntities.length ? "Select legal entity" : "No legal entities configured"}</option>{availableLegalEntities.map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}</select></Field>}
              {kind === "department" && <Field label="Property"><select className={selectClass} required value={form.propertyId} onChange={(event) => updateForm("propertyId", event.target.value)}><option value="">Select property</option>{availableProperties.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>}
              <Field label="Name"><Input required value={form.name} onChange={(event) => updateForm("name", event.target.value)} /></Field>
              {kind === "organization" && <Field label="Slug"><Input required value={form.slug} onChange={(event) => updateForm("slug", event.target.value)} /></Field>}
              {kind !== "organization" && <Field label="Code"><Input required value={form.code} onChange={(event) => updateForm("code", event.target.value)} /></Field>}
              {kind === "property" && <>
                <Field label="Address"><Input value={form.address} onChange={(event) => updateForm("address", event.target.value)} /></Field>
                <div className="grid grid-cols-2 gap-3"><Field label="City"><Input value={form.city} onChange={(event) => updateForm("city", event.target.value)} /></Field><Field label="State"><Input value={form.state} onChange={(event) => updateForm("state", event.target.value)} /></Field></div>
                <Field label="ZIP Code"><Input value={form.zipCode} onChange={(event) => updateForm("zipCode", event.target.value)} /></Field>
                <Field label="Time Zone"><Input required value={form.timeZone} onChange={(event) => updateForm("timeZone", event.target.value)} /></Field>
              </>}
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
            <SheetFooter><Button disabled={busy} type="submit">{busy ? "Saving..." : "Save"}</Button></SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
      <Sheet open={Boolean(detailItem)} onOpenChange={(next) => !next && setDetailItem(null)}>
        <SheetContent className="overflow-y-auto sm:max-w-xl">
          {detailItem && <OrganizationDetails item={detailItem} />}
        </SheetContent>
      </Sheet>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block space-y-1.5 text-sm font-medium"><span>{label}</span>{children}</label>
}
function singular(title: string) {
  return title === "Properties" ? "Property" : title.slice(0, -1)
}
function detail(kind: Kind, item: Item) {
  if (kind === "organization") return `${item.slug} · ${item._count?.legalEntities ?? 0} legal entities · ${item._count?.properties ?? 0} properties`
  if (kind === "department") return item.code
  return [item.code, [item.city, item.state].filter(Boolean).join(", ")].filter(Boolean).join(" · ") || "—"
}

function OrganizationDetails({ item }: { item: Item }) {
  const { currentUser } = useCurrentUser()
  const canEditFeatures = currentUser.role === Role.PLATFORM_OWNER || currentUser.role === Role.PLATFORM_ADMIN
  const featureNames = [
    ["canUseScheduling", "Scheduling"], ["canUseAttendance", "Attendance"], ["canUseTimesheets", "Timesheets"],
    ["canUseInvoices", "Invoices"], ["canUsePayments", "Payments"], ["canUseReports", "Reports"],
    ["canUseKiosk", "Kiosk"], ["canUseStaffing", "Staffing"],
  ] as const
  const enabled = featureNames.filter(([key]) => item.featureOverride?.[key] === true).map(([, label]) => label)
  const owner = item.users?.find((user) => user.role === Role.ORGANIZATION_OWNER)
  const [invitationHistory, setInvitationHistory] = useState(item.invitations ?? [])
  const invitation = invitationHistory.find(
    (candidate) => candidate.status !== "ACCEPTED" && candidate.status !== "CANCELLED",
  )
  const canResendInvitation = currentUser.role === Role.PLATFORM_OWNER
  const [features, setFeatures] = useState(() => Object.fromEntries(
    featureNames.map(([key]) => [key, item.featureOverride?.[key] === true]),
  ) as Record<(typeof featureNames)[number][0], boolean>)
  const [reason, setReason] = useState(
    typeof item.featureOverride?.reason === "string" ? item.featureOverride.reason : "",
  )
  const [featureMessage, setFeatureMessage] = useState("")
  const [invitationMessage, setInvitationMessage] = useState("")
  const [resendingInvitation, setResendingInvitation] = useState(false)
  const [ownerCandidateId, setOwnerCandidateId] = useState("")
  const [ownerMessage, setOwnerMessage] = useState("")

  async function saveFeatures() {
    setFeatureMessage("")
    const response = await fetch(`/api/organizations/${item.id}/features`, {
      method: "PATCH",
      headers: { "content-type": "application/json", ...mockRoleHeaders(currentUser.role) },
      body: JSON.stringify({ ...features, reason: reason || null }),
    })
    const body = await response.json()
    if (!response.ok) return setFeatureMessage(body.error)
    setFeatureMessage("Feature access updated.")
    window.dispatchEvent(new Event("talentnest:organizations-changed"))
  }

  async function resendInvitation() {
    if (!invitation) return
    setResendingInvitation(true)
    setInvitationMessage("")
    try {
      const response = await fetch(`/api/organizations/${item.id}/invitations/${invitation.id}/resend`, {
        method: "POST",
        headers: mockRoleHeaders(currentUser.role),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error)
      setInvitationMessage(body.emailMessage)
      setInvitationHistory((current) => current.map((historyItem) => (
        historyItem.id === invitation.id
          ? {
              ...historyItem,
              status: body.invitationStatus,
              sentAt: body.sentAt,
              expiresAt: body.expiresAt,
              lastError: body.lastError,
            }
          : historyItem
      )))
      window.dispatchEvent(new Event("talentnest:organizations-changed"))
    } catch (caught) {
      setInvitationMessage(caught instanceof Error ? caught.message : "Unable to resend invitation.")
    } finally {
      setResendingInvitation(false)
    }
  }

  async function assignOwner() {
    if (!ownerCandidateId) return
    setOwnerMessage("")
    const response = await fetch(`/api/organizations/${item.id}/assign-owner`, {
      method: "PATCH",
      headers: { "content-type": "application/json", ...mockRoleHeaders(currentUser.role) },
      body: JSON.stringify({ userId: ownerCandidateId }),
    })
    const body = await response.json()
    if (!response.ok) return setOwnerMessage(body.error)
    setOwnerMessage("Organization owner assigned.")
    window.dispatchEvent(new Event("talentnest:organizations-changed"))
  }

  return <div className="space-y-6 p-4">
    <SheetHeader className="px-0"><SheetTitle>{item.name}</SheetTitle><SheetDescription>{item.legalBusinessName ?? item.slug}</SheetDescription></SheetHeader>
    <div className="flex flex-wrap gap-2"><Badge>{item.organizationStatus ?? "ACTIVE"}</Badge><Badge className="bg-transparent text-foreground">{item.status}</Badge></div>
    <DetailBlock title="Subscription" lines={item.subscription ? [`${item.subscription.planName} · ${item.subscription.billingCycle}`, `Status: ${item.subscription.status}`, item.subscription.trialEndsAt ? `Trial ends: ${new Date(item.subscription.trialEndsAt).toLocaleDateString()}` : ""] : ["No subscription configured"]} />
    <DetailBlock title="Feature access" lines={[enabled.length ? enabled.join(", ") : "No feature overrides enabled", typeof item.featureOverride?.reason === "string" ? item.featureOverride.reason : ""]} />
    {canEditFeatures && <section className="space-y-4 rounded-xl border p-4">
      <div><h3 className="font-medium">Edit feature access</h3><p className="mt-1 text-sm text-muted-foreground">Platform-approved toggles can keep selected modules available even while subscription setup is pending.</p></div>
      <div className="grid grid-cols-2 gap-3">{featureNames.map(([key, label]) => <label key={key} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={features[key]} onChange={(event) => setFeatures((current) => ({ ...current, [key]: event.target.checked }))} />{label}</label>)}</div>
      <Field label="Reason"><Input value={reason} onChange={(event) => setReason(event.target.value)} /></Field>
      {featureMessage && <p className="text-sm text-muted-foreground">{featureMessage}</p>}
      <Button type="button" onClick={() => void saveFeatures()}>Save feature access</Button>
    </section>}
    {owner
      ? <DetailBlock title="Organization owner" lines={[`${owner.firstName} ${owner.lastName}`, owner.email, owner.clerkUserId ? "Active" : "Inactive"]} />
      : <section className="space-y-3 rounded-xl border p-4">
          <h3 className="font-medium">Organization owner</h3>
          <p className="text-sm text-muted-foreground">No owner assigned.</p>
          {currentUser.role === Role.PLATFORM_OWNER && <>
            <select className={selectClass} value={ownerCandidateId} onChange={(event) => setOwnerCandidateId(event.target.value)}>
              <option value="">Select existing user</option>
              {item.users?.filter((candidate) => candidate.role !== Role.ORGANIZATION_OWNER).map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.firstName} {candidate.lastName} · {candidate.email}</option>)}
            </select>
            <div className="flex flex-wrap gap-2">
              <Button disabled={!ownerCandidateId} onClick={() => void assignOwner()}>Assign selected user</Button>
              <Button asChild variant="outline"><Link href={`/users?organizationId=${encodeURIComponent(item.id)}&role=${Role.ORGANIZATION_OWNER}`}>Create New User</Link></Button>
            </div>
            {ownerMessage && <p className="text-sm text-muted-foreground">{ownerMessage}</p>}
          </>}
        </section>}
    <section className="space-y-4 rounded-xl border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h3 className="font-medium">Invitation history</h3><p className="mt-1 text-sm text-muted-foreground">Organization owner invitation delivery attempts.</p></div>
        {canResendInvitation && invitation && <Button type="button" variant="outline" disabled={resendingInvitation} onClick={() => void resendInvitation()}>
          <RotateCcw /> {resendingInvitation ? "Sending..." : "Resend Invitation"}
        </Button>}
      </div>
      {invitationMessage && <p className={invitationMessage === "Invitation email sent successfully." ? "text-sm text-emerald-700" : "text-sm text-destructive"}>{invitationMessage}</p>}
      {invitationHistory.length ? <Table>
        <thead><tr>
          <TableHead>Email</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Sent At</TableHead>
          <TableHead>Expires At</TableHead>
          <TableHead>Last Error</TableHead>
        </tr></thead>
        <tbody>{invitationHistory.map((historyItem) => <tr key={historyItem.id}>
          <TableCell>{historyItem.email}</TableCell>
          <TableCell><Badge>{historyItem.status}</Badge></TableCell>
          <TableCell>{historyItem.sentAt ? new Date(historyItem.sentAt).toLocaleString() : "—"}</TableCell>
          <TableCell>{new Date(historyItem.expiresAt).toLocaleString()}</TableCell>
          <TableCell className="max-w-52 whitespace-normal text-destructive">{historyItem.lastError ?? "—"}</TableCell>
        </tr>)}</tbody>
      </Table> : <p className="text-sm text-muted-foreground">No invitations</p>}
    </section>
    <DetailBlock title="Setup" lines={[`${item._count?.legalEntities ?? 0} legal entities`, `${item._count?.properties ?? 0} properties`]} />
    <DetailBlock title="Contact and billing" lines={[item.contactName ?? "", item.contactEmail ?? "", item.contactPhone ?? "", [item.billingAddress, item.billingCity, item.billingState, item.billingZip].filter(Boolean).join(", ")]} />
  </div>
}

function DetailBlock({ title, lines }: { title: string; lines: string[] }) {
  return <section className="rounded-xl border p-4"><h3 className="font-medium">{title}</h3><div className="mt-2 space-y-1 text-sm text-muted-foreground">{lines.filter(Boolean).map((line) => <p key={line} className="break-all">{line}</p>)}</div></section>
}
