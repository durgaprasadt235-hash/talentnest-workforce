"use client"

import { useCallback, useEffect, useId, useMemo, useState } from "react"
import { Download, RefreshCw, Search, X } from "lucide-react"

import { useCurrentUser } from "@/components/rbac/current-user-provider"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Table, TableCell, TableHead } from "@/components/ui/table"
import { Role } from "@/src/lib/rbac/roles"

type Option = { id: string; name?: string; firstName?: string; lastName?: string; role?: string; employeeNumber?: string }
type Audit = {
  id: string
  action: string
  entityType: string
  entityId: string | null
  organizationId: string | null
  propertyId: string | null
  departmentId: string | null
  employeeId: string | null
  userId: string | null
  metadata: Record<string, unknown> | null
  createdAt: string
  organization: Option | null
  property: Option | null
  user: Option | null
  employee: Option | null
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
    properties: Option[]
    users: Option[]
    employees: Option[]
    roles: string[]
  }
}
type Filters = {
  action: string
  entity: string
  propertyId: string
  employeeId: string
  userId: string
  role: string
  message: string
  dateFrom: string
  dateTo: string
  search: string
}

const emptyFilters: Filters = {
  action: "", entity: "", propertyId: "", employeeId: "", userId: "",
  role: "", message: "", dateFrom: "", dateTo: "", search: "",
}
const emptyData: AuditResponse = {
  records: [], totalCount: 0, page: 1, pageSize: 10, totalPages: 1,
  options: { actions: [], entities: [], properties: [], users: [], employees: [], roles: [] },
}

