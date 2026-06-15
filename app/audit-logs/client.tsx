"use client"

import { useCallback, useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Table, TableCell, TableHead } from "@/components/ui/table"

type Named = { id: string; name: string }
type Person = { id: string; firstName: string; lastName: string; role?: string; employeeNumber?: string }
type Audit = {
  id: string
  action: string
  entityType: string
  entityId: string | null
  metadata: Record<string, unknown> | null
  createdAt: string
  organization: Named | null
  property: Named | null
  user: Person | null
  employee: Person | null
}
type Filters = {
  action: string
  entity: string
  employeeId: string
  propertyId: string
  userId: string
  role: string
  message: string
  dateFrom: string
  dateTo: string
}
type AuditResponse = {
  records: Audit[]
  totalCount: number
  page: number
  pageSize: number
  totalPages: number
  options: {
    actions: string[]
    entities: string[]
    employees: Person[]
    properties: Named[]
    users: Person[]
    roles: string[]
  }
}

const emptyFilters: Filters = {
  action: "", entity: "", employeeId: "", propertyId: "", userId: "",
  role: "", message: "", dateFrom: "", dateTo: "",
}
const emptyResponse: AuditResponse = {
  records: [], totalCount: 0, page: 1, pageSize: 10, totalPages: 1,
  options: { actions: [], entities: [], employees: [], properties: [], users: [], roles: [] },
}
const selectClass = "h-8 min-w-32 rounded-md border bg-background px-2 text-xs"

