"use client"

import { useCallback, useEffect, useState, type FormEvent } from "react"
import { Plus } from "lucide-react"

import { useCurrentUser } from "@/components/rbac/current-user-provider"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableCell, TableHead } from "@/components/ui/table"
import { hasPermission } from "@/src/lib/rbac/guards"
import { Permission } from "@/src/lib/rbac/permissions"

type Company = { id: string; legalName: string; displayName: string; contactName: string | null; email: string | null; phone: string | null; billingEmail: string | null; status: string; organization: { name: string } }
type Organization = { id: string; name: string }
const emptyForm = { organizationId: "", legalName: "", displayName: "", contactName: "", email: "", phone: "", billingEmail: "" }

export function StaffingCompanyManagement() {
  const { currentUser } = useCurrentUser()
  const canManage = hasPermission(currentUser, Permission.MANAGE_STAFFING_COMPANIES)
  const [companies, setCompanies] = useState<Company[]>([])
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ ...emptyForm, organizationId: currentUser.organizationId ?? "" })
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    const [companiesResponse, organizationsResponse] = await Promise.all([fetch("/api/staffing-companies"), fetch("/api/organizations")])
    const companyData = await companiesResponse.json()
    const organizationData = await organizationsResponse.json()
    if (!companiesResponse.ok) throw new Error(companyData.error)
    setCompanies(companyData.staffingCompanies)
    if (organizationsResponse.ok) setOrganizations(organizationData.organizations)
  }, [])
  useEffect(() => {
    // Initial remote synchronization is intentionally client-side.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load().catch((caught: Error) => setError(caught.message))
  }, [load])

  async function submit(event: FormEvent) {
    event.preventDefault()
    const response = await fetch("/api/staffing-companies", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...form, contactName: form.contactName || null, email: form.email || null, phone: form.phone || null, billingEmail: form.billingEmail || null, status: "ACTIVE" }) })
    const body = await response.json()
    if (!response.ok) return setError(body.error)
    setOpen(false)
    setForm({ ...emptyForm, organizationId: currentUser.organizationId ?? "" })
    await load()
  }

  return <div className="space-y-6">
    <div className="flex items-start justify-between gap-4"><div><h1 className="text-3xl font-semibold">Staffing Companies</h1><p className="mt-2 text-sm text-muted-foreground">Manage staffing partners for your organization.</p></div>{canManage && <Button onClick={() => setOpen((value) => !value)}><Plus /> Create Staffing Company</Button>}</div>
    {error && <p className="text-sm text-destructive">{error}</p>}
    {open && <Card><CardHeader><h2 className="font-semibold">Create staffing company</h2></CardHeader><CardContent><form className="grid gap-3 md:grid-cols-2" onSubmit={submit}>
      <select required disabled={Boolean(currentUser.organizationId)} className="h-10 rounded-lg border bg-background px-3 text-sm" value={form.organizationId} onChange={(event) => setForm({ ...form, organizationId: event.target.value })}><option value="">Organization</option>{organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}</select>
      <Input required placeholder="Company name" value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value, legalName: event.target.value })} />
      <Input placeholder="Contact name" value={form.contactName} onChange={(event) => setForm({ ...form, contactName: event.target.value })} />
      <Input type="email" placeholder="Contact email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
      <Input placeholder="Contact phone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
      <Input type="email" placeholder="Billing email" value={form.billingEmail} onChange={(event) => setForm({ ...form, billingEmail: event.target.value })} />
      <Button type="submit">Create</Button>
    </form></CardContent></Card>}
    <Card><CardContent className="p-0"><Table><thead><tr><TableHead>Company</TableHead><TableHead>Organization</TableHead><TableHead>Contact</TableHead><TableHead>Billing email</TableHead><TableHead>Status</TableHead></tr></thead><tbody>{companies.map((company) => <tr key={company.id}><TableCell>{company.displayName}</TableCell><TableCell>{company.organization.name}</TableCell><TableCell>{company.contactName ?? "—"}<br /><span className="text-xs text-muted-foreground">{company.email ?? company.phone}</span></TableCell><TableCell>{company.billingEmail ?? "—"}</TableCell><TableCell>{company.status}</TableCell></tr>)}</tbody></Table>{!companies.length && <p className="p-6 text-center text-sm text-muted-foreground">No staffing companies configured.</p>}</CardContent></Card>
  </div>
}
