"use client"

import { useCallback, useEffect, useState } from "react"

import { useCurrentUser } from "@/components/rbac/current-user-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Table, TableCell, TableHead } from "@/components/ui/table"
import { hasPermission } from "@/src/lib/rbac/guards"
import { Permission } from "@/src/lib/rbac/permissions"

type Option = { id: string; name: string }
type PropertyOption = Option & { organizationId: string }
type Device = {
  id: string
  deviceName: string
  deviceCode: string | null
  deviceType: string
  status: string
  organization: Option | null
  property: Option | null
  deviceFingerprint: Record<string, unknown> | null
  lastSeenAt: string | null
  createdAt: string
}

type Assignment = {
  organizationId: string
  propertyId: string
  deviceName: string
  deviceType: string
}

export function DeviceManagement() {
  const { currentUser } = useCurrentUser()
  const canManage = hasPermission(currentUser, Permission.MANAGE_DEVICES)
  const [devices, setDevices] = useState<Device[]>([])
  const [organizations, setOrganizations] = useState<Option[]>([])
  const [properties, setProperties] = useState<PropertyOption[]>([])
  const [assignments, setAssignments] = useState<Record<string, Assignment>>({})
  const [error, setError] = useState("")
  const [busyDeviceId, setBusyDeviceId] = useState("")

  const load = useCallback(async () => {
    const response = await fetch("/api/attendance/devices")
    const data = await response.json()
    if (!response.ok) throw new Error(data.error)
    setDevices(data.devices)
    setOrganizations(data.organizations)
    setProperties(data.properties)
  }, [])

  useEffect(() => {
    // Initial remote synchronization is intentionally client-side for the MVP.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load().catch((caught: Error) => setError(caught.message))
  }, [load])

  function setAssignment(deviceId: string, update: Partial<Assignment>) {
    setAssignments((current) => ({
      ...current,
      [deviceId]: {
        organizationId: current[deviceId]?.organizationId ?? "",
        propertyId: current[deviceId]?.propertyId ?? "",
        deviceName: current[deviceId]?.deviceName ?? devices.find((device) => device.id === deviceId)?.deviceName ?? "",
        deviceType: current[deviceId]?.deviceType ?? devices.find((device) => device.id === deviceId)?.deviceType ?? "KIOSK",
        ...update,
      },
    }))
  }

  async function approve(deviceId: string) {
    const assignment = assignments[deviceId]
    if (!assignment?.organizationId || !assignment.propertyId) {
      return setError("Select an organization and property before approval.")
    }

    setBusyDeviceId(deviceId)
    setError("")
    const response = await fetch(`/api/attendance/devices/${deviceId}/approve`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(assignment),
    })
    const data = await response.json()
    setBusyDeviceId("")
    if (!response.ok) return setError(data.error)
    await load()
  }

  async function reject(deviceId: string) {
    setBusyDeviceId(deviceId)
    setError("")
    const response = await fetch(`/api/attendance/devices/${deviceId}/reject`, {
      method: "POST",
    })
    const data = await response.json()
    setBusyDeviceId("")
    if (!response.ok) return setError(data.error)
    await load()
  }

  async function deactivate(deviceId: string) {
    setBusyDeviceId(deviceId)
    setError("")
    const response = await fetch(`/api/attendance/devices/${deviceId}/deactivate`, {
      method: "PATCH",
    })
    const data = await response.json()
    setBusyDeviceId("")
    if (!response.ok) return setError(data.error)
    await load()
  }

  const pendingDevices = devices.filter((device) => device.status === "PENDING")
  const reviewedDevices = devices.filter((device) => device.status !== "PENDING")

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">
          {canManage ? "Device Management" : "Device Status & Troubleshooting"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {canManage
            ? "Approve attendance kiosk requests and assign each device to a property."
            : "Review kiosk status, device codes, and last-seen activity for your properties."}
        </p>
      </div>

      {error && <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error}</p>}

      {canManage && <Card>
        <CardHeader>
          <h2 className="font-semibold">Pending device requests</h2>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <thead><tr><TableHead>Device name</TableHead><TableHead>Type</TableHead><TableHead>Fingerprint</TableHead><TableHead>Status</TableHead><TableHead>Last seen</TableHead><TableHead>Organization</TableHead><TableHead>Property</TableHead><TableHead>Actions</TableHead></tr></thead>
            <tbody>
              {pendingDevices.map((device) => {
                const assignment = assignments[device.id]
                const availableProperties = properties.filter(
                  (property) => property.organizationId === assignment?.organizationId,
                )

                return (
                  <tr key={device.id}>
                    <TableCell>
                      <input
                        aria-label={`Device name for ${device.deviceName}`}
                        value={assignment?.deviceName ?? device.deviceName}
                        onChange={(event) => setAssignment(device.id, { deviceName: event.target.value })}
                        className="h-9 w-48 rounded-lg border bg-background px-2 text-sm"
                      />
                      <p className="mt-1 text-xs text-muted-foreground">{new Date(device.createdAt).toLocaleString()}</p>
                    </TableCell>
                    <TableCell>
                      <select
                        aria-label={`Device type for ${device.deviceName}`}
                        value={assignment?.deviceType ?? device.deviceType}
                        onChange={(event) => setAssignment(device.id, { deviceType: event.target.value })}
                        className="h-9 rounded-lg border bg-background px-2 text-sm"
                      >
                        <option value="KIOSK">Kiosk</option>
                        <option value="TABLET">Tablet</option>
                        <option value="DESKTOP_TERMINAL">Desktop terminal</option>
                      </select>
                    </TableCell>
                    <TableCell className="max-w-64 text-xs text-muted-foreground">
                      {formatFingerprint(device.deviceFingerprint)}
                    </TableCell>
                    <TableCell><DeviceStatus status={device.status} /></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatTimestamp(device.lastSeenAt)}</TableCell>
                    <TableCell>
                      <select
                        aria-label={`Organization for ${device.deviceName}`}
                        value={assignment?.organizationId ?? ""}
                        onChange={(event) => setAssignment(device.id, { organizationId: event.target.value, propertyId: "" })}
                        className="h-9 rounded-lg border bg-background px-2 text-sm"
                      >
                        <option value="">Select organization</option>
                        {organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}
                      </select>
                    </TableCell>
                    <TableCell>
                      <select
                        aria-label={`Property for ${device.deviceName}`}
                        value={assignment?.propertyId ?? ""}
                        onChange={(event) => setAssignment(device.id, { propertyId: event.target.value })}
                        className="h-9 rounded-lg border bg-background px-2 text-sm"
                      >
                        <option value="">Select property</option>
                        {availableProperties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}
                      </select>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" disabled={busyDeviceId === device.id} onClick={() => approve(device.id)}>Approve</Button>
                        <Button size="sm" variant="outline" disabled={busyDeviceId === device.id} onClick={() => reject(device.id)}>Reject</Button>
                      </div>
                    </TableCell>
                  </tr>
                )
              })}
            </tbody>
          </Table>
          {pendingDevices.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">No pending device requests.</p>}
        </CardContent>
      </Card>}

      <Card>
        <CardHeader>
          <h2 className="font-semibold">Reviewed devices</h2>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <thead><tr><TableHead>Name</TableHead><TableHead>Property</TableHead><TableHead>Type</TableHead><TableHead>Device code</TableHead><TableHead>Status</TableHead><TableHead>Last seen</TableHead>{canManage && <TableHead>Actions</TableHead>}</tr></thead>
            <tbody>
              {reviewedDevices.map((device) => (
                <tr key={device.id}>
                  <TableCell>{device.deviceName}</TableCell>
                  <TableCell>{device.property?.name ?? "Not assigned"}</TableCell>
                  <TableCell>{device.deviceType}</TableCell>
                  <TableCell className="font-mono text-xs">{device.deviceCode ?? "Not generated"}</TableCell>
                  <TableCell><DeviceStatus status={device.status} /></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatTimestamp(device.lastSeenAt)}</TableCell>
                  {canManage && (
                    <TableCell>
                      {device.status === "ACTIVE" ? (
                        <Button size="sm" variant="outline" disabled={busyDeviceId === device.id} onClick={() => deactivate(device.id)}>
                          Deactivate
                        </Button>
                      ) : "—"}
                    </TableCell>
                  )}
                </tr>
              ))}
            </tbody>
          </Table>
          {reviewedDevices.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">No reviewed devices.</p>}
        </CardContent>
      </Card>

      <p className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
        Kiosks request approval automatically using a browser fingerprint. Full device identity and lockdown require native Android/iPad MDM integration.
      </p>
      {/* TODO: integrate Android Enterprise kiosk mode and iPad supervised single app mode for full device lockdown. */}
    </div>
  )
}

function formatFingerprint(fingerprint: Record<string, unknown> | null) {
  if (!fingerprint) return "Unavailable"
  return [fingerprint.platform, fingerprint.language, fingerprint.screenSize]
    .filter((value) => typeof value === "string")
    .join(" / ")
}

function formatTimestamp(timestamp: string | null) {
  return timestamp ? new Date(timestamp).toLocaleString() : "Never"
}

function DeviceStatus({ status }: { status: string }) {
  const label = status.charAt(0) + status.slice(1).toLowerCase()
  return <Badge className={status === "ACTIVE" ? "" : "bg-muted text-muted-foreground"}>{label}</Badge>
}
