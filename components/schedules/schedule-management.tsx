"use client"

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react"
import { Plus } from "lucide-react"

import { useCurrentUser } from "@/components/rbac/current-user-provider"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { hasPermission } from "@/src/lib/rbac/guards"
import { Permission } from "@/src/lib/rbac/permissions"

type Option = { id: string; name: string }
type Property = Option & { organizationId: string }
type Department = Option & { propertyId: string }
type Employee = { id: string; propertyId: string | null; departmentId: string | null; firstName: string; lastName: string }
type Shift = { id: string; shiftDate: string; startTime: string; endTime: string; employee: { id: string; firstName: string; lastName: string } | null; department: Option | null; departmentRole: Option | null }
type Schedule = { id: string; organizationId: string; propertyId: string; weekStartDate: string; notes: string | null; status: string; property: Option; shifts: Shift[] }
type Data = { schedules: Schedule[]; options: { organizations: Option[]; properties: Property[]; departments: Department[]; employees: Employee[] } }
const empty: Data = { schedules: [], options: { organizations: [], properties: [], departments: [], employees: [] } }

export function ScheduleManagement() {
  const { currentUser } = useCurrentUser()
  const canManage = hasPermission(currentUser, Permission.MANAGE_SCHEDULES)
  const [data, setData] = useState<Data>(empty)
  const [selectedId, setSelectedId] = useState("")
  const [showSchedule, setShowSchedule] = useState(false)
  const [showShift, setShowShift] = useState(false)
  const [error, setError] = useState("")
  const [scheduleForm, setScheduleForm] = useState({ organizationId: currentUser.organizationId ?? "", propertyId: "", weekStartDate: "", notes: "" })
  const [shiftForm, setShiftForm] = useState({ employeeId: "", departmentId: "", shiftDate: "", startTime: "", endTime: "", breakMinutes: "0", notes: "" })
  const selected = data.schedules.find((schedule) => schedule.id === selectedId) ?? data.schedules[0]
  const days = useMemo(() => selected ? Array.from({ length: 7 }, (_, index) => { const date = new Date(selected.weekStartDate); date.setUTCDate(date.getUTCDate() + index); return date }) : [], [selected])

  const load = useCallback(async () => {
    const response = await fetch("/api/schedules")
    const body = await response.json()
    if (!response.ok) throw new Error(body.error)
    setData(body)
    setSelectedId((current) => current || body.schedules[0]?.id || "")
  }, [])
  useEffect(() => {
    // Initial remote synchronization is intentionally client-side.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load().catch((caught: Error) => setError(caught.message))
  }, [load])

  async function createSchedule(event: FormEvent) {
    event.preventDefault()
    const response = await fetch("/api/schedules", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(scheduleForm) })
    const body = await response.json()
    if (!response.ok) return setError(body.error)
    setSelectedId(body.schedule.id)
    setShowSchedule(false)
    await load()
  }
  async function addShift(event: FormEvent) {
    event.preventDefault()
    if (!selected) return
    const response = await fetch(`/api/schedules/${selected.id}/shifts`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...shiftForm, departmentId: shiftForm.departmentId || null, departmentRoleId: null, startTime: new Date(`${shiftForm.shiftDate}T${shiftForm.startTime}`).toISOString(), endTime: new Date(`${shiftForm.shiftDate}T${shiftForm.endTime}`).toISOString(), breakMinutes: Number(shiftForm.breakMinutes) }) })
    const body = await response.json()
    if (!response.ok) return setError(body.error)
    setShowShift(false)
    await load()
  }
  async function setStatus(status: string) {
    if (!selected) return
    const response = await fetch(`/api/schedules/${selected.id}/status`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status }) })
    const body = await response.json()
    if (!response.ok) return setError(body.error)
    await load()
  }

  const properties = data.options.properties.filter((property) => property.organizationId === scheduleForm.organizationId)
  const employees = data.options.employees.filter((employee) => employee.propertyId === selected?.propertyId)
  const departments = data.options.departments.filter((department) => department.propertyId === selected?.propertyId)
  return <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-3xl font-semibold">Schedules</h1><p className="mt-2 text-sm text-muted-foreground">Build and publish one-property weekly schedules.</p></div>{canManage && <Button onClick={() => setShowSchedule((value) => !value)}><Plus /> Create Schedule</Button>}</div>
    {error && <p className="text-sm text-destructive">{error}</p>}
    {showSchedule && <Card><CardContent className="p-4"><form className="grid gap-3 md:grid-cols-4" onSubmit={createSchedule}><select required disabled={Boolean(currentUser.organizationId)} className="h-10 rounded-lg border bg-background px-3" value={scheduleForm.organizationId} onChange={(event) => setScheduleForm({ ...scheduleForm, organizationId: event.target.value, propertyId: "" })}><option value="">Organization</option>{data.options.organizations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select required className="h-10 rounded-lg border bg-background px-3" value={scheduleForm.propertyId} onChange={(event) => setScheduleForm({ ...scheduleForm, propertyId: event.target.value })}><option value="">Property</option>{properties.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><Input required type="date" value={scheduleForm.weekStartDate} onChange={(event) => setScheduleForm({ ...scheduleForm, weekStartDate: event.target.value })} /><Input placeholder="Notes" value={scheduleForm.notes} onChange={(event) => setScheduleForm({ ...scheduleForm, notes: event.target.value })} /><Button type="submit">Save Draft</Button></form></CardContent></Card>}
    <div className="flex flex-wrap gap-2">{data.schedules.map((schedule) => <Button key={schedule.id} variant={schedule.id === selected?.id ? "default" : "outline"} onClick={() => setSelectedId(schedule.id)}>{schedule.property.name} · {new Date(schedule.weekStartDate).toLocaleDateString()}</Button>)}</div>
    {selected ? <Card><CardHeader className="flex-row items-center justify-between"><div><h2 className="font-semibold">{selected.property.name} · Week of {new Date(selected.weekStartDate).toLocaleDateString()}</h2><p className="text-sm text-muted-foreground">{selected.status} · {selected.notes}</p></div>{canManage && <div className="flex gap-2"><Button variant="outline" onClick={() => setShowShift((value) => !value)}><Plus /> Add Shift</Button><Button onClick={() => void setStatus("PUBLISHED")}>Publish Schedule</Button><Button variant="outline" onClick={() => void setStatus("APPROVED")}>Manager Approve</Button></div>}</CardHeader><CardContent className="space-y-4">
      {showShift && <form className="grid gap-3 rounded-xl border p-4 md:grid-cols-4" onSubmit={addShift}><select required className="h-10 rounded-lg border bg-background px-3" value={shiftForm.employeeId} onChange={(event) => setShiftForm({ ...shiftForm, employeeId: event.target.value })}><option value="">Employee</option>{employees.map((item) => <option key={item.id} value={item.id}>{item.firstName} {item.lastName}</option>)}</select><select className="h-10 rounded-lg border bg-background px-3" value={shiftForm.departmentId} onChange={(event) => setShiftForm({ ...shiftForm, departmentId: event.target.value })}><option value="">Department</option>{departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><Input required type="date" value={shiftForm.shiftDate} onChange={(event) => setShiftForm({ ...shiftForm, shiftDate: event.target.value })} /><Input required type="time" value={shiftForm.startTime} onChange={(event) => setShiftForm({ ...shiftForm, startTime: event.target.value })} /><Input required type="time" value={shiftForm.endTime} onChange={(event) => setShiftForm({ ...shiftForm, endTime: event.target.value })} /><Input type="number" min="0" placeholder="Break minutes" value={shiftForm.breakMinutes} onChange={(event) => setShiftForm({ ...shiftForm, breakMinutes: event.target.value })} /><Input placeholder="Notes" value={shiftForm.notes} onChange={(event) => setShiftForm({ ...shiftForm, notes: event.target.value })} /><Button type="submit">Add shift</Button></form>}
      <div className="grid min-w-[900px] grid-cols-7 gap-2 overflow-x-auto">{days.map((day) => <div key={day.toISOString()} className="min-h-48 rounded-xl border p-2"><p className="mb-2 text-sm font-semibold">{day.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })}</p>{selected.shifts.filter((shift) => shift.shiftDate.slice(0, 10) === day.toISOString().slice(0, 10)).map((shift) => <div key={shift.id} className="mb-2 rounded-lg bg-primary/10 p-2 text-xs"><strong>{shift.employee?.firstName} {shift.employee?.lastName}</strong><br />{new Date(shift.startTime).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} - {new Date(shift.endTime).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</div>)}</div>)}</div>
    </CardContent></Card> : <p className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">Create a schedule to begin.</p>}
  </div>
}
