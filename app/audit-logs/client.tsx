"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableCell, TableHead } from "@/components/ui/table"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"

type Audit = {
  id: string
  action: string
  entityType: string
  entityId?: string
  organizationId?: string
  propertyId?: string
  userId?: string
  metadata?: Record<string, any>
  createdAt: string
  organization?: { id: string; name: string }
  property?: { id: string; name: string }
  user?: { id: string; firstName: string; lastName: string; role: string }
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<Audit[]>([])
  const [loading, setLoading] = useState(false)
  const [qOrg, setQOrg] = useState("")
  const [qProp, setQProp] = useState("")
  const [qEmployee, setQEmployee] = useState("")
  const [qAction, setQAction] = useState("")
  const [qEntity, setQEntity] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [selected, setSelected] = useState<Audit | null>(null)

  async function load() {
    setLoading(true)
    const params = new URLSearchParams()
    if (qOrg) params.set("organizationId", qOrg)
    if (qProp) params.set("propertyId", qProp)
    if (qEmployee) params.set("employeeId", qEmployee)
    if (qAction) params.set("action", qAction)
    if (qEntity) params.set("entityType", qEntity)
    if (dateFrom) params.set("dateFrom", dateFrom)
    if (dateTo) params.set("dateTo", dateTo)

    const res = await fetch(`/api/audit-logs?${params.toString()}`)
    if (res.ok) setLogs(await res.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-end gap-3">
        <Input placeholder="Organization id" value={qOrg} onChange={(e) => setQOrg(e.target.value)} />
        <Input placeholder="Property id" value={qProp} onChange={(e) => setQProp(e.target.value)} />
        <Input placeholder="Employee id" value={qEmployee} onChange={(e) => setQEmployee(e.target.value)} />
        <Input placeholder="Action" value={qAction} onChange={(e) => setQAction(e.target.value)} />
        <Input placeholder="Entity type" value={qEntity} onChange={(e) => setQEntity(e.target.value)} />
        <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        <Button onClick={load} disabled={loading}>Filter</Button>
      </div>

      <Card>
        <CardHeader><h2 className="font-semibold">Audit logs</h2></CardHeader>
        <CardContent>
          <Table>
            <thead>
              <tr>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Property</TableHead>
                <TableHead>User / Role</TableHead>
                <TableHead>Message</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Details</TableHead>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <TableCell>{l.action}</TableCell>
                  <TableCell>{l.entityType} {l.entityId ?? ""}</TableCell>
                  <TableCell>{l.metadata?.employeeId ?? "-"}</TableCell>
                  <TableCell>{l.property?.name ?? l.propertyId ?? "-"}</TableCell>
                  <TableCell>{l.user ? `${l.user.firstName} ${l.user.lastName} (${l.user.role})` : "-"}</TableCell>
                  <TableCell>{l.metadata?.message ?? l.metadata?.note ?? "-"}</TableCell>
                  <TableCell>{new Date(l.createdAt).toLocaleString()}</TableCell>
                  <TableCell><Button size="sm" variant="outline" onClick={() => setSelected(l)}>View</Button></TableCell>
                </tr>
              ))}
            </tbody>
          </Table>
        </CardContent>
      </Card>

      <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Audit details</SheetTitle>
            <SheetDescription>Full details for the selected audit log.</SheetDescription>
          </SheetHeader>
          {selected && (
            <div className="space-y-4 px-4 pb-6">
              <div className="grid gap-3">
                <div><strong>Action:</strong> {selected.action}</div>
                <div><strong>Entity:</strong> {selected.entityType} {selected.entityId}</div>
                <div><strong>Entity ID:</strong> {selected.entityId}</div>
                <div><strong>Message:</strong> {selected.metadata?.message ?? selected.metadata?.note ?? ""}</div>
                <div><strong>Old value:</strong>
                  <pre className="rounded-md border bg-muted/20 p-2 text-sm">{JSON.stringify(selected.metadata?.oldValue ?? selected.metadata?.previous ?? {}, null, 2)}</pre>
                </div>
                <div><strong>New value:</strong>
                  <pre className="rounded-md border bg-muted/20 p-2 text-sm">{JSON.stringify(selected.metadata?.newValue ?? selected.metadata?.current ?? {}, null, 2)}</pre>
                </div>
                <div><strong>Timestamp:</strong> {new Date(selected.createdAt).toLocaleString()}</div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