export default function AuditLogsPage() {
  const { currentUser } = useCurrentUser()
  const platform = currentUser.role === Role.PLATFORM_OWNER
  const endpoint = platform ? "/api/platform-audit-logs" : "/api/audit-logs"
  const title = platform ? "Platform Audit Logs" : currentUser.role === Role.PROPERTY_MANAGER ? "Property Audit Logs" : currentUser.role === Role.DEPARTMENT_MANAGER ? "Department Audit Logs" : isEmployeeRole(currentUser.role) ? "My Activity" : "Audit Logs"
  const [data, setData] = useState<AuditResponse>(emptyData)
  const [filters, setFilters] = useState<Filters>(emptyFilters)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [selected, setSelected] = useState<Audit | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const queryString = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
    Object.entries(filters).forEach(([key, value]) => value && params.set(key, value))
    return params.toString()
  }, [filters, page, pageSize])

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const response = await fetch(`${endpoint}?${queryString}`)
      const result = await response.json()
      if (!response.ok) return setError(result.error ?? "Unable to load audit logs.")
      setData(result)
    } catch {
      setError("Unable to load audit logs.")
    } finally {
      setLoading(false)
    }
  }, [endpoint, queryString])

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 250)
    return () => window.clearTimeout(timeout)
  }, [load])

  function updateFilter(key: keyof Filters, value: string) {
    setFilters((current) => ({ ...current, [key]: value }))
    setPage(1)
  }

  function clearFilters() {
    setFilters(emptyFilters)
    setPage(1)
  }

  function exportLogs(format: "csv" | "excel") {
    window.location.href = `${endpoint}?${queryString}&format=${format}`
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-semibold">{title}</h1><p className="text-sm text-muted-foreground">{data.totalCount} scoped records</p></div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => exportLogs("csv")}><Download /> CSV</Button>
          <Button size="sm" variant="outline" onClick={() => exportLogs("excel")}><Download /> Excel</Button>
          <Button size="sm" variant="outline" disabled={loading} onClick={() => void load()}><RefreshCw className={loading ? "animate-spin" : ""} /> Refresh</Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="sticky top-0 z-20 border-b bg-background p-3">
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative min-w-48 flex-1"><Search className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" /><Input className="h-9 pl-8" placeholder="Search audit logs" value={filters.search} onChange={(event) => updateFilter("search", event.target.value)} /></label>
            <SearchableFilter key={`action:${filters.action}:${data.options.actions.length}`} label="Action" value={filters.action} options={data.options.actions.map(valueOption)} onChange={(value) => updateFilter("action", value)} />
            <SearchableFilter key={`entity:${filters.entity}:${data.options.entities.length}`} label="Entity" value={filters.entity} options={data.options.entities.map(valueOption)} onChange={(value) => updateFilter("entity", value)} />
            {!platform && <SearchableFilter key={`property:${filters.propertyId}:${data.options.properties.length}`} label="Property" value={filters.propertyId} options={data.options.properties.map(namedOption)} onChange={(value) => updateFilter("propertyId", value)} />}
            {!platform && <SearchableFilter key={`employee:${filters.employeeId}:${data.options.employees.length}`} label="Employee" value={filters.employeeId} options={data.options.employees.map(personOption)} onChange={(value) => updateFilter("employeeId", value)} />}
            <SearchableFilter key={`user:${filters.userId}:${data.options.users.length}`} label="User" value={filters.userId} options={data.options.users.map(personOption)} onChange={(value) => updateFilter("userId", value)} />
            <SearchableFilter key={`role:${filters.role}:${data.options.roles.length}`} label="Role" value={filters.role} options={data.options.roles.map(valueOption)} onChange={(value) => updateFilter("role", value)} />
            <Input className="h-9 w-36" placeholder="Message" value={filters.message} onChange={(event) => updateFilter("message", event.target.value)} />
            <Input aria-label="Date from" className="h-9 w-36" type="date" value={filters.dateFrom} onChange={(event) => updateFilter("dateFrom", event.target.value)} />
            <Input aria-label="Date to" className="h-9 w-36" type="date" value={filters.dateTo} onChange={(event) => updateFilter("dateTo", event.target.value)} />
            <Button size="sm" variant="ghost" onClick={clearFilters}><X /> Clear filters</Button>
          </div>
        </div>

        {error && <p className="border-b bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
        <CardContent className="p-0">
          <Table containerClassName="max-h-[52vh] overflow-auto">
            <thead className="sticky top-0 z-10 bg-background shadow-sm">
              <tr><TableHead className="px-3 py-2">Action</TableHead><TableHead className="px-3 py-2">Entity</TableHead>{!platform && <TableHead className="px-3 py-2">Employee</TableHead>}<TableHead className="px-3 py-2">{platform ? "Organization" : "Property"}</TableHead><TableHead className="px-3 py-2">User / Role</TableHead><TableHead className="px-3 py-2">Message</TableHead><TableHead className="px-3 py-2">Date</TableHead><TableHead className="px-3 py-2">Details</TableHead></tr>
            </thead>
            <tbody>
              {data.records.map((record) => (
                <tr key={record.id} className="hover:bg-muted/30">
                  <TableCell className="max-w-44 truncate px-3 py-2 font-medium">{record.action}</TableCell>
                  <TableCell className="max-w-40 truncate px-3 py-2">{record.entityType}</TableCell>
                  {!platform && <TableCell className="max-w-44 truncate px-3 py-2">{personLabel(record.employee) || "-"}</TableCell>}
                  <TableCell className="max-w-44 truncate px-3 py-2">{platform ? record.organization?.name ?? record.organizationId ?? "-" : record.property?.name ?? "-"}</TableCell>
                  <TableCell className="max-w-48 truncate px-3 py-2">{record.user ? `${personLabel(record.user)} · ${record.user.role}` : "-"}</TableCell>
                  <TableCell className="max-w-64 truncate px-3 py-2 text-muted-foreground" title={message(record)}>{message(record)}</TableCell>
                  <TableCell className="whitespace-nowrap px-3 py-2 text-xs">{new Date(record.createdAt).toLocaleString()}</TableCell>
                  <TableCell className="px-3 py-2"><Button size="sm" variant="outline" onClick={() => setSelected(record)}>View</Button></TableCell>
                </tr>
              ))}
            </tbody>
          </Table>
          {!loading && data.records.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">No audit records match the current filters.</p>}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t p-3 text-sm">
            <span>{data.totalCount} total records</span>
            <div className="flex items-center gap-2">
              <label>Rows <select className="h-8 rounded-md border bg-background px-2" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1) }}>{[5, 10, 25, 50].map((size) => <option key={size}>{size}</option>)}</select></label>
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</Button>
              <span>Page {data.page} of {data.totalPages}</span>
              <Button size="sm" variant="outline" disabled={page >= data.totalPages} onClick={() => setPage((value) => value + 1)}>Next</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <DetailsDrawer record={selected} onClose={() => setSelected(null)} />
    </div>
  )
}

