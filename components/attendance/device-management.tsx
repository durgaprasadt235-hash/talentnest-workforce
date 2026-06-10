"use client"

import { useCallback, useEffect, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Table, TableCell, TableHead } from "@/components/ui/table"

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
  createdAt: string
}

type Assignment = {
  organizationId: string
  propertyId: string
}

export function DeviceManagement() {
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
    const response = await fetch("/api/attendance/devices/approve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ deviceId, ...assignment }),
    })
    const data = await response.json()
    setBusyDeviceId("")
    if (!response.ok) return setError(data.error)
    await load()
  }

  async function reject(deviceId: string) {
    setBusyDeviceId(deviceId)
    setError("")
    const response = await fetch("/api/attendance/devices/reject", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ deviceId }),
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
        <h1 className="text-3xl font-semibold tracking-tight">Device Management</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Approve attendance kiosk requests and assign each device to a property.
        </p>
      </div>

      {error && <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error}</p>}

      <Card>
        <CardHeader>
          <h2 className="font-semibold">Pending device requests</h2>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <thead><tr><TableHead>Device</TableHead><TableHead>Fingerprint</TableHead><TableHead>Organization</TableHead><TableHead>Property</TableHead><TableHead>Actions</TableHead></tr></thead>
            <tbody>
              {pendingDevices.map((device) => {
                const assignment = assignments[device.id]
                const availableProperties = properties.filter(
                  (property) => property.organizationId === assignment?.organizationId,
                )

                return (
                  <tr key={device.id}>
                    <TableCell>
                      <p className="font-medium">{device.deviceName}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{new Date(device.createdAt).toLocaleString()}</p>
                    </TableCell>
                    <TableCell className="max-w-64 text-xs text-muted-foreground">
                      {formatFingerprint(device.deviceFingerprint)}
                    </TableCell>
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
      </Card>

      <Card>
        <CardHeader>
          <h2 className="font-semibold">Reviewed devices</h2>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <thead><tr><TableHead>Name</TableHead><TableHead>Property</TableHead><TableHead>Type</TableHead><TableHead>Device code</TableHead><TableHead>Status</TableHead></tr></thead>
            <tbody>
              {reviewedDevices.map((device) => (
                <tr key={device.id}>
                  <TableCell>{device.deviceName}</TableCell>
                  <TableCell>{device.property?.name ?? "Not assigned"}</TableCell>
                  <TableCell>{device.deviceType}</TableCell>
                  <TableCell className="font-mono text-xs">{device.deviceCode ?? "Not generated"}</TableCell>
                  <TableCell><Badge>{device.status}</Badge></TableCell>
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
