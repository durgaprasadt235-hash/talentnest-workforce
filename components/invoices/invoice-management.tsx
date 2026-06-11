"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import { useCurrentUser } from "@/components/rbac/current-user-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Table, TableCell, TableHead } from "@/components/ui/table"
import { mockRoleHeaders } from "@/src/lib/rbac/mock-auth"

type Option = { id: string; name: string }
type PropertyOption = Option & { organizationId: string }
type Invoice = {
  id: string
  invoiceNumber: string
  type: "DIRECT" | "STAFFING" | "CONSOLIDATED"
  status: "DRAFT" | "SENT" | "PAID" | "VOID"
  billingWeekStart: string
  billingWeekEnd: string
  directHours: string
  staffingHours: string
  totalHours: string
  rate: string
  totalAmount: string
  dueAt: string | null
  sentAt: string | null
  paidAt: string | null
  createdAt: string
  organization: Option
  property: PropertyOption
  staffingCompany: { id: string; displayName: string } | null
  batch: { id: string; status: string }
}
type InvoiceDetail = Invoice & {
  batch: {
    id: string
    status: string
    weekStartDate: string
    weekEndDate: string
  }
  lines: Array<{
    id: string
    regularHours: string
    overtimeHours: string
    totalHours: string
    employee: {
      employeeNumber: string
      firstName: string
      lastName: string
    }
    department: { name: string } | null
    staffingCompany: { displayName: string } | null
  }>
}
type Summary = {
  totalInvoices: number
  draftAmount: number
  outstandingAmount: number
  paidAmount: number
  overdueAmount: number
}

const statusOptions = ["DRAFT", "SENT", "PAID", "VOID"]
const typeOptions = ["DIRECT", "STAFFING", "CONSOLIDATED"]

