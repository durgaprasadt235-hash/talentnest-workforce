"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Clock3, LogIn, LogOut, RefreshCw, RotateCcw } from "lucide-react"

import { StatusMessage } from "@/components/attendance/status-message"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

type Fingerprint = Record<string, unknown>
type DeviceInfo = {
  id: string
  deviceName: string
  status: "PENDING" | "ACTIVE" | "REJECTED" | "SUSPENDED" | "REMOVED"
  fingerprintHash: string
  organization: { name: string } | null
  property: { name: string } | null
}
type ShiftInfo = {
  position: string
  startTime: string
  endTime: string
  status: string
  department: { name: string } | null
  departmentRole: { name: string } | null
  actualWorkedHours?: number
}
type PunchInfo = { id: string; clockInAt: string | null; clockOutAt: string | null; status: string }
type EmployeeSession = {
  employeeId: string
  employeeName: string
  employeeNumber: string
  organizationId: string
  propertyId: string
  propertyName: string
  departmentId: string | null
  departmentName: string | null
  employmentType: string
  position: string | null
  currentOpenAttendanceRecord: PunchInfo | null
  todayWorkedHours: number
  weekWorkedHours: number
  remainingScheduledHours: number
  currentShift: ShiftInfo | null
  previousShift: ShiftInfo | null
  nextShift: ShiftInfo | null
  lastClockIn: string | null
  lastClockOut: string | null
  todayPunches: PunchInfo[]
}

const INSTALLATION_ID_KEY = "talentnest-kiosk-installation-id"
const IDLE_TIMEOUT_MS = 60_000

function getBrowserFingerprint(): Fingerprint {
  let installationId = localStorage.getItem(INSTALLATION_ID_KEY)
  if (!installationId) {
    installationId = crypto.randomUUID()
    localStorage.setItem(INSTALLATION_ID_KEY, installationId)
  }
  const navigatorWithMemory = navigator as Navigator & { deviceMemory?: number }
  return {
    installationId,
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    hardwareConcurrency: navigator.hardwareConcurrency,
    deviceMemory: navigatorWithMemory.deviceMemory,
    // Screen, viewport, and orientation values are intentionally excluded so
    // tablet rotation never creates a new device fingerprint.
  }
}

