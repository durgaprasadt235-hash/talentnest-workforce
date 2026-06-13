"use client"

import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react"
import { Pencil, Plus, RotateCcw, UserMinus } from "lucide-react"

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

type Option = { id: string; name: string }
type LegalEntity = {
  id: string
  organizationId: string
  legalName: string
  displayName: string
  ein: string | null
  address: string | null
  city: string | null
  state: string | null
  zipCode: string | null
  status: "ACTIVE" | "INACTIVE"
  organization: Option
  _count: { properties: number }
}
type Form = {
  organizationId: string
  legalName: string
  displayName: string
  ein: string
  address: string
  city: string
  state: string
  zipCode: string
}

const emptyForm: Form = { organizationId: "", legalName: "", displayName: "", ein: "", address: "", city: "", state: "", zipCode: "" }
const selectClass = "h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"

export function LegalEntityManagement() {
  const { currentUser } = useCurrentUser()
  const canManage = hasPermission(currentUser, Permission.MANAGE_LEGAL_ENTITIES)
  const headers = useMemo(() => mockRoleHeaders(currentUser.role, { organizationId: currentUser.organizationId }), [currentUser])
  const [items, setItems] = useState<LegalEntity[]>([])
  const [organizations, setOrganizations] = useState<Option[]>([])
  const [form, setForm] = useState<Form>(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const response = await fetch("/api/legal-entities", { headers })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error)
    setItems(result.legalEntities)
    setOrganizations(result.options.organizations)
  }, [headers])

  useEffect(() => {
    // Initial remote synchronization is intentionally client-side.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load().catch((caught: Error) => setError(caught.message))
  }, [load])

  function startCreate() {
    setEditingId(null)
    setForm({ ...emptyForm, organizationId: currentUser.organizationId ?? "" })
    setOpen(true)
    setError("")
  }

  function startEdit(item: LegalEntity) {
    setEditingId(item.id)
    setForm({
      organizationId: item.organizationId,
      legalName: item.legalName,
      displayName: item.displayName,
      ein: item.ein ?? "",
      address: item.address ?? "",
      city: item.city ?? "",
      state: item.state ?? "",
      zipCode: item.zipCode ?? "",
    })
    setOpen(true)
    setError("")
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError("")
    const response = await fetch(editingId ? `/api/legal-entities/${editingId}` : "/api/legal-entities", {
      method: editingId ? "PATCH" : "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify({
        ...form,
        ein: form.ein || null,
        address: form.address || null,
        city: form.city || null,
        state: form.state || null,
        zipCode: form.zipCode || null,
      }),
    })
    const result = await response.json()
    setBusy(false)
    if (!response.ok) return setError(result.error)
    setOpen(false)
    setMessage(editingId ? "Legal entity updated." : "Legal entity created.")
    await load()
  }

  async function changeStatus(item: LegalEntity) {
    const action = item.status === "ACTIVE" ? "deactivate" : "reactivate"
    const response = await fetch(`/api/legal-entities/${item.id}/${action}`, { method: "PATCH", headers })
    const result = await response.json()
    if (!response.ok) return setError(result.error)
    setMessage(`Legal entity ${action}d.`)
    await load()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><h1 className="text-3xl font-semibold tracking-tight">Legal Entities</h1><p className="mt-2 text-sm text-muted-foreground">Manage LLCs and legal ownership entities for hotel properties.</p></div>
        {canManage && <Button onClick={startCreate}><Plus /> Create Legal Entity</Button>}
      </div>
      {message && <p className="text-sm text-emerald-700">{message}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Card>
        <CardHeader><h2 className="font-semibold">Legal Entities</h2></CardHeader>
        <CardContent className="p-0">
          <Table>
            <thead><tr><TableHead>Display name</TableHead><TableHead>Legal name</TableHead><TableHead>Organization</TableHead><TableHead>EIN</TableHead><TableHead>Properties</TableHead><TableHead>Status</TableHead>{canManage && <TableHead>Actions</TableHead>}</tr></thead>
            <tbody>{items.map((item) => <tr key={item.id}>
              <TableCell className="font-medium">{item.displayName}</TableCell><TableCell>{item.legalName}</TableCell><TableCell>{item.organization.name}</TableCell><TableCell>{item.ein ?? "—"}</TableCell><TableCell>{item._count.properties}</TableCell><TableCell><Badge>{item.status}</Badge></TableCell>
              {canManage && <TableCell><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => startEdit(item)}><Pencil /> Edit</Button><Button size="sm" variant="outline" onClick={() => changeStatus(item)}>{item.status === "ACTIVE" ? <UserMinus /> : <RotateCcw />}{item.status === "ACTIVE" ? "Deactivate" : "Reactivate"}</Button></div></TableCell>}
            </tr>)}</tbody>
          </Table>
          {!items.length && <p className="p-6 text-center text-sm text-muted-foreground">No legal entities found.</p>}
        </CardContent>
      </Card>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="overflow-y-auto sm:max-w-md"><form className="flex min-h-full flex-col" onSubmit={submit}>
          <SheetHeader><SheetTitle>{editingId ? "Edit" : "Create"} Legal Entity</SheetTitle><SheetDescription>Enter the LLC or legal ownership details.</SheetDescription></SheetHeader>
          <div className="space-y-4 px-4">
            <Field label="Organization"><select className={selectClass} required value={form.organizationId} onChange={(event) => setForm({ ...form, organizationId: event.target.value })}><option value="">Select organization</option>{organizations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
            <Field label="Legal name"><Input required value={form.legalName} onChange={(event) => setForm({ ...form, legalName: event.target.value })} /></Field>
            <Field label="Display name"><Input required value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} /></Field>
            <Field label="EIN"><Input value={form.ein} onChange={(event) => setForm({ ...form, ein: event.target.value })} /></Field>
            <Field label="Address"><Input value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3"><Field label="City"><Input value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} /></Field><Field label="State"><Input value={form.state} onChange={(event) => setForm({ ...form, state: event.target.value })} /></Field></div>
            <Field label="ZIP Code"><Input value={form.zipCode} onChange={(event) => setForm({ ...form, zipCode: event.target.value })} /></Field>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <SheetFooter><Button disabled={busy} type="submit">{busy ? "Saving..." : "Save"}</Button></SheetFooter>
        </form></SheetContent>
      </Sheet>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block space-y-1.5 text-sm font-medium"><span>{label}</span>{children}</label>
}
