"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Camera, LogIn, LogOut, RefreshCw } from "lucide-react"

import { StatusMessage } from "@/components/attendance/status-message"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

type DeviceInfo = {
  id: string
  deviceCode: string | null
  status: "PENDING" | "ACTIVE" | "REJECTED" | "SUSPENDED" | "REMOVED"
  property: { name: string } | null
}

const INSTALLATION_ID_KEY = "talentnest-kiosk-installation-id"

function getBrowserFingerprint() {
  let installationId = localStorage.getItem(INSTALLATION_ID_KEY)
  if (!installationId) {
    installationId = crypto.randomUUID()
    localStorage.setItem(INSTALLATION_ID_KEY, installationId)
  }

  return {
    installationId,
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    screenSize: `${window.screen.width}x${window.screen.height}`,
  }
}

export function KioskClock() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [device, setDevice] = useState<DeviceInfo | null>(null)
  const [employeeNumber, setEmployeeNumber] = useState("")
  const [pin, setPin] = useState("")
  const [photoUrl, setPhotoUrl] = useState("")
  const [message, setMessage] = useState("")
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState(false)

  const checkDevice = useCallback(async () => {
    const response = await fetch("/api/attendance/devices/request", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fingerprint: getBrowserFingerprint() }),
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error)
    setDevice(data.device)
  }, [])

  useEffect(() => {
    // Initial device request and 30-second approval polling are client-only.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    checkDevice().catch((caught: Error) => {
      setError(true)
      setMessage(caught.message)
    })
    const interval = window.setInterval(() => {
      checkDevice().catch((caught: Error) => {
        setError(true)
        setMessage(caught.message)
      })
    }, 30_000)

    return () => window.clearInterval(interval)
  }, [checkDevice])

  async function startCamera() {
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({ video: true })
      if (videoRef.current) videoRef.current.srcObject = streamRef.current
      setError(false)
      setMessage("Camera ready. Capture photo evidence before clocking.")
    } catch {
      setError(true)
      setMessage("Camera access is required for photo evidence.")
    }
  }

  function capturePhoto() {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    const canvas = document.createElement("canvas")
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext("2d")?.drawImage(video, 0, 0)
    // TODO: replace base64 evidence with S3 or Supabase object storage.
    setPhotoUrl(canvas.toDataURL("image/jpeg", 0.72))
    setError(false)
    setMessage("Photo evidence captured.")
  }

  function getLocation() {
    return new Promise<{ latitude: number; longitude: number }>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude }),
        () => reject(new Error("Location access is required for geofence validation.")),
        { enableHighAccuracy: true, timeout: 10_000 },
      )
    })
  }

  async function clock(action: "clock-in" | "clock-out") {
    if (!device?.deviceCode || device.status !== "ACTIVE") {
      setError(true)
      return setMessage("This kiosk is waiting for device approval.")
    }
    if (!photoUrl) {
      setError(true)
      return setMessage("Capture photo evidence before clocking.")
    }

    setBusy(true)
    setMessage("")
    try {
      const location = await getLocation()
      const response = await fetch(`/api/attendance/${action}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          deviceCode: device.deviceCode,
          employeeNumber,
          pin,
          photoUrl,
          location,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      setError(false)
      setMessage(data.message)
      setEmployeeNumber("")
      setPin("")
      setPhotoUrl("")
    } catch (caught) {
      setError(true)
      setMessage(caught instanceof Error ? caught.message : "Clock action failed.")
    } finally {
      setBusy(false)
    }
  }

  if (!device || device.status === "PENDING") {
    return <DeviceState title="Waiting for device approval" description="A device approval request was sent automatically. This kiosk checks for approval every 30 seconds." onRefresh={() => checkDevice()} />
  }

  if (device.status !== "ACTIVE" || !device.deviceCode || !device.property) {
    return <DeviceState title="Device approval unavailable" description={device.status === "REJECTED" ? "This device request was rejected. Contact a manager to review the request." : "This device is not active. Contact a manager for assistance."} onRefresh={() => checkDevice()} />
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">TalentNest Workforce Attendance Kiosk</h1>
        <p className="mt-2 text-muted-foreground">{device.property.name}</p>
      </div>
      <Card>
        <CardContent className="grid gap-6 p-6 lg:grid-cols-2">
          <div className="space-y-4">
            <div className="overflow-hidden rounded-xl border bg-black">
              <video ref={videoRef} autoPlay playsInline muted className="aspect-video w-full object-cover" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" className="h-12" onClick={startCamera}><Camera /> Start camera</Button>
              <Button variant="outline" className="h-12" onClick={capturePhoto}>Capture photo</Button>
            </div>
            {/* A local data URL preview should not pass through the image optimizer. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {photoUrl && <img src={photoUrl} alt="Captured attendance evidence" className="h-20 rounded-lg border object-cover" />}
          </div>
          <div className="space-y-4">
            <Input value={employeeNumber} onChange={(event) => setEmployeeNumber(event.target.value)} placeholder="Employee ID" className="h-14 text-lg" />
            <Input value={pin} onChange={(event) => setPin(event.target.value)} placeholder="PIN" type="password" inputMode="numeric" className="h-14 text-lg" />
            <Button disabled={busy} className="h-16 w-full text-lg" onClick={() => clock("clock-in")}><LogIn /> Clock In</Button>
            <Button disabled={busy} variant="outline" className="h-16 w-full text-lg" onClick={() => clock("clock-out")}><LogOut /> Clock Out</Button>
            <StatusMessage message={message} error={error} />
          </div>
        </CardContent>
      </Card>
      <p className="text-center text-xs text-muted-foreground">
        Photo evidence only. Facial recognition and face-match verification are not enabled.
      </p>
      {/* TODO: add opt-in face-match verification only after legal, privacy, and biometric-consent review. */}
    </div>
  )
}

function DeviceState({
  title,
  description,
  onRefresh,
}: {
  title: string
  description: string
  onRefresh: () => void
}) {
  return (
    <div className="mx-auto flex min-h-[34rem] max-w-xl items-center">
      <Card className="w-full">
        <CardContent className="space-y-5 p-8 text-center">
          <RefreshCw className="mx-auto size-10 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
          </div>
          <Button variant="outline" onClick={onRefresh}><RefreshCw /> Check now</Button>
        </CardContent>
      </Card>
    </div>
  )
}