export function InvoiceManagement() {
  const { currentUser } = useCurrentUser()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [organizations, setOrganizations] = useState<Option[]>([])
  const [properties, setProperties] = useState<PropertyOption[]>([])
  const [summary, setSummary] = useState<Summary>({
    totalInvoices: 0,
    draftAmount: 0,
    outstandingAmount: 0,
    paidAmount: 0,
    overdueAmount: 0,
  })
  const [detail, setDetail] = useState<InvoiceDetail | null>(null)
  const [filters, setFilters] = useState({
    organizationId: "",
    propertyId: "",
    status: "",
    type: "",
    from: "",
    to: "",
    search: "",
  })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  const headers = useMemo(
    () => mockRoleHeaders(currentUser.role, currentUser),
    [currentUser],
  )
  const isFinance = currentUser.role === "FINANCE_USER"
  const visibleProperties = properties.filter(
    (property) => !filters.organizationId || property.organizationId === filters.organizationId,
  )

  const load = useCallback(async () => {
    const query = new URLSearchParams()
    Object.entries(filters).forEach(([key, value]) => {
      if (value) query.set(key, value)
    })
    const response = await fetch(`/api/weekly-attendance/invoices?${query}`, { headers })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error)
    setInvoices(data.invoices)
    setOrganizations(data.options.organizations)
    setProperties(data.options.properties)
    setSummary(data.summary)
  }, [filters, headers])

  useEffect(() => {
    // Initial remote synchronization is intentionally client-side.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load().catch((caught: Error) => setError(caught.message))
  }, [load])

  async function viewInvoice(id: string) {
    setBusy(true)
    setError("")
    try {
      const response = await fetch(`/api/weekly-attendance/invoices/${id}`, { headers })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      setDetail(data.invoice)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load invoice.")
    } finally {
      setBusy(false)
    }
  }

  async function action(id: string, actionName: "mark-sent" | "mark-paid" | "void") {
    setBusy(true)
    setError("")
    setMessage("")
    try {
      const response = await fetch(`/api/weekly-attendance/invoices/${id}/${actionName}`, {
        method: "POST",
        headers,
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      setMessage(actionName === "mark-sent" ? "Invoice marked sent." : actionName === "mark-paid" ? "Invoice marked paid." : "Invoice voided.")
      await load()
      if (detail?.id === id) await viewInvoice(id)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Invoice action failed.")
    } finally {
      setBusy(false)
    }
  }

  async function download(invoice: Invoice) {
    setBusy(true)
    setError("")
    try {
      const response = await fetch(`/api/weekly-attendance/invoices/${invoice.id}/export`, { headers })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error)
      }
      const url = URL.createObjectURL(await response.blob())
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = `${invoice.invoiceNumber}.csv`
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Invoice download failed.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Invoices</h1>
        <p className="mt-2 text-sm text-muted-foreground">Manage invoices created from approved weekly attendance.</p>
      </div>

      {(message || error) && (
        <p className={error ? "rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive" : "rounded-lg border bg-muted/40 p-4 text-sm"}>
          {error || message}
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-5">
        <SummaryCard label="Total invoices" value={String(summary.totalInvoices)} />
        <SummaryCard label="Draft amount" value={currency(summary.draftAmount)} />
        <SummaryCard label="Sent / outstanding" value={currency(summary.outstandingAmount)} />
        <SummaryCard label="Paid amount" value={currency(summary.paidAmount)} />
        <SummaryCard label="Overdue amount" value={currency(summary.overdueAmount)} />
      </div>

      <Card>
        <CardHeader><h2 className="font-semibold">Filters</h2></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4 xl:grid-cols-7">
          <SelectField label="Organization" value={filters.organizationId} onChange={(value) => setFilters((current) => ({ ...current, organizationId: value, propertyId: "" }))} options={organizations} />
          <SelectField label="Property" value={filters.propertyId} onChange={(value) => setFilters((current) => ({ ...current, propertyId: value }))} options={visibleProperties} />
          <SelectField label="Status" value={filters.status} onChange={(value) => setFilters((current) => ({ ...current, status: value }))} options={statusOptions.map(option)} />
          <SelectField label="Invoice type" value={filters.type} onChange={(value) => setFilters((current) => ({ ...current, type: value }))} options={typeOptions.map(option)} />
          <InputField label="From" type="date" value={filters.from} onChange={(value) => setFilters((current) => ({ ...current, from: value }))} />
          <InputField label="To" type="date" value={filters.to} onChange={(value) => setFilters((current) => ({ ...current, to: value }))} />
          <InputField label="Invoice number" value={filters.search} onChange={(value) => setFilters((current) => ({ ...current, search: value }))} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><h2 className="font-semibold">Invoice list</h2></CardHeader>
        <CardContent className="p-0">
          <Table>
            <thead><tr><TableHead>Invoice number</TableHead><TableHead>Organization</TableHead><TableHead>Property</TableHead><TableHead>Type</TableHead><TableHead>Staffing company</TableHead><TableHead>Billing week</TableHead><TableHead>Direct hours</TableHead><TableHead>Staffing hours</TableHead><TableHead>Total hours</TableHead><TableHead>Total amount</TableHead><TableHead>Status</TableHead><TableHead>Created</TableHead><TableHead>Actions</TableHead></tr></thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.id}>
                  <TableCell className="font-mono text-xs">{invoice.invoiceNumber}</TableCell>
                  <TableCell>{invoice.organization.name}</TableCell>
                  <TableCell>{invoice.property.name}</TableCell>
                  <TableCell>{invoice.type}</TableCell>
                  <TableCell>{invoice.staffingCompany?.displayName ?? "--"}</TableCell>
                  <TableCell>{date(invoice.billingWeekStart)} - {date(invoice.billingWeekEnd)}</TableCell>
                  <TableCell>{hours(invoice.directHours)}</TableCell>
                  <TableCell>{hours(invoice.staffingHours)}</TableCell>
                  <TableCell>{hours(invoice.totalHours)}</TableCell>
                  <TableCell>{currency(Number(invoice.totalAmount))}</TableCell>
                  <TableCell><Badge>{invoice.status.toLowerCase()}</Badge></TableCell>
                  <TableCell>{date(invoice.createdAt)}</TableCell>
                  <TableCell><div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => viewInvoice(invoice.id)}>View</Button>
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => download(invoice)}>Download</Button>
                    {isFinance && invoice.status === "DRAFT" && <Button size="sm" disabled={busy} onClick={() => action(invoice.id, "mark-sent")}>Mark sent</Button>}
                    {isFinance && invoice.status === "SENT" && <Button size="sm" disabled={busy} onClick={() => action(invoice.id, "mark-paid")}>Mark paid</Button>}
                    {isFinance && invoice.status === "DRAFT" && <Button size="sm" variant="outline" disabled={busy} onClick={() => action(invoice.id, "void")}>Void</Button>}
                  </div></TableCell>
                </tr>
              ))}
            </tbody>
          </Table>
          {invoices.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">No invoices match the selected filters.</p>}
        </CardContent>
      </Card>

      <Sheet open={Boolean(detail)} onOpenChange={(open) => { if (!open) setDetail(null) }}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-3xl">
          {detail && <InvoiceSheet invoice={detail} />}
        </SheetContent>
      </Sheet>
    </div>
  )
}