export default function AuditLogsPage() {
  const [data, setData] = useState<AuditResponse>(emptyResponse)
  const [filters, setFilters] = useState<Filters>(emptyFilters)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [selected, setSelected] = useState<Audit | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
    Object.entries(filters).forEach(([key, value]) => value && params.set(key, value))
    try {
      const response = await fetch(`/api/audit-logs?${params}`)
      const result = await response.json()
      if (!response.ok) throw new Error(result.error)
      setData(result)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load audit logs.")
    } finally {
      setLoading(false)
    }
  }, [filters, page, pageSize])

  useEffect(() => {
    // Audit logs are filtered and paginated from the client controls.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  function updateFilter(key: keyof Filters, value: string) {
    setPage(1)
    setFilters((current) => ({ ...current, [key]: value }))
  }

  function clearFilters() {
    setPage(1)
    setFilters(emptyFilters)
  }

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Audit Logs</h1>
        <p className="text-sm text-muted-foreground">Review scoped activity and operational changes.</p>
      </div>

      <Card>
        <CardContent className="space-y-3 p-3">
          <div className="flex flex-wrap items-end gap-2">
            <CompactSelect label="Action" value={filters.action} onChange={(value) => updateFilter("action", value)} options={data.options.actions.map((value) => ({ value, label: value }))} />
            <CompactSelect label="Entity" value={filters.entity} onChange={(value) => updateFilter("entity", value)} options={data.options.entities.map((value) => ({ value, label: value }))} />
            <CompactSelect label="Employee" value={filters.employeeId} onChange={(value) => updateFilter("employeeId", value)} options={data.options.employees.map((item) => ({ value: item.id, label: `${item.firstName} ${item.lastName} · ${item.employeeNumber}` }))} />
            <CompactSelect label="Property" value={filters.propertyId} onChange={(value) => updateFilter("propertyId", value)} options={data.options.properties.map((item) => ({ value: item.id, label: item.name }))} />
            <CompactSelect label="User" value={filters.userId} onChange={(value) => updateFilter("userId", value)} options={data.options.users.map((item) => ({ value: item.id, label: `${item.firstName} ${item.lastName}` }))} />
            <CompactSelect label="Role" value={filters.role} onChange={(value) => updateFilter("role", value)} options={data.options.roles.map((value) => ({ value, label: value }))} />
            <label className="grid gap-1 text-[11px] font-medium text-muted-foreground">Message<Input className="h-8 w-40 text-xs" value={filters.message} onChange={(event) => updateFilter("message", event.target.value)} placeholder="Search message" /></label>
            <label className="grid gap-1 text-[11px] font-medium text-muted-foreground">From<Input className="h-8 w-32 text-xs" type="date" value={filters.dateFrom} onChange={(event) => updateFilter("dateFrom", event.target.value)} /></label>
            <label className="grid gap-1 text-[11px] font-medium text-muted-foreground">To<Input className="h-8 w-32 text-xs" type="date" value={filters.dateTo} onChange={(event) => updateFilter("dateTo", event.target.value)} /></label>
            <Button size="sm" variant="outline" className="h-8" onClick={clearFilters}>Clear filters</Button>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Table containerClassName="max-h-[46vh] min-h-64 overflow-auto rounded-md border">
            <thead className="sticky top-0 z-10 bg-background">
              <tr>
                <TableHead className="px-2 py-2 text-xs">Action</TableHead>
                <TableHead className="px-2 py-2 text-xs">Entity</TableHead>
                <TableHead className="px-2 py-2 text-xs">Employee</TableHead>
                <TableHead className="px-2 py-2 text-xs">Property</TableHead>
                <TableHead className="px-2 py-2 text-xs">User / Role</TableHead>
                <TableHead className="px-2 py-2 text-xs">Message</TableHead>
                <TableHead className="px-2 py-2 text-xs">Date</TableHead>
                <TableHead className="px-2 py-2 text-xs">Details</TableHead>
              </tr>
            </thead>
            <tbody>
              {data.records.map((log) => (
                <tr key={log.id}>
                  <TableCell className="max-w-44 truncate px-2 py-2 text-xs font-medium">{log.action}</TableCell>
                  <TableCell className="max-w-40 truncate px-2 py-2 text-xs">{log.entityType}</TableCell>
                  <TableCell className="max-w-44 truncate px-2 py-2 text-xs">{personName(log.employee)}</TableCell>
                  <TableCell className="max-w-40 truncate px-2 py-2 text-xs">{log.property?.name ?? "—"}</TableCell>
                  <TableCell className="max-w-48 truncate px-2 py-2 text-xs">{log.user ? `${personName(log.user)} · ${log.user.role}` : "—"}</TableCell>
                  <TableCell className="max-w-56 truncate px-2 py-2 text-xs" title={message(log)}>{message(log)}</TableCell>
                  <TableCell className="whitespace-nowrap px-2 py-2 text-xs">{new Date(log.createdAt).toLocaleString()}</TableCell>
                  <TableCell className="px-2 py-1"><Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setSelected(log)}>View Details</Button></TableCell>
                </tr>
              ))}
            </tbody>
          </Table>
          {!loading && data.records.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">No audit logs match these filters.</p>}

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <p>{loading ? "Loading..." : `${data.totalCount} records · Page ${data.page} of ${data.totalPages}`}</p>
            <div className="flex items-center gap-2">
              <label>Rows per page <select className="ml-1 h-8 rounded-md border bg-background px-2" value={pageSize} onChange={(event) => { setPage(1); setPageSize(Number(event.target.value)) }}>{[5, 10, 25].map((size) => <option key={size}>{size}</option>)}</select></label>
              <Button size="sm" variant="outline" className="h-8" disabled={loading || page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</Button>
              <span className="min-w-14 text-center">Page {data.page}</span>
              <Button size="sm" variant="outline" className="h-8" disabled={loading || page >= data.totalPages} onClick={() => setPage((value) => value + 1)}>Next</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="overflow-y-auto sm:max-w-xl">
          <SheetHeader><SheetTitle>Audit details</SheetTitle><SheetDescription>Full details for the selected audit record.</SheetDescription></SheetHeader>
          {selected && <div className="space-y-3 px-4 pb-6 text-sm"><Detail label="Action" value={selected.action} /><Detail label="Entity" value={`${selected.entityType} ${selected.entityId ?? ""}`} /><Detail label="Employee" value={personName(selected.employee)} /><Detail label="Property" value={selected.property?.name ?? "—"} /><Detail label="User / Role" value={selected.user ? `${personName(selected.user)} · ${selected.user.role}` : "—"} /><Detail label="Message" value={message(selected)} /><Detail label="Timestamp" value={new Date(selected.createdAt).toLocaleString()} /><pre className="overflow-auto rounded-md border bg-muted/30 p-3 text-xs">{JSON.stringify(selected.metadata ?? {}, null, 2)}</pre></div>}
        </SheetContent>
      </Sheet>
    </div>
  )
}

function CompactSelect({ label, value, options, onChange }: { label: string; value: string; options: Array<{ value: string; label: string }>; onChange: (value: string) => void }) {
  return <label className="grid gap-1 text-[11px] font-medium text-muted-foreground">{label}<select className={selectClass} value={value} onChange={(event) => onChange(event.target.value)}><option value="">All</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
}
function Detail({ label, value }: { label: string; value: string }) {
  return <p><span className="font-medium">{label}:</span> {value}</p>
}
function personName(person: Person | null) {
  return person ? `${person.firstName} ${person.lastName}` : "—"
}
function message(log: Audit) {
  const value = log.metadata?.message ?? log.metadata?.note
  return typeof value === "string" ? value : "—"
}