export function KioskClock() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const sessionPinRef = useRef("")
  const [device, setDevice] = useState<DeviceInfo | null>(null)
  const [pin, setPin] = useState("")
  const [session, setSession] = useState<EmployeeSession | null>(null)
  const [correctionOpen, setCorrectionOpen] = useState(false)
  const [correctionType, setCorrectionType] = useState("MISSED_CLOCK_IN")
  const [requestedDate, setRequestedDate] = useState(new Date().toISOString().slice(0, 10))
  const [requestedTime, setRequestedTime] = useState("")
  const [notes, setNotes] = useState("")
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
  }, [])

  useEffect(() => {
    // Device approval polling is client-only.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    checkDevice().catch(showError)
    const interval = window.setInterval(() => checkDevice().catch(showError), 10_000)
    return () => window.clearInterval(interval)
  }, [checkDevice])

  useEffect(() => {
    const clock = window.setInterval(() => setNow(new Date()), 1_000)
    return () => window.clearInterval(clock)
  }, [])

  useEffect(() => {
    if (!session) return
    const timeout = window.setTimeout(clearSession, IDLE_TIMEOUT_MS)
    return () => window.clearTimeout(timeout)
  }, [session, correctionOpen, notes, requestedDate, requestedTime])

  function showError(caught: unknown) {
    setError(true)
    setMessage(caught instanceof Error ? caught.message : "Kiosk action failed.")
  }

  async function login() {
    if (!/^\d{4}$/.test(pin) || busy) return
    setBusy(true)
    setMessage("")
    try {
      sessionPinRef.current = pin
      await refreshSession(pin)
      setPin("")
      setError(false)
    } catch (caught) {
      setPin("")
      sessionPinRef.current = ""
      showError(caught)
    } finally {
      setBusy(false)
    }
  }

  async function refreshSession(pinOverride?: string) {
    const response = await fetch("/api/attendance/kiosk/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        pin: pinOverride ?? sessionPinRef.current,
        fingerprint: getBrowserFingerprint(),
      }),
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error)
    setSession(data)
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
    if (!video.videoWidth) await new Promise((resolve) => window.setTimeout(resolve, 500))
    const canvas = document.createElement("canvas")
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext("2d")?.drawImage(video, 0, 0)
    return canvas.toDataURL("image/jpeg", 0.72)
  }

  function getLocation() {
    return new Promise<{ latitude: number; longitude: number }>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude }),
        () => reject(new Error("Enable location access and try again.")),
        { enableHighAccuracy: true, timeout: 10_000 },
      )
    })
  }

  async function punch(action: "clock-in" | "clock-out") {
    if (!session || busy) return
    setBusy(true)
    setMessage("")
    try {
      const [photoUrl, location] = await Promise.all([capturePhoto(), getLocation()])
      const response = await fetch(`/api/attendance/${action}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          employeeId: session.employeeId,
          propertyId: session.propertyId,
          fingerprint: getBrowserFingerprint(),
          pin: sessionPinRef.current,
          photoUrl,
          location,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      await refreshSession()
      setError(false)
      setMessage(`${action === "clock-in" ? "Clocked in" : "Clocked out"} successfully at ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.`)
    } catch (caught) {
      showError(caught)
    } finally {
      setBusy(false)
    }
  }

  async function requestCorrection() {
    if (!session || busy) return
    setBusy(true)
    setMessage("")
    try {
      const response = await fetch("/api/attendance/corrections", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fingerprint: getBrowserFingerprint(),
          employeeId: session.employeeId,
          propertyId: session.propertyId,
          pin: sessionPinRef.current,
          attendanceRecordId: session.currentOpenAttendanceRecord?.id,
          correctionType,
          requestedDate,
          requestedTime: requestedTime || undefined,
          notes: notes || undefined,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      setCorrectionOpen(false)
      setNotes("")
      setRequestedTime("")
      setError(false)
      setMessage("Correction request submitted to manager.")
    } catch (caught) {
      showError(caught)
    } finally {
      setBusy(false)
    }
  }

  function clearSession() {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    sessionPinRef.current = ""
    setSession(null)
    setCorrectionOpen(false)
    setMessage("")
    setError(false)
  }

  function endSession() {
    if (session?.currentOpenAttendanceRecord && !window.confirm("You are still clocked in. End session without clocking out?")) return
    clearSession()
  }

  if (!device || device.status !== "ACTIVE" || !device.property) {
    return <DeviceState device={device} onRefresh={() => checkDevice().catch(showError)} />
  }

  return (
    <main className="min-h-dvh bg-muted/30 p-3 sm:p-5">
      <video ref={videoRef} autoPlay playsInline muted className="fixed size-px opacity-0" />
      <div className="mx-auto max-w-7xl">
        {session ? (
          <SessionDashboard session={session} now={now} busy={busy} correctionOpen={correctionOpen} correctionType={correctionType} requestedDate={requestedDate} requestedTime={requestedTime} notes={notes} message={message} error={error} onPunch={punch} onCorrectionOpen={setCorrectionOpen} onCorrectionType={setCorrectionType} onRequestedDate={setRequestedDate} onRequestedTime={setRequestedTime} onNotes={setNotes} onRequestCorrection={requestCorrection} onEndSession={endSession} />
        ) : (
          <LoginScreen device={device} now={now} pin={pin} busy={busy} message={message} error={error} onPin={(value) => setPin(value.replace(/\D/g, "").slice(0, 4))} onLogin={login} />
        )}
      </div>
    </main>
  )
}

function LoginScreen({ device, now, pin, busy, message, error, onPin, onLogin }: { device: DeviceInfo; now: Date; pin: string; busy: boolean; message: string; error: boolean; onPin: (value: string) => void; onLogin: () => void }) {
  return <Card><CardContent className="grid min-h-[calc(100dvh-1.5rem)] gap-6 p-4 sm:p-6 lg:grid-cols-2 lg:items-center">
    <div className="space-y-4">
      <Input aria-label="4-digit PIN" value={pin} onChange={(event) => onPin(event.target.value)} onKeyDown={(event) => event.key === "Enter" && onLogin()} placeholder="4-digit PIN" type="password" inputMode="numeric" maxLength={4} className="h-14 text-center text-2xl tracking-[0.5em]" />
      <NumericKeypad pin={pin} disabled={busy} onPin={onPin} />
      <Button disabled={busy || pin.length !== 4} className="h-16 w-full text-lg" onClick={onLogin}><LogIn /> Enter / Login</Button>
    </div>
    <div className="space-y-4 rounded-2xl bg-muted/50 p-6 text-center">
      <p className="text-sm font-medium text-emerald-700">Device approved</p>
      <h1 className="text-3xl font-semibold">{device.property?.name}</h1>
      <p className="text-xl">{now.toLocaleDateString()}<br />{now.toLocaleTimeString()}</p>
      <p className="text-sm text-muted-foreground">Enter your manager-assigned 4-digit PIN to open your kiosk session.</p>
      <StatusMessage message={message} error={error} />
    </div>
  </CardContent></Card>
}

function NumericKeypad({ pin, disabled, onPin }: { pin: string; disabled: boolean; onPin: (value: string) => void }) {
  return <div className="grid grid-cols-3 gap-3">
    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => <Button key={digit} type="button" variant="outline" disabled={disabled || pin.length >= 4} className="h-12 text-xl sm:h-14" onClick={() => onPin(`${pin}${digit}`)}>{digit}</Button>)}
    <Button type="button" variant="outline" disabled={disabled || !pin} className="h-12 sm:h-14" onClick={() => onPin("")}>Clear</Button>
    <Button type="button" variant="outline" disabled={disabled || pin.length >= 4} className="h-12 text-xl sm:h-14" onClick={() => onPin(`${pin}0`)}>0</Button>
    <Button type="button" variant="outline" disabled={disabled || !pin} className="h-12 sm:h-14" onClick={() => onPin(pin.slice(0, -1))}>Delete</Button>
  </div>
}

function SessionDashboard({ session, now, busy, correctionOpen, correctionType, requestedDate, requestedTime, notes, message, error, onPunch, onCorrectionOpen, onCorrectionType, onRequestedDate, onRequestedTime, onNotes, onRequestCorrection, onEndSession }: { session: EmployeeSession; now: Date; busy: boolean; correctionOpen: boolean; correctionType: string; requestedDate: string; requestedTime: string; notes: string; message: string; error: boolean; onPunch: (action: "clock-in" | "clock-out") => void; onCorrectionOpen: (open: boolean) => void; onCorrectionType: (value: string) => void; onRequestedDate: (value: string) => void; onRequestedTime: (value: string) => void; onNotes: (value: string) => void; onRequestCorrection: () => void; onEndSession: () => void }) {
  const clockedIn = Boolean(session.currentOpenAttendanceRecord)
  return <div className="grid gap-4 lg:grid-cols-[minmax(320px,0.8fr)_minmax(440px,1.2fr)]">
    <div className="space-y-4">
      <Card><CardContent className="space-y-4 p-5">
        <div><p className="text-sm text-muted-foreground">{session.propertyName} · {now.toLocaleTimeString()}</p><h1 className="text-2xl font-semibold">{session.employeeName}</h1><p className="text-sm text-muted-foreground">{session.departmentName ?? "No department"} · {session.employmentType}</p></div>
        <p className="rounded-lg bg-muted p-3 text-sm font-medium">{clockedIn ? `Clocked in since ${formatTime(session.currentOpenAttendanceRecord?.clockInAt)}` : session.lastClockOut ? `Clocked out at ${formatTime(session.lastClockOut)}` : "Not clocked in"}</p>
        <div className="grid grid-cols-2 gap-3">
          <ActionButton disabled={busy || clockedIn} onClick={() => onPunch("clock-in")} icon={<LogIn />} label="Clock In" />
          <ActionButton disabled={busy || !clockedIn} onClick={() => onPunch("clock-out")} icon={<LogOut />} label="Clock Out" />
          <ActionButton disabled={busy} onClick={() => onCorrectionOpen(!correctionOpen)} icon={<RotateCcw />} label="Request Correction" />
          <ActionButton disabled={busy} onClick={onEndSession} icon={<Clock3 />} label="End Session" />
        </div>
        <StatusMessage message={message} error={error} />
      </CardContent></Card>
      {correctionOpen && <CorrectionForm correctionType={correctionType} requestedDate={requestedDate} requestedTime={requestedTime} notes={notes} busy={busy} onCorrectionType={onCorrectionType} onRequestedDate={onRequestedDate} onRequestedTime={onRequestedTime} onNotes={onNotes} onSubmit={onRequestCorrection} />}
    </div>
    <div className="grid content-start gap-4 sm:grid-cols-2">
      <SummaryCard title="Present shift"><ShiftDetails shift={session.currentShift} empty="No shift scheduled" /></SummaryCard>
      <SummaryCard title="Previous shift"><ShiftDetails shift={session.previousShift} empty="No previous shift" /></SummaryCard>
      <SummaryCard title="Next shift"><ShiftDetails shift={session.nextShift} empty="No upcoming shift" /></SummaryCard>
      <SummaryCard title="Worked hours"><Metric label="Today" value={`${session.todayWorkedHours} hrs`} /><Metric label="This week" value={`${session.weekWorkedHours} hrs`} /><Metric label="Remaining scheduled" value={`${session.remainingScheduledHours} hrs`} /></SummaryCard>
      <SummaryCard title="Timesheet summary"><Metric label="Today punches" value={String(session.todayPunches.length)} /><Metric label="Current open punch" value={clockedIn ? formatTime(session.currentOpenAttendanceRecord?.clockInAt) : "None"} /><Metric label="Last clock in" value={formatTime(session.lastClockIn)} /><Metric label="Last clock out" value={formatTime(session.lastClockOut)} /></SummaryCard>
    </div>
  </div>
}

function ActionButton({ disabled, onClick, icon, label }: { disabled: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return <Button disabled={disabled} variant="outline" className="h-20 flex-col gap-2 text-base" onClick={onClick}>{icon}{label}</Button>
}
function SummaryCard({ title, children }: { title: string; children: React.ReactNode }) {
  return <Card><CardContent className="space-y-2 p-5"><h2 className="font-semibold">{title}</h2>{children}</CardContent></Card>
}
function Metric({ label, value }: { label: string; value: string }) {
  return <p className="flex justify-between gap-4 text-sm"><span className="text-muted-foreground">{label}</span><span className="font-medium">{value}</span></p>
}
function ShiftDetails({ shift, empty }: { shift: ShiftInfo | null; empty: string }) {
  if (!shift) return <p className="text-sm text-muted-foreground">{empty}</p>
  return <><Metric label="Start" value={formatDateTime(shift.startTime)} /><Metric label="End" value={formatDateTime(shift.endTime)} /><Metric label="Department" value={shift.department?.name ?? "Not assigned"} /><Metric label="Role" value={shift.departmentRole?.name ?? shift.position} /><Metric label="Status" value={shiftContextStatus(shift)} />{shift.actualWorkedHours !== undefined && <Metric label="Actual worked" value={`${shift.actualWorkedHours} hrs`} />}</>
}

function CorrectionForm({ correctionType, requestedDate, requestedTime, notes, busy, onCorrectionType, onRequestedDate, onRequestedTime, onNotes, onSubmit }: { correctionType: string; requestedDate: string; requestedTime: string; notes: string; busy: boolean; onCorrectionType: (value: string) => void; onRequestedDate: (value: string) => void; onRequestedTime: (value: string) => void; onNotes: (value: string) => void; onSubmit: () => void }) {
  return <Card><CardContent className="space-y-3 p-5"><h2 className="font-semibold">Request correction</h2><select value={correctionType} onChange={(event) => onCorrectionType(event.target.value)} className="h-10 w-full rounded-lg border bg-background px-3 text-sm"><option value="MISSED_CLOCK_IN">Missed Clock In</option><option value="MISSED_CLOCK_OUT">Missed Clock Out</option><option value="WRONG_CLOCK_IN_TIME">Wrong Clock In Time</option><option value="WRONG_CLOCK_OUT_TIME">Wrong Clock Out Time</option><option value="DUPLICATE_PUNCH">Duplicate Punch</option><option value="FORGOT_TO_CLOCK_OUT">Forgot To Clock Out</option><option value="OTHER">Other</option></select><div className="grid gap-3 sm:grid-cols-2"><Input type="date" value={requestedDate} onChange={(event) => onRequestedDate(event.target.value)} /><Input type="time" value={requestedTime} onChange={(event) => onRequestedTime(event.target.value)} /></div><Input value={notes} onChange={(event) => onNotes(event.target.value)} placeholder="Optional notes" /><Button disabled={busy} onClick={onSubmit}>Submit request</Button></CardContent></Card>
}

function DeviceState({ device, onRefresh }: { device: DeviceInfo | null; onRefresh: () => void }) {
  return <main className="flex min-h-dvh items-center justify-center bg-muted/30 p-6"><Card className="w-full max-w-xl"><CardContent className="space-y-5 p-8 text-center"><RefreshCw className="mx-auto size-10 text-primary" /><div><h1 className="text-2xl font-semibold">Waiting for device approval</h1><p className="mt-2 text-sm text-muted-foreground">PIN login is available after this kiosk is assigned to a property.</p></div><div className="rounded-xl border bg-muted/40 p-4 text-left text-sm"><p><span className="font-medium">Property:</span> {device?.property?.name ?? "Not selected"}</p><p><span className="font-medium">Fingerprint:</span> <span className="font-mono">{device?.fingerprintHash?.slice(0, 8).toUpperCase() ?? "Registering"}</span></p></div><Button variant="outline" onClick={onRefresh}><RefreshCw /> Refresh status</Button></CardContent></Card></main>
}

function formatTime(value: string | null | undefined) {
  return value ? new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "None"
}
function formatDateTime(value: string) {
  return new Date(value).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
}
function shiftContextStatus(shift: ShiftInfo) {
  if (shift.status === "MISSED") return "Missed"
  const now = Date.now()
  if (now < new Date(shift.startTime).getTime()) return "Upcoming"
  if (now <= new Date(shift.endTime).getTime()) return "In progress"
  return "Completed"
}
