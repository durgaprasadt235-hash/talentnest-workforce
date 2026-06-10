"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Clock3, LogIn, LogOut, RefreshCw, RotateCcw, UserRound } from "lucide-react"

import { StatusMessage } from "@/components/attendance/status-message"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

type DeviceInfo = {
  id: string
  deviceName: string
  deviceCode: string | null
  status: "PENDING" | "ACTIVE" | "REJECTED" | "SUSPENDED" | "REMOVED"
  property: { name: string } | null
}
type EmployeeSession = {
  employee: {
    firstName: string
    lastName: string
    position: string | null
  }
  shift: {
    position: string
    startTime: string
    endTime: string
    status: string
  } | null
  openRecord: { id: string; clockInAt: string | null; status: string } | null
}

const INSTALLATION_ID_KEY = "talentnest-kiosk-installation-id"
const DEVICE_CODE_KEY = "talentnest-kiosk-device-code"
const IDLE_TIMEOUT_MS = 30_000

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
  const sessionPinRef = useRef("")
  const [device, setDevice] = useState<DeviceInfo | null>(null)
  const [pin, setPin] = useState("")
  const [failedAttempts, setFailedAttempts] = useState(0)
  const [lockedUntil, setLockedUntil] = useState(0)
  const [session, setSession] = useState<EmployeeSession | null>(null)
  const [correctionOpen, setCorrectionOpen] = useState(false)
  const [correctionType, setCorrectionType] = useState("MISSED_PUNCH")
  const [requestedClockInAt, setRequestedClockInAt] = useState("")
  const [requestedClockOutAt, setRequestedClockOutAt] = useState("")
  const [reason, setReason] = useState("")
  const [now, setNow] = useState(new Date())
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
    if (data.device.deviceCode) {
      localStorage.setItem(DEVICE_CODE_KEY, data.device.deviceCode)
    } else {
      localStorage.removeItem(DEVICE_CODE_KEY)
    }
  }, [])

  useEffect(() => {
    // Device approval polling is client-only.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    checkDevice().catch(showError)
    const interval = window.setInterval(() => {
      checkDevice().catch(showError)
    }, 10_000)
    return () => window.clearInterval(interval)
  }, [checkDevice])

  useEffect(() => {
    const clock = window.setInterval(() => {
      const currentTime = new Date()
      setNow(currentTime)
      if (lockedUntil && currentTime.getTime() >= lockedUntil) {
        setLockedUntil(0)
        setError(false)
        setMessage("")
      }
    }, 1_000)
    return () => window.clearInterval(clock)
  }, [lockedUntil])

  useEffect(() => {
    if (!session) return
    const timeout = window.setTimeout(endSession, IDLE_TIMEOUT_MS)
    return () => window.clearTimeout(timeout)
  }, [session, correctionOpen, reason, requestedClockInAt, requestedClockOutAt])

  function showError(caught: unknown) {
    setError(true)
    setMessage(caught instanceof Error ? caught.message : "Kiosk action failed.")
  }

  async function verifyEmployee() {
    if (!device?.deviceCode) return
    if (busy) return
    if (Date.now() < lockedUntil) return
    if (!/^\d{4}$/.test(pin)) return showError(new Error("Invalid PIN."))
    setBusy(true)
    setMessage("")
    try {
      const response = await fetch("/api/attendance/kiosk/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ deviceCode: device.deviceCode, pin }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      sessionPinRef.current = pin
      setPin("")
      setFailedAttempts(0)
      setSession(data)
      setError(false)
      startCamera().catch(showError)
    } catch (caught) {
      const attempts = failedAttempts + 1
      setPin("")
      if (attempts >= 3) {
        setFailedAttempts(0)
        setLockedUntil(Date.now() + 30_000)
        showError(new Error("Too many failed attempts. Try again in 30 seconds."))
      } else {
        setFailedAttempts(attempts)
        showError(caught)
      }
    } finally {
      setBusy(false)
    }
  }

  async function startCamera() {
    streamRef.current = await navigator.mediaDevices.getUserMedia({ video: true })
    if (videoRef.current) {
      videoRef.current.srcObject = streamRef.current
      await videoRef.current.play()
    }
  }

  async function capturePhoto() {
    if (!streamRef.current) await startCamera()
    const video = videoRef.current
    if (!video) throw new Error("Camera is not ready. Try again.")
    if (!video.videoWidth) {
      await new Promise((resolve) => window.setTimeout(resolve, 500))
    }
    if (!video.videoWidth) throw new Error("Camera is not ready. Try again.")
    const canvas = document.createElement("canvas")
    const scale = Math.min(1, 1280 / video.videoWidth)
    canvas.width = Math.round(video.videoWidth * scale)
    canvas.height = Math.round(video.videoHeight * scale)
    canvas.getContext("2d")?.drawImage(video, 0, 0)
    return canvas.toDataURL("image/jpeg", 0.72)
  }

  function getLocation() {
    return new Promise<{ latitude: number; longitude: number }>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude }),
        () => reject(new Error("Location could not be captured. Enable location access and try again.")),
        { enableHighAccuracy: true, timeout: 10_000 },
      )
    })
  }

  async function punch(action: "clock-in" | "clock-out") {
    if (!device?.deviceCode || !session) return
    setBusy(true)
    setMessage("")
    try {
      const [photoUrl, location] = await Promise.all([capturePhoto(), getLocation()])
      const response = await fetch(`/api/attendance/${action}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          deviceCode: device.deviceCode,
          pin: sessionPinRef.current,
          photoUrl,
          location,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      finishAction(data.message)
    } catch (caught) {
      showError(caught)
      setBusy(false)
    }
  }

  async function requestCorrection() {
    if (!device?.deviceCode || !session || !reason.trim()) {
      return showError(new Error("Enter a reason for the correction request."))
    }
    setBusy(true)
    try {
      const response = await fetch("/api/attendance/corrections", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          deviceCode: device.deviceCode,
          pin: sessionPinRef.current,
          attendanceRecordId: session.openRecord?.id,
          correctionType,
          requestedClockInAt: requestedClockInAt ? new Date(requestedClockInAt).toISOString() : undefined,
          requestedClockOutAt: requestedClockOutAt ? new Date(requestedClockOutAt).toISOString() : undefined,
          reason,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      finishAction(data.message)
    } catch (caught) {
      showError(caught)
      setBusy(false)
    }
  }

  function finishAction(successMessage: string) {
    setError(false)
    setMessage(successMessage)
    setBusy(false)
    window.setTimeout(endSession, 5_000)
  }

  function endSession() {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    setSession(null)
    sessionPinRef.current = ""
    setPin("")
    setCorrectionOpen(false)
    setCorrectionType("MISSED_PUNCH")
    setRequestedClockInAt("")
    setRequestedClockOutAt("")
    setReason("")
    setBusy(false)
  }

  if (!device || device.status === "PENDING") {
    return <DeviceState title="Waiting for device approval" description="This kiosk checks for manager approval every 10 seconds." onRefresh={() => checkDevice().catch(showError)} />
  }

  if (device.status !== "ACTIVE" || !device.deviceCode || !device.property) {
    return <DeviceState title={device.status === "REJECTED" ? "Device rejected" : "Device registration required"} description="Contact a manager to approve and assign this kiosk." onRefresh={() => checkDevice().catch(showError)} />
  }

  return (
    <main className="min-h-screen bg-muted/30 p-4 sm:p-8">
      <video ref={videoRef} autoPlay playsInline muted className="fixed size-px opacity-0" />
      <div className="mx-auto max-w-3xl space-y-6">
        {!session ? (
          <ReadyScreen
            device={device}
            now={now}
            pin={pin}
            lockedSeconds={Math.max(0, Math.ceil((lockedUntil - now.getTime()) / 1000))}
            busy={busy}
            message={message}
            error={error}
            onPin={(value) => setPin(value.replace(/\D/g, "").slice(0, 4))}
            onEnter={verifyEmployee}
          />
        ) : (
          <PunchScreen
            session={session}
            now={now}
            busy={busy}
            correctionOpen={correctionOpen}
            correctionType={correctionType}
            requestedClockInAt={requestedClockInAt}
            requestedClockOutAt={requestedClockOutAt}
            reason={reason}
            message={message}
            error={error}
            onPunch={punch}
            onCorrectionOpen={setCorrectionOpen}
            onCorrectionType={setCorrectionType}
            onRequestedClockInAt={setRequestedClockInAt}
            onRequestedClockOutAt={setRequestedClockOutAt}
            onReason={setReason}
            onRequestCorrection={requestCorrection}
            onEndSession={endSession}
          />
        )}
      </div>
    </main>
  )
}

function ReadyScreen({ device, now, pin, lockedSeconds, busy, message, error, onPin, onEnter }: {
  device: DeviceInfo
  now: Date
  pin: string
  lockedSeconds: number
  busy: boolean
  message: string
  error: boolean
  onPin: (value: string) => void
  onEnter: () => void
}) {
  return (
    <Card className="mx-auto mt-[8vh] max-w-xl">
      <CardContent className="space-y-6 p-8 sm:p-10">
        <div className="text-center">
          <p className="text-sm font-medium text-muted-foreground">{device.deviceName}</p>
          <h1 className="mt-1 text-3xl font-semibold">{device.property?.name}</h1>
          <p className="mt-3 text-lg">{now.toLocaleDateString()} · {now.toLocaleTimeString()}</p>
        </div>
        <Input value={pin} onChange={(event) => onPin(event.target.value)} placeholder="4-digit PIN" type="password" inputMode="numeric" autoComplete="off" maxLength={4} className="h-16 text-center text-2xl tracking-[0.5em]" onKeyDown={(event) => event.key === "Enter" && onEnter()} disabled={busy || lockedSeconds > 0} />
        <NumericKeypad pin={pin} disabled={busy || lockedSeconds > 0} onPin={onPin} />
        <Button disabled={busy || pin.length !== 4 || lockedSeconds > 0} className="h-16 w-full text-lg" onClick={onEnter}><UserRound /> Enter</Button>
        {lockedSeconds > 0 && <p className="text-center text-sm font-medium text-destructive">Too many failed attempts. Try again in {lockedSeconds} seconds.</p>}
        <StatusMessage message={message} error={error} />
      </CardContent>
    </Card>
  )
}

function NumericKeypad({ pin, disabled, onPin }: { pin: string; disabled: boolean; onPin: (value: string) => void }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
        <Button key={digit} type="button" variant="outline" disabled={disabled || pin.length >= 4} className="h-16 text-xl" onClick={() => onPin(`${pin}${digit}`)}>{digit}</Button>
      ))}
      <Button type="button" variant="outline" disabled={disabled || pin.length === 0} className="h-16" onClick={() => onPin("")}>Clear</Button>
      <Button type="button" variant="outline" disabled={disabled || pin.length >= 4} className="h-16 text-xl" onClick={() => onPin(`${pin}0`)}>0</Button>
      <Button type="button" variant="outline" disabled={disabled || pin.length === 0} className="h-16" onClick={() => onPin(pin.slice(0, -1))}>Delete</Button>
    </div>
  )
}

function PunchScreen({ session, now, busy, correctionOpen, correctionType, requestedClockInAt, requestedClockOutAt, reason, message, error, onPunch, onCorrectionOpen, onCorrectionType, onRequestedClockInAt, onRequestedClockOutAt, onReason, onRequestCorrection, onEndSession }: {
  session: EmployeeSession
  now: Date
  busy: boolean
  correctionOpen: boolean
  correctionType: string
  requestedClockInAt: string
  requestedClockOutAt: string
  reason: string
  message: string
  error: boolean
  onPunch: (action: "clock-in" | "clock-out") => void
  onCorrectionOpen: (open: boolean) => void
  onCorrectionType: (value: string) => void
  onRequestedClockInAt: (value: string) => void
  onRequestedClockOutAt: (value: string) => void
  onReason: (value: string) => void
  onRequestCorrection: () => void
  onEndSession: () => void
}) {
  const employee = session.employee
  return (
    <Card className="mt-[5vh]">
      <CardContent className="space-y-6 p-8">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">{now.toLocaleTimeString()}</p>
          <h1 className="mt-1 text-3xl font-semibold">Welcome, {employee.firstName} {employee.lastName}</h1>
          <p className="mt-2 text-muted-foreground">{employee.position ?? "Position not assigned"}</p>
          <p className="mt-3 text-sm">{session.shift ? `Today's shift: ${new Date(session.shift.startTime).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} - ${new Date(session.shift.endTime).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : "No scheduled shift found. Your clock-in has been recorded and flagged for manager review."}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Button disabled={busy || Boolean(session.openRecord)} className="h-20 text-lg" onClick={() => onPunch("clock-in")}><LogIn /> Clock In</Button>
          <Button disabled={busy || !session.openRecord} variant="outline" className="h-20 text-lg" onClick={() => onPunch("clock-out")}><LogOut /> Clock Out</Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Button disabled={busy} variant="outline" className="h-12" onClick={() => onCorrectionOpen(!correctionOpen)}><RotateCcw /> Request Correction</Button>
          <Button disabled={busy} variant="ghost" className="h-12" onClick={onEndSession}><Clock3 /> End Session</Button>
        </div>
        {correctionOpen && (
          <div className="space-y-3 rounded-xl border p-4">
            <select value={correctionType} onChange={(event) => onCorrectionType(event.target.value)} className="h-10 w-full rounded-lg border bg-background px-3 text-sm">
              <option value="MISSED_PUNCH">Missed punch</option>
              <option value="INCORRECT_CLOCK_IN">Incorrect clock in</option>
              <option value="INCORRECT_CLOCK_OUT">Incorrect clock out</option>
              <option value="OTHER">Other</option>
            </select>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-xs text-muted-foreground">Requested clock in<Input type="datetime-local" value={requestedClockInAt} onChange={(event) => onRequestedClockInAt(event.target.value)} /></label>
              <label className="space-y-1 text-xs text-muted-foreground">Requested clock out<Input type="datetime-local" value={requestedClockOutAt} onChange={(event) => onRequestedClockOutAt(event.target.value)} /></label>
            </div>
            <Input value={reason} onChange={(event) => onReason(event.target.value)} placeholder="Reason for correction" />
            <Button disabled={busy || !reason.trim()} onClick={onRequestCorrection}>Submit Correction Request</Button>
          </div>
        )}
        <StatusMessage message={message} error={error} />
      </CardContent>
    </Card>
  )
}

function DeviceState({ title, description, onRefresh }: { title: string; description: string; onRefresh: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <Card className="w-full max-w-xl">
        <CardContent className="space-y-5 p-8 text-center">
          <RefreshCw className="mx-auto size-10 text-primary" />
          <div><h1 className="text-2xl font-semibold">{title}</h1><p className="mt-2 text-sm text-muted-foreground">{description}</p></div>
          <Button variant="outline" onClick={onRefresh}><RefreshCw /> Check now</Button>
        </CardContent>
      </Card>
    </main>
  )
}