function SearchableFilter({ label, value, options, onChange }: { label: string; value: string; options: Array<{ value: string; label: string }>; onChange: (value: string) => void }) {
  const listId = useId()
  const selectedLabel = options.find((option) => option.value === value)?.label ?? ""
  const [text, setText] = useState(selectedLabel)

  function selectText(nextText: string) {
    setText(nextText)
    if (!nextText) return onChange("")
    const match = options.find((option) => option.label.toLocaleLowerCase() === nextText.toLocaleLowerCase())
    if (match) onChange(match.value)
  }

  return (
    <>
      <input
        aria-label={label}
        className="h-9 max-w-44 rounded-md border bg-background px-2 text-sm"
        list={listId}
        placeholder={`${label}: All`}
        value={text}
        onBlur={() => setText(options.find((option) => option.value === value)?.label ?? "")}
        onChange={(event) => selectText(event.target.value)}
      />
      <datalist id={listId}>{options.map((option) => <option key={option.value} value={option.label} />)}</datalist>
    </>
  )
}
function DetailsDrawer({ record, onClose }: { record: Audit | null; onClose: () => void }) {
  return <Sheet open={Boolean(record)} onOpenChange={(open) => !open && onClose()}><SheetContent className="overflow-y-auto sm:max-w-xl"><SheetHeader><SheetTitle>Audit details</SheetTitle><SheetDescription>Full immutable event context.</SheetDescription></SheetHeader>{record && <div className="space-y-3 px-4 pb-6 text-sm"><Detail label="Audit ID" value={record.id} /><Detail label="Action" value={record.action} /><Detail label="Entity" value={`${record.entityType} ${record.entityId ?? ""}`} /><Detail label="Actor" value={record.user ? `${personLabel(record.user)} · ${record.user.role}` : "System"} /><Detail label="Property" value={record.property?.name ?? record.propertyId ?? "-"} /><Detail label="Department" value={record.departmentId ?? "-"} /><Detail label="Employee" value={personLabel(record.employee) || record.employeeId || "-"} /><Detail label="Timestamp" value={new Date(record.createdAt).toLocaleString()} /><JsonDetail label="Before Value" value={record.metadata?.oldValue ?? record.metadata?.previous} /><JsonDetail label="After Value" value={record.metadata?.newValue ?? record.metadata?.current} /><JsonDetail label="Metadata JSON" value={record.metadata} /></div>}</SheetContent></Sheet>
}
function Detail({ label, value }: { label: string; value: string }) { return <p><span className="font-medium">{label}:</span> {value}</p> }
function JsonDetail({ label, value }: { label: string; value: unknown }) { return <div><p className="mb-1 font-medium">{label}</p><pre className="max-h-56 overflow-auto rounded-md border bg-muted/20 p-2 text-xs">{JSON.stringify(value ?? {}, null, 2)}</pre></div> }
function personLabel(option: Option | null) { return option ? [option.firstName, option.lastName].filter(Boolean).join(" ") : "" }
function namedOption(option: Option) { return { value: option.id, label: option.name ?? option.id } }
function personOption(option: Option) { return { value: option.id, label: `${personLabel(option)}${option.employeeNumber ? ` · ${option.employeeNumber}` : option.role ? ` · ${option.role}` : ""}` } }
function valueOption(value: string) { return { value, label: value.replaceAll("_", " ") } }
function message(record: Audit) { return String(record.metadata?.message ?? record.metadata?.note ?? record.metadata?.reason ?? "-") }
function isEmployeeRole(role: Role) {
  const employeeRoles: Role[] = [Role.EMPLOYEE, Role.FRONT_DESK, Role.HOUSEKEEPING, Role.MAINTENANCE, Role.NIGHT_AUDITOR]
  return employeeRoles.includes(role)
}
