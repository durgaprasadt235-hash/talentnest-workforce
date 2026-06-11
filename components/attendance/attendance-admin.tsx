"use client"

import { useCallback, useEffect, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useCurrentUser } from "@/components/rbac/current-user-provider"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Table, TableCell, TableHead } from "@/components/ui/table"
import { mockRoleHeaders } from "@/src/lib/rbac/mock-auth"

type Employee = { firstName: string; lastName: string; employeeNumber: string }
type Property = { name: string }

type AttendanceRecord = {
  id: string
  status: string
  exceptionType: string | null
  managerApprovalStatus: string
  clockInAt: string | null
  clockOutAt: string | null
  clockInPhotoUrl: string | null
  clockOutPhotoUrl: string | null
  clockInLatitude: number | null
  clockInLongitude: number | null
  clockOutLatitude: number | null
  clockOutLongitude: number | null
  createdAt: string
  updatedAt: string
  employee: Employee
  property: Property
  department: { name: string } | null
  device: { deviceName: string; deviceCode: string | null }
}

type Exception = { id: string; exceptionType: string; reason: string; employee: Employee; property: Property }
type Freeze = { id: string; reason: string; employee: Employee; property: Property }
type Alert = { id: string; alertType: string; recipientRole: string; message: string; status: string }

type Correction = {
  id: string
  correctionType: string
  reason: string
  status: string
  requestedClockInAt: string | null
  requestedClockOutAt: string | null
  createdAt: string
  updatedAt: string
  employee: Employee
  property: Property
  attendanceRecord?: {
    id: string
    clockInAt: string | null
    clockOutAt: string | null
  } | null
}

type AdminData = {
  openRecords: AttendanceRecord[]
  exceptions: Exception[]
  freezes: Freeze[]
  alerts: Alert[]
  correctionRequests: Correction[]
}

const emptyData: AdminData = {
  openRecords: [],
  exceptions: [],
  freezes: [],
  alerts: [],
  correctionRequests: [],
}

