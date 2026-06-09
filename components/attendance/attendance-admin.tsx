"use client"

import { useCallback, useEffect, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useCurrentUser } from "@/components/rbac/current-user-provider"
import { Table, TableCell, TableHead } from "@/components/ui/table"
import { mockRoleHeaders } from "@/src/lib/rbac/mock-auth"

type Employee = { firstName: string; lastName: string; employeeNumber: string }
type Property = { name: string }
type OpenRecord = { id: string; status: string; clockInAt?: string; employee: Employee; property: Property }
type Exception = { id: string; exceptionType: string; reason: string; employee: Employee; property: Property }
type Freeze = { id: string; reason: string; employee: Employee; property: Property }
type Alert = { id: string; alertType: string; recipientRole: string; message: string; status: string }
type AdminData = { openRecords: OpenRecord[]; exceptions: Exception[]; freezes: Freeze[]; alerts: Alert[] }

const emptyData: AdminData = { openRecords: [], exceptions: [], freezes: [], alerts: [] }

export function AttendanceAdmin() {
  const { currentUser } = useCurrentUser()
  const [data, setData] = useState<AdminData>(emptyData)
  const [note, setNote] = useState("")
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    const response = await fetch("/api/attendance/admin", {
      headers: mockRoleHeaders(currentUser.role),
    })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error)
    setData(result)
  }, [currentUser.role])

  useEffect(() => {
    // Initial remote synchronization is intentionally client-side for the MVP.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load().catch((caught: Error) => setError(caught.message))
  }, [load])

  async function runCheck(path: string, label: string) {
    const response = await fetch(path, {
      method: "POST",
      headers: mockRoleHeaders(currentUser.role),
    })
    const result = await response.json()
    if (!response.ok) return setError(result.error)
    setMessage(`${label} completed. ${result.checked} record(s) checked.`)
    await load()
  }

  async function resolve(exceptionId: string, status: "APPROVED" | "REJECTED") {
    const response = await fetch("/api/attendance/admin/exceptions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...mockRoleHeaders(currentUser.role),
      },
      body: JSON.stringify({ exceptionId, status, note }),
    })
    const result = await response.json()
    if (!response.ok) return setError(result.error)
    setMessage(`Exception ${status.toLowerCase()}.`)
    await load()
  }

  async function release(freezeId: string) {
    const response = await fetch("/api/attendance/admin/freezes", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...mockRoleHeaders(currentUser.role),
      },
      body: JSON.stringify({ freezeId, note }),
    })
    const result = await response.json()
    if (!response.ok) return setError(result.error)
    setMessage("Employee freeze released.")
    await load()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Attendance Admin</h1>
          <p className="mt-2 text-sm text-muted-foreground">Review exceptions, frozen employees, open attendance, and operational alerts.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => runCheck("/api/attendance/admin/check-no-shows", "No-show check")}>Run No-Show Check</Button>
          <Button variant="outline" onClick={() => runCheck("/api/attendance/admin/check-missed-clock-outs", "Missed clock-out check")}>Run Missed Clock-Out Check</Button>
        </div>
      </div>
      <Input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Manager note for next action" />
      {(message || error) && <p className={error ? "text-sm text-destructive" : "text-sm text-foreground"}>{error || message}</p>}

      <AdminTable title="Pending exceptions" empty="No pending exceptions." headers={["Employee", "Property", "Exception", "Reason", "Actions"]}>
        {data.exceptions.map((item) => (
          <tr key={item.id}>
            <TableCell>{item.employee.firstName} {item.employee.lastName}</TableCell>
            <TableCell>{item.property.name}</TableCell>
            <TableCell><Badge>{item.exceptionType}</Badge></TableCell>
            <TableCell>{item.reason}</TableCell>
            <TableCell><div className="flex gap-2"><Button size="sm" onClick={() => resolve(item.id, "APPROVED")}>Approve</Button><Button size="sm" variant="outline" onClick={() => resolve(item.id, "REJECTED")}>Reject</Button></div></TableCell>
          </tr>
        ))}
      </AdminTable>

      <AdminTable title="Frozen employees" empty="No active attendance freezes." headers={["Employee", "Property", "Reason", "Action"]}>
        {data.freezes.map((item) => (
          <tr key={item.id}>
            <TableCell>{item.employee.firstName} {item.employee.lastName}</TableCell>
            <TableCell>{item.property.name}</TableCell>
            <TableCell>{item.reason}</TableCell>
            <TableCell><Button size="sm" onClick={() => release(item.id)}>Release freeze</Button></TableCell>
          </tr>
        ))}
      </AdminTable>

      <AdminTable title="Open attendance records" empty="No open attendance records." headers={["Employee", "Property", "Clock in", "Status"]}>
        {data.openRecords.map((item) => (
          <tr key={item.id}>
            <TableCell>{item.employee.firstName} {item.employee.lastName}</TableCell>
            <TableCell>{item.property.name}</TableCell>
            <TableCell>{item.clockInAt ? new Date(item.clockInAt).toLocaleString() : "Pending"}</TableCell>
            <TableCell><Badge>{item.status}</Badge></TableCell>
          </tr>
        ))}
      </AdminTable>

      <AdminTable title="Alerts" empty="No attendance alerts." headers={["Type", "Recipient", "Message", "Status"]}>
        {data.alerts.map((item) => (
          <tr key={item.id}>
            <TableCell><Badge>{item.alertType}</Badge></TableCell>
            <TableCell>{item.recipientRole}</TableCell>
            <TableCell>{item.message}</TableCell>
            <TableCell>{item.status}</TableCell>
          </tr>
        ))}
      </AdminTable>
      <p className="text-sm text-muted-foreground">Attendance alerts are stored in-app. Email, SMS, and push delivery will be added later.</p>
    </div>
  )
}

function AdminTable({
  title,
  headers,
  children,
  empty,
}: {
  title: string
  headers: string[]
  children: React.ReactNode
  empty: string
}) {
  const hasRows = Array.isArray(children) ? children.length > 0 : Boolean(children)

  return (
    <Card>
      <CardHeader><h2 className="font-semibold">{title}</h2></CardHeader>
      <CardContent className="p-0">
        <Table>
          <thead><tr>{headers.map((header) => <TableHead key={header}>{header}</TableHead>)}</tr></thead>
          <tbody>{children}</tbody>
        </Table>
        {!hasRows && <p className="p-6 text-center text-sm text-muted-foreground">{empty}</p>}
      </CardContent>
    </Card>
  )
}
