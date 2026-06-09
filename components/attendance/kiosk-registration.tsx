"use client"

import { useState, type FormEvent } from "react"

import { StatusMessage } from "@/components/attendance/status-message"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

export function KioskRegistration() {
  const [message, setMessage] = useState("")
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setMessage("")
    const token = new FormData(event.currentTarget).get("registrationToken")
    const fingerprint = {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      screenSize: `${window.screen.width}x${window.screen.height}`,
    }
    const response = await fetch("/api/attendance/devices/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ registrationToken: token, fingerprint }),
    })
    const data = await response.json()
    setBusy(false)

    if (!response.ok) {
      setError(true)
      return setMessage(data.error)
    }

    localStorage.setItem("talentnest-device-code", data.device.deviceCode)
    setError(false)
    setMessage(`Device activated for ${data.device.property.name}.`)
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Register Attendance Kiosk</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Enter the secure registration token supplied by an administrator.
        </p>
      </div>
      <Card>
        <CardHeader><h2 className="font-semibold">Device activation</h2></CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <Input name="registrationToken" placeholder="Registration token" autoComplete="off" required />
            <Button className="h-11 w-full" disabled={busy}>{busy ? "Activating..." : "Activate device"}</Button>
          </form>
          <div className="mt-4"><StatusMessage message={message} error={error} /></div>
        </CardContent>
      </Card>
      <p className="text-sm text-muted-foreground">
        Full device lockdown requires Android Enterprise kiosk mode or iPad supervised single app mode.
      </p>
    </div>
  )
}