export function AttendanceAdmin() {
  const { currentUser } = useCurrentUser()
  const [data, setData] = useState<AdminData>(emptyData)
  const [note, setNote] = useState("")
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null)
  const [selectedCorrection, setSelectedCorrection] = useState<Correction | null>(null)
  const [showRejectionSheet, setShowRejectionSheet] = useState(false)
  const [rejectionReason, setRejectionReason] = useState<string>("Requested time is incorrect")
  const [rejectionOtherNote, setRejectionOtherNote] = useState<string>("")
  const [previewPhoto, setPreviewPhoto] = useState<{ src: string; label: string } | null>(null)

  const load = useCallback(async () => {
    const response = await fetch("/api/attendance/admin", {
      headers: mockRoleHeaders(currentUser.role),
    })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error)
    setData(result)
  }, [currentUser.role])

  useEffect(() => {
    load().catch((caught: Error) => setError(caught.message))
  }, [load])

  async function runCheck(path: string, label: string) {
    setError("")
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
    setError("")
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

  async function resolveCorrection(correctionId: string, status: "APPROVED" | "REJECTED") {
    setError("")

    const payload: any = { correctionId, status }
    // note is optional for approve, required for reject (enforced by server validation)
    if (status === "REJECTED") {
      // use rejection state if present, otherwise fall back to global note
      payload.note = rejectionReason === "Other" ? rejectionOtherNote || note : rejectionReason || note
      if (!payload.note || !String(payload.note).trim()) {
        setError("Rejection note is required.")
        return
      }
    }

    const response = await fetch("/api/attendance/admin/corrections", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...mockRoleHeaders(currentUser.role),
      },
      body: JSON.stringify(payload),
    })

    const result = await response.json()
    if (!response.ok) return setError(result.error)

    setMessage(`Correction request ${status.toLowerCase()}.`)
    setSelectedCorrection(null)
    setShowRejectionSheet(false)
    setRejectionOtherNote("")
    await load()
  }

  function openRejection(correction: Correction) {
    setSelectedCorrection(correction)
    setRejectionReason("Requested time is incorrect")
    setRejectionOtherNote("")
    setShowRejectionSheet(true)
  }

  async function release(freezeId: string) {
    setError("")
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
          <p className="mt-2 text-sm text-muted-foreground">
            Review exceptions, frozen employees, open attendance, correction requests, and operational alerts.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => runCheck("/api/attendance/admin/check-no-shows", "No-show check")}>
            Run No-Show Check
          </Button>
          <Button variant="outline" onClick={() => runCheck("/api/attendance/admin/check-missed-clock-outs", "Missed clock-out check")}>
            Run Missed Clock-Out Check
          </Button>
        </div>
      </div>

      <Input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Manager note for exception/freeze actions" />
      {(message || error) && <p className={error ? "text-sm text-destructive" : "text-sm text-foreground"}>{error || message}</p>}

      <AdminTable title="Pending exceptions" empty="No pending exceptions." headers={["Employee", "Property", "Exception", "Reason", "Actions"]}>
        {data.exceptions.map((item) => (
          <tr key={item.id}>
            <TableCell>{employeeName(item.employee)}</TableCell>
            <TableCell>{item.property.name}</TableCell>
            <TableCell><Badge>{formatException(item.exceptionType)}</Badge></TableCell>
            <TableCell>{item.reason}</TableCell>
            <TableCell>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => resolve(item.id, "APPROVED")}>Approve</Button>
                <Button size="sm" variant="outline" onClick={() => resolve(item.id, "REJECTED")}>Reject</Button>
              </div>
            </TableCell>
          </tr>
        ))}
      </AdminTable>

      <AdminTable title="Frozen employees" empty="No active attendance freezes." headers={["Employee", "Property", "Reason", "Action"]}>
        {data.freezes.map((item) => (
          <tr key={item.id}>
            <TableCell>{employeeName(item.employee)}</TableCell>
            <TableCell>{item.property.name}</TableCell>
            <TableCell>{item.reason}</TableCell>
            <TableCell><Button size="sm" onClick={() => release(item.id)}>Release freeze</Button></TableCell>
          </tr>
        ))}
      </AdminTable>

      <AdminTable
        title="Recent attendance records"
        empty="No attendance records."
        scrollable
        headers={[
          "Employee",
          "Property",
          "Department",
          "Clock In",
          "Clock Out",
          "Total Hours",
          "Clock In Photo",
          "Clock Out Photo",
          "Exception",
          "Manager Approval",
          "Status",
          "Device",
          "Actions",
        ]}
      >
        {data.openRecords.map((item) => (
          <tr key={item.id} className="h-[75px]">
            <TableCell className="whitespace-nowrap">{employeeName(item.employee)}</TableCell>
            <TableCell className="whitespace-nowrap">{item.property.name}</TableCell>
            <TableCell className="whitespace-nowrap">{item.department?.name ?? "--"}</TableCell>
            <TableCell className="whitespace-nowrap">{formatTimestamp(item.clockInAt, "Pending")}</TableCell>
            <TableCell className="whitespace-nowrap">{formatTimestamp(item.clockOutAt, "Still clocked in")}</TableCell>
            <TableCell className="whitespace-nowrap">{formatTotalHours(item)}</TableCell>
            <TableCell>
              <PhotoThumbnail
                src={item.clockInPhotoUrl}
                label={`Clock-in photo for ${employeeName(item.employee)}`}
                onPreview={setPreviewPhoto}
              />
            </TableCell>
            <TableCell>
              <PhotoThumbnail
                src={item.clockOutPhotoUrl}
                label={`Clock-out photo for ${employeeName(item.employee)}`}
                onPreview={setPreviewPhoto}
              />
            </TableCell>
            <TableCell>{item.exceptionType ? <Badge>{formatException(item.exceptionType)}</Badge> : "None"}</TableCell>
            <TableCell><Badge>{formatEnum(item.managerApprovalStatus)}</Badge></TableCell>
            <TableCell><Badge>{formatEnum(item.status)}</Badge></TableCell>
            <TableCell className="whitespace-nowrap">{item.device.deviceName}</TableCell>
            <TableCell><Button size="sm" variant="outline" onClick={() => setSelectedRecord(item)}>View</Button></TableCell>
          </tr>
        ))}
      </AdminTable>

      <AdminTable
        title="Pending correction requests"
        empty="No pending correction requests."
        headers={["Employee", "Property", "Correction", "Reason", "Requested At", "Status", "Actions"]}
      >
        {data.correctionRequests.map((item) => (
          <tr key={item.id}>
            <TableCell>{employeeName(item.employee)}</TableCell>
            <TableCell>{item.property.name}</TableCell>
            <TableCell><Badge>{formatEnum(item.correctionType)}</Badge></TableCell>
            <TableCell>{item.reason}</TableCell>
            <TableCell>{formatTimestamp(item.createdAt)}</TableCell>
            <TableCell><Badge>{formatEnum(item.status)}</Badge></TableCell>
            <TableCell>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => setSelectedCorrection(item)}>View</Button>
                <Button size="sm" onClick={() => resolveCorrection(item.id, "APPROVED")}>Approve</Button>
                <Button size="sm" variant="outline" onClick={() => openRejection(item)}>Reject</Button>
              </div>
            </TableCell>
          </tr>
        ))}
      </AdminTable>

      <AdminTable title="Alerts" empty="No attendance alerts." headers={["Type", "Recipient", "Message", "Status"]}>
        {data.alerts.map((item) => (
          <tr key={item.id}>
            <TableCell><Badge>{formatEnum(item.alertType)}</Badge></TableCell>
            <TableCell>{item.recipientRole}</TableCell>
            <TableCell>{item.message}</TableCell>
            <TableCell>{formatEnum(item.status)}</TableCell>
          </tr>
        ))}
      </AdminTable>

      <p className="text-sm text-muted-foreground">
        Attendance alerts are stored in-app. Email, SMS, and push delivery will be added later.
      </p>

      <AttendanceDetails record={selectedRecord} onOpenChange={(open) => !open && setSelectedRecord(null)} onPreview={setPreviewPhoto} />
      <CorrectionDetails
        correction={selectedCorrection}
        onOpenChange={(open) => !open && setSelectedCorrection(null)}
        onApprove={() => selectedCorrection && resolveCorrection(selectedCorrection.id, "APPROVED")}
        onReject={() => selectedCorrection && selectedCorrection && openRejection(selectedCorrection)}
      />
      <PhotoPreview photo={previewPhoto} onOpenChange={(open) => !open && setPreviewPhoto(null)} />
      <Sheet open={showRejectionSheet} onOpenChange={(open) => !open && setShowRejectionSheet(false)}>
        <SheetContent className="overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Reject correction request</SheetTitle>
            <SheetDescription>Please provide a rejection reason for this correction request.</SheetDescription>
          </SheetHeader>

          {selectedCorrection && (
            <div className="space-y-6 px-4 pb-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <DetailField label="Employee" value={employeeName(selectedCorrection.employee)} />
                <DetailField label="Correction type" value={formatEnum(selectedCorrection.correctionType)} />
              </div>

              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Employee reason</p>
                <p className="rounded-md border bg-muted/20 p-3 text-sm">{selectedCorrection.reason}</p>
              </div>

              <label className="space-y-2 text-sm">
                <span className="text-sm font-medium">Rejection reason</span>
                <select value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} className="h-9 w-full rounded-lg border bg-background px-2.5 text-sm">
                  <option>Requested time is incorrect</option>
                  <option>Insufficient explanation provided</option>
                  <option>Attendance record already corrected</option>
                  <option>Duplicate correction request</option>
                  <option>Correction conflicts with approved records</option>
                  <option>Employee must contact manager</option>
                  <option>Other</option>
                </select>
              </label>

              {rejectionReason === "Other" && (
                <div>
                  <p className="text-sm font-medium">Additional manager note</p>
                  <Input value={rejectionOtherNote} onChange={(e) => setRejectionOtherNote(e.target.value)} placeholder="Explain rejection (required)" />
                </div>
              )}

              <div className="flex gap-2">
                <Button onClick={() => selectedCorrection && resolveCorrection(selectedCorrection.id, "REJECTED")}>Submit rejection</Button>
                <Button variant="outline" onClick={() => setShowRejectionSheet(false)}>Cancel</Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

function formatException(exceptionType: string) {
  return exceptionType === "UNSCHEDULED_CLOCK_IN" ? "Unscheduled clock-in" : formatEnum(exceptionType)
}

function formatEnum(value: string) {
  return value.replaceAll("_", " ")
}

function employeeName(employee: Employee) {
  return `${employee.firstName} ${employee.lastName}`
}

function formatTimestamp(value: string | null, fallback = "--") {
  return value ? new Date(value).toLocaleString() : fallback
}

function formatTotalHours(record: Pick<AttendanceRecord, "clockInAt" | "clockOutAt">) {
  if (!record.clockInAt || !record.clockOutAt) return "--"
  const milliseconds = new Date(record.clockOutAt).getTime() - new Date(record.clockInAt).getTime()
  return `${(Math.max(milliseconds, 0) / 3_600_000).toFixed(2)} hrs`
}

function formatCoordinates(latitude: number | null, longitude: number | null) {
  return latitude === null || longitude === null ? "--" : `${latitude}, ${longitude}`
}

function PhotoThumbnail({
  src,
  label,
  onPreview,
}: {
  src: string | null
  label: string
  onPreview: (photo: { src: string; label: string }) => void
}) {
  if (!src) return <span className="text-muted-foreground">--</span>

  return (
    <button
      type="button"
      className="block overflow-hidden rounded-md border transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={() => onPreview({ src, label })}
      aria-label={`Open ${label}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={label} className="size-12 object-cover" />
    </button>
  )
}

function CorrectionDetails({
  correction,
  onOpenChange,
  onApprove,
  onReject,
}: {
  correction: Correction | null
  onOpenChange: (open: boolean) => void
  onApprove: () => void
  onReject: () => void
}) {
  return (
    <Sheet open={Boolean(correction)} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Correction request details</SheetTitle>
          <SheetDescription>Review the employee correction request before approving or rejecting.</SheetDescription>
        </SheetHeader>

        {correction && (
          <div className="space-y-6 px-4 pb-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <DetailField label="Employee" value={employeeName(correction.employee)} />
              <DetailField label="Employee number" value={correction.employee.employeeNumber} />
              <DetailField label="Property" value={correction.property.name} />
              <DetailField label="Correction type" value={formatEnum(correction.correctionType)} />
              <DetailField label="Status" value={formatEnum(correction.status)} />
              <DetailField label="Requested at" value={formatTimestamp(correction.createdAt)} />
              <DetailField label="Requested clock in" value={formatTimestamp(correction.requestedClockInAt)} />
              <DetailField label="Requested clock out" value={formatTimestamp(correction.requestedClockOutAt)} />
              <DetailField label="Original clock in" value={formatTimestamp(correction.attendanceRecord?.clockInAt ?? null)} />
              <DetailField label="Original clock out" value={formatTimestamp(correction.attendanceRecord?.clockOutAt ?? null)} />
            </div>

            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Reason</p>
              <p className="rounded-md border bg-muted/20 p-3 text-sm">{correction.reason}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={onApprove}>Approve</Button>
              <Button variant="outline" onClick={onReject}>Reject</Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

function AttendanceDetails({
  record,
  onOpenChange,
  onPreview,
}: {
  record: AttendanceRecord | null
  onOpenChange: (open: boolean) => void
  onPreview: (photo: { src: string; label: string }) => void
}) {
  return (
    <Sheet open={Boolean(record)} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>Attendance record details</SheetTitle>
          <SheetDescription>Recorded punch, employee, device, and review information.</SheetDescription>
        </SheetHeader>
        {record && (
          <div className="space-y-6 px-4 pb-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <DetailField label="Employee" value={employeeName(record.employee)} />
              <DetailField label="Employee number" value={record.employee.employeeNumber} />
              <DetailField label="Property" value={record.property.name} />
              <DetailField label="Department" value={record.department?.name ?? "--"} />
              <DetailField label="Device name" value={record.device.deviceName} />
              <DetailField label="Device code" value={record.device.deviceCode ?? "--"} />
              <DetailField label="Clock-in timestamp" value={formatTimestamp(record.clockInAt)} />
              <DetailField label="Clock-out timestamp" value={formatTimestamp(record.clockOutAt, "Still clocked in")} />
              <DetailField label="Total hours" value={formatTotalHours(record)} />
              <DetailField label="Clock-in coordinates" value={formatCoordinates(record.clockInLatitude, record.clockInLongitude)} />
              <DetailField label="Clock-out coordinates" value={formatCoordinates(record.clockOutLatitude, record.clockOutLongitude)} />
              <DetailField label="Exception type" value={record.exceptionType ? formatException(record.exceptionType) : "None"} />
              <DetailField label="Manager approval status" value={formatEnum(record.managerApprovalStatus)} />
              <DetailField label="Attendance status" value={formatEnum(record.status)} />
              <DetailField label="Created at" value={formatTimestamp(record.createdAt)} />
              <DetailField label="Updated at" value={formatTimestamp(record.updatedAt)} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <DetailPhoto src={record.clockInPhotoUrl} label={`Clock-in photo for ${employeeName(record.employee)}`} onPreview={onPreview} />
              <DetailPhoto src={record.clockOutPhotoUrl} label={`Clock-out photo for ${employeeName(record.employee)}`} onPreview={onPreview} />
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="break-words">{value}</p>
    </div>
  )
}

function DetailPhoto({
  src,
  label,
  onPreview,
}: {
  src: string | null
  label: string
  onPreview: (photo: { src: string; label: string }) => void
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label.startsWith("Clock-in") ? "Clock-in photo" : "Clock-out photo"}
      </p>
      {src ? (
        <button type="button" className="block w-full overflow-hidden rounded-lg border" onClick={() => onPreview({ src, label })}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={label} className="max-h-64 w-full object-contain" />
        </button>
      ) : (
        <div className="flex h-32 items-center justify-center rounded-lg border bg-muted/30 text-sm text-muted-foreground">
          No photo recorded
        </div>
      )}
    </div>
  )
}

function PhotoPreview({
  photo,
  onOpenChange,
}: {
  photo: { src: string; label: string } | null
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Sheet open={Boolean(photo)} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-3xl">
        <SheetHeader>
          <SheetTitle>Photo preview</SheetTitle>
          <SheetDescription>{photo?.label}</SheetDescription>
        </SheetHeader>
        {photo && (
          <div className="px-4 pb-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.src} alt={photo.label} className="max-h-[80vh] w-full rounded-lg border object-contain" />
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

function AdminTable({
  title,
  headers,
  children,
  empty,
  scrollable = false,
}: {
  title: string
  headers: string[]
  children: React.ReactNode
  empty: string
  scrollable?: boolean
}) {
  const hasRows = Array.isArray(children) ? children.length > 0 : Boolean(children)

  return (
    <Card>
      <CardHeader><h2 className="font-semibold">{title}</h2></CardHeader>
      <CardContent className="p-0">
        <Table containerClassName={scrollable ? "max-h-[420px] overflow-auto" : undefined}>
          <thead>
            <tr>
              {headers.map((header) => (
                <TableHead key={header} className={scrollable ? "sticky top-0 z-10 bg-muted" : undefined}>
                  {header}
                </TableHead>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </Table>
        {!hasRows && <p className="p-6 text-center text-sm text-muted-foreground">{empty}</p>}
      </CardContent>
    </Card>
  )
}