function InvoiceSheet({ invoice }: { invoice: InvoiceDetail }) {
  return (
    <>
      <SheetHeader>
        <SheetTitle>{invoice.invoiceNumber}</SheetTitle>
        <SheetDescription>{invoice.organization.name} · {invoice.property.name}</SheetDescription>
      </SheetHeader>
      <div className="space-y-6 px-4 pb-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <Detail label="Invoice type" value={invoice.type} />
          <Detail label="Status" value={invoice.status} />
          <Detail label="Staffing company" value={invoice.staffingCompany?.displayName ?? "Direct employees"} />
          <Detail label="Related weekly batch" value={`${invoice.batch.id} (${invoice.batch.status})`} />
          <Detail label="Billing period" value={`${date(invoice.billingWeekStart)} - ${date(invoice.billingWeekEnd)}`} />
          <Detail label="Direct hours" value={hours(invoice.directHours)} />
          <Detail label="Staffing hours" value={hours(invoice.staffingHours)} />
          <Detail label="Total hours" value={hours(invoice.totalHours)} />
          <Detail label="Rate" value={currency(Number(invoice.rate))} />
          <Detail label="Total amount" value={currency(Number(invoice.totalAmount))} />
          <Detail label="Created at" value={dateTime(invoice.createdAt)} />
          <Detail label="Sent at" value={invoice.sentAt ? dateTime(invoice.sentAt) : "--"} />
          <Detail label="Paid at" value={invoice.paidAt ? dateTime(invoice.paidAt) : "--"} />
        </div>
        <div>
          <h3 className="mb-3 font-semibold">Line breakdown</h3>
          <Table>
            <thead><tr><TableHead>Employee</TableHead><TableHead>Department</TableHead><TableHead>Staffing company</TableHead><TableHead>Regular</TableHead><TableHead>Overtime</TableHead><TableHead>Total</TableHead></tr></thead>
            <tbody>{invoice.lines.map((line) => <tr key={line.id}>
              <TableCell><p className="font-medium">{line.employee.firstName} {line.employee.lastName}</p><p className="text-xs text-muted-foreground">{line.employee.employeeNumber}</p></TableCell>
              <TableCell>{line.department?.name ?? "Not assigned"}</TableCell>
              <TableCell>{line.staffingCompany?.displayName ?? "Direct"}</TableCell>
              <TableCell>{hours(line.regularHours)}</TableCell>
              <TableCell>{hours(line.overtimeHours)}</TableCell>
              <TableCell>{hours(line.totalHours)}</TableCell>
            </tr>)}</tbody>
          </Table>
        </div>
      </div>
    </>
  )
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return <Card><CardContent><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p></CardContent></Card>
}
function Detail({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border p-3"><p className="text-xs font-medium text-muted-foreground">{label}</p><p className="mt-1 break-words font-medium">{value}</p></div>
}
function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Option[] }) {
  return <label className="space-y-2 text-sm font-medium"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="h-9 w-full rounded-lg border bg-background px-3"><option value="">All</option>{options.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
}
function InputField({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <label className="space-y-2 text-sm font-medium"><span>{label}</span><Input type={type} value={value} onChange={(event) => onChange(event.target.value)} /></label>
}
function option(value: string) {
  return { id: value, name: value.toLowerCase().replaceAll("_", " ") }
}
function hours(value: string) {
  return Number(value).toFixed(2)
}
function currency(value: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(value)
}
function date(value: string) {
  return new Date(value).toLocaleDateString(undefined, { timeZone: "UTC" })
}
function dateTime(value: string) {
  return new Date(value).toLocaleString()
}
