"use client"

import Link from "next/link"
import { useCallback, useEffect, useState, type FormEvent } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableCell, TableHead } from "@/components/ui/table"

type Option = { id: string; name: string }
type Device = {
  id: string
  deviceName: string
  deviceCode: string
  deviceType: string
  registrationToken: string
  status: string
  organization: Option
  property: Option
}

export function DeviceManagement() {
  const [devices, setDevices] = useState<Device[]>([])
  const [organizations, setOrganizations] = useState<Option[]>([])
  const [properties, setProperties] = useState<(Option & { organizationId: string })[]>([])
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

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

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError("")
    const form = new FormData(event.currentTarget)
    const response = await fetch("/api/attendance/devices", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(Object.fromEntries(form)),
    })
    const data = await response.json()
    setBusy(false)
    if (!response.ok) return setError(data.error)
    event.currentTarget.reset()
    await load()
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Device Management</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Register and approve attendance kiosk devices by property.
            </p>
          </div>
          <Button variant="outline" asChild><Link href="/kiosk/register">Open kiosk registration</Link></Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <h2 className="font-semibold">Register a device</h2>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <Input name="deviceName" placeholder="Device name" required />
            <select name="deviceType" required className="h-10 rounded-lg border bg-background px-3 text-sm">
              <option value="TABLET">Tablet</option>
              <option value="KIOSK">Kiosk</option>
              <option value="DESKTOP_TERMINAL">Desktop terminal</option>
            </select>
            <select name="organizationId" required className="h-10 rounded-lg border bg-background px-3 text-sm">
              <option value="">Organization</option>
              {organizations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <select name="propertyId" required className="h-10 rounded-lg border bg-background px-3 text-sm">
              <option value="">Property</option>
              {properties.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <Button disabled={busy} className="h-10">{busy ? "Registering..." : "Register device"}</Button>
          </form>
          {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
          {!error && organizations.length === 0 && (
            <p className="mt-4 text-sm text-muted-foreground">
              Create organization and property records before registering a device.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="font-semibold">Registered devices</h2>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <thead><tr><TableHead>Name</TableHead><TableHead>Property</TableHead><TableHead>Type</TableHead><TableHead>Device code</TableHead><TableHead>Registration token</TableHead><TableHead>Status</TableHead></tr></thead>
            <tbody>
              {devices.map((device) => (
                <tr key={device.id}>
                  <TableCell>{device.deviceName}</TableCell>
                  <TableCell>{device.property.name}</TableCell>
                  <TableCell>{device.deviceType}</TableCell>
                  <TableCell className="font-mono text-xs">{device.deviceCode}</TableCell>
                  <TableCell className="max-w-56 truncate font-mono text-xs">{device.registrationToken}</TableCell>
                  <TableCell><Badge>{device.status}</Badge></TableCell>
                </tr>
              ))}
            </tbody>
          </Table>
          {devices.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">No devices registered.</p>}
        </CardContent>
      </Card>

      <p className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
        IMEI/MAC capture requires native Android/iPad MDM integration. Browser MVP uses secure device registration token.
      </p>
      {/* TODO: integrate Android Enterprise kiosk mode and iPad supervised single app mode for full device lockdown. */}
    </div>
  )
}
