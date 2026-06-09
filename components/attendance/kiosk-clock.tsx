"use client"

import { useEffect, useRef, useState } from "react"
import { Camera, LogIn, LogOut } from "lucide-react"

import { StatusMessage } from "@/components/attendance/status-message"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

type DeviceInfo = { deviceCode: string; property: { name: string }; status: string }

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

  useEffect(() => {
    const deviceCode = localStorage.getItem("talentnest-device-code")
    if (!deviceCode) return
    fetch(`/api/attendance/devices/${encodeURIComponent(deviceCode)}`)
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.error)
        setDevice(data.device)
      })
      .catch((caught: Error) => {
        setError(true)
        setMessage(caught.message)
      })
  }, [])

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
    if (!device) {
      setError(true)
      return setMessage("This kiosk is not registered. Complete device registration first.")
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

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">TalentNest Workforce Attendance Kiosk</h1>
        <p className="mt-2 text-muted-foreground">{device ? device.property.name : "Device registration required"}</p>
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
