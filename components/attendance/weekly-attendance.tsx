"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import { useCurrentUser } from "@/components/rbac/current-user-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableCell, TableHead } from "@/components/ui/table"
import { hasPermission } from "@/src/lib/rbac/guards"
import { mockRoleHeaders } from "@/src/lib/rbac/mock-auth"
import { Permission } from "@/src/lib/rbac/permissions"

type Option = { id: string; name: string }
type PropertyOption = Option & { organizationId: string }
type BatchSummary = {
  id: string
  weekStartDate: string
  weekEndDate: string
  status: string
  generatedAt: string
  organization: Option
  property: Option
  _count: { lines: number }
}
type AttendanceLine = {
  id: string
  regularHours: string
  overtimeHours: string
  totalHours: string
  missingPunchCount: number
  exceptionCount: number
  correctionPendingCount: number
  approvalStatus: string
  managerNote: string | null
  employee: {
    employeeNumber: string
    firstName: string
    lastName: string
  }
  department: Option | null
  staffingCompany: { id: string; displayName: string } | null
}
type BatchDetail = Omit<BatchSummary, "_count"> & {
  approvedAt: string | null
  lines: AttendanceLine[]
}

export function WeeklyAttendance() {
  const { currentUser } = useCurrentUser()
  const [batches, setBatches] = useState<BatchSummary[]>([])
  const [organizations, setOrganizations] = useState<Option[]>([])
  const [properties, setProperties] = useState<PropertyOption[]>([])
  const [organizationId, setOrganizationId] = useState("")
  const [propertyId, setPropertyId] = useState("")
  const [weekStartDate, setWeekStartDate] = useState(currentWeekStart())
  const [selectedBatch, setSelectedBatch] = useState<BatchDetail | null>(null)
  const [managerNote, setManagerNote] = useState("")
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  const headers = useMemo(
    () => mockRoleHeaders(currentUser.role),
    [currentUser.role],
  )

  const load = useCallback(async () => {
    const response = await fetch("/api/weekly-attendance", { headers })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error)
    setBatches(data.batches)
    setOrganizations(data.options.organizations)
    setProperties(data.options.properties)
  }, [headers])

  const loadBatch = useCallback(
    async (id: string) => {
      const response = await fetch(`/api/weekly-attendance/${id}`, { headers })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      setSelectedBatch(data.batch)
    },
    [headers],
  )

  useEffect(() => {
    // Initial remote synchronization is intentionally client-side.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load().catch((caught: Error) => setError(caught.message))
  }, [load])

  const availableProperties = properties.filter(
    (property) => property.organizationId === organizationId,
  )
  const canGenerate = hasPermission(
    currentUser,
    Permission.GENERATE_WEEKLY_ATTENDANCE,
  )
  const canApprove = hasPermission(
    currentUser,
    Permission.APPROVE_WEEKLY_ATTENDANCE,
  )
  const canLock = hasPermission(currentUser, Permission.LOCK_WEEKLY_ATTENDANCE)

  async function generate() {
    if (!organizationId || !propertyId || !weekStartDate) {
      return setError("Select an organization, property, and week.")
    }
    await runAction("/api/weekly-attendance/generate", {
      organizationId,
      propertyId,
      weekStartDate,
    }, "Weekly attendance batch is ready.")
  }

  async function approve() {
    if (!selectedBatch) return
    await runAction(
      `/api/weekly-attendance/${selectedBatch.id}/approve`,
      { overrideNote: managerNote || undefined },
      "Weekly attendance approved and payroll-ready.",
    )
  }

  async function requestCorrections() {
    if (!selectedBatch) return
    if (!managerNote.trim()) {
      return setError("Enter a manager note before requesting corrections.")
    }
    await runAction(
      `/api/weekly-attendance/${selectedBatch.id}/request-corrections`,
      { managerNote },
      "Corrections requested.",
    )
  }

  async function lock() {
    if (!selectedBatch) return
    await runAction(
      `/api/weekly-attendance/${selectedBatch.id}/lock`,
      undefined,
      "Weekly attendance batch locked.",
    )
  }

  async function runAction(
    path: string,
    body: Record<string, unknown> | undefined,
    successMessage: string,
  ) {
    setBusy(true)
    setError("")
    setMessage("")
    try {
      const response = await fetch(path, {
        method: "POST",
        headers: {
          ...(body ? { "content-type": "application/json" } : {}),
          ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      setSelectedBatch(data.batch)
      setManagerNote("")
      setMessage(successMessage)
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Action failed.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Weekly Attendance</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Generate, review, approve, and lock weekly attendance before payroll.
        </p>
      </div>

      {(message || error) && (
        <p className={error ? "rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive" : "rounded-lg border bg-muted/40 p-4 text-sm"}>
          {error || message}
        </p>
      )}

      {canGenerate && (
        <Card>
          <CardHeader><h2 className="font-semibold">Generate weekly attendance</h2></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-4">
            <SelectField label="Organization" value={organizationId} onChange={(value) => { setOrganizationId(value); setPropertyId("") }} options={organizations} />
            <SelectField label="Property" value={propertyId} onChange={setPropertyId} options={availableProperties} />
            <label className="space-y-2 text-sm font-medium">
              <span>Week starting</span>
              <Input type="date" value={weekStartDate} onChange={(event) => setWeekStartDate(event.target.value)} />
            </label>
            <div className="flex items-end">
              <Button disabled={busy} className="w-full" onClick={generate}>Generate weekly attendance</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><h2 className="font-semibold">Weekly batches</h2></CardHeader>
        <CardContent className="p-0">
          <Table>
            <thead><tr><TableHead>Week</TableHead><TableHead>Organization</TableHead><TableHead>Property</TableHead><TableHead>Lines</TableHead><TableHead>Status</TableHead><TableHead>Action</TableHead></tr></thead>
            <tbody>
              {batches.map((batch) => (
                <tr key={batch.id}>
                  <TableCell>{formatDate(batch.weekStartDate)} - {formatDate(batch.weekEndDate)}</TableCell>
                  <TableCell>{batch.organization.name}</TableCell>
                  <TableCell>{batch.property.name}</TableCell>
                  <TableCell>{batch._count.lines}</TableCell>
                  <TableCell><StatusBadge status={batch.status} /></TableCell>
                  <TableCell><Button size="sm" variant="outline" onClick={() => loadBatch(batch.id).catch((caught: Error) => setError(caught.message))}>View</Button></TableCell>
                </tr>
              ))}
            </tbody>
          </Table>
          {batches.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">No weekly attendance batches.</p>}
        </CardContent>
      </Card>

      {selectedBatch && (
        <Card>
          <CardHeader className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h2 className="font-semibold">{selectedBatch.property.name}: {formatDate(selectedBatch.weekStartDate)} - {formatDate(selectedBatch.weekEndDate)}</h2>
              <div className="mt-2"><StatusBadge status={selectedBatch.status} /></div>
            </div>
            <div className="flex flex-wrap gap-2">
              {canApprove && selectedBatch.status !== "APPROVED" && selectedBatch.status !== "LOCKED" && (
                <>
                  <Button disabled={busy} onClick={approve}>Approve batch</Button>
                  <Button disabled={busy} variant="outline" onClick={requestCorrections}>Request corrections</Button>
                </>
              )}
              {canLock && selectedBatch.status === "APPROVED" && <Button disabled={busy} onClick={lock}>Lock approved batch</Button>}
            </div>
          </CardHeader>
          <CardContent className="space-y-4 p-0">
            {canApprove && selectedBatch.status !== "LOCKED" && (
              <div className="px-5 pt-5">
                <Input value={managerNote} onChange={(event) => setManagerNote(event.target.value)} placeholder="Manager note or missing-punch override note" />
              </div>
            )}
            <Table>
              <thead><tr><TableHead>Employee</TableHead><TableHead>Department</TableHead><TableHead>Staffing company</TableHead><TableHead>Regular</TableHead><TableHead>Overtime</TableHead><TableHead>Total</TableHead><TableHead>Missing punches</TableHead><TableHead>Exceptions</TableHead><TableHead>Corrections</TableHead><TableHead>Approval</TableHead></tr></thead>
              <tbody>
                {selectedBatch.lines.map((line) => (
                  <tr key={line.id}>
                    <TableCell><p className="font-medium">{line.employee.firstName} {line.employee.lastName}</p><p className="text-xs text-muted-foreground">{line.employee.employeeNumber}</p></TableCell>
                    <TableCell>{line.department?.name ?? "Not assigned"}</TableCell>
                    <TableCell>{line.staffingCompany?.displayName ?? "Direct"}</TableCell>
                    <TableCell>{formatHours(line.regularHours)}</TableCell>
                    <TableCell>{formatHours(line.overtimeHours)}</TableCell>
                    <TableCell className="font-medium">{formatHours(line.totalHours)}</TableCell>
                    <TableCell>{line.missingPunchCount}</TableCell>
                    <TableCell>{line.exceptionCount}</TableCell>
                    <TableCell>{line.correctionPendingCount > 0 ? `${line.correctionPendingCount} pending` : line.managerNote ?? "None"}</TableCell>
                    <TableCell><StatusBadge status={line.approvalStatus} /></TableCell>
                  </tr>
                ))}
              </tbody>
            </Table>
            {selectedBatch.lines.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">No attendance records were found for this property and week.</p>}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: Option[]
}) {
  return (
    <label className="space-y-2 text-sm font-medium">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-8 w-full rounded-lg border bg-background px-2.5 text-sm">
        <option value="">Select {label.toLowerCase()}</option>
        {options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
      </select>
    </label>
  )
}

function StatusBadge({ status }: { status: string }) {
  return <Badge>{status.replaceAll("_", " ").toLowerCase()}</Badge>
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { timeZone: "UTC" })
}

function formatHours(value: string) {
  return Number(value).toFixed(2)
}

function currentWeekStart() {
  const now = new Date()
  const day = now.getDay()
  const mondayOffset = day === 0 ? -6 : 1 - day
  now.setDate(now.getDate() + mondayOffset)
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-")
}
