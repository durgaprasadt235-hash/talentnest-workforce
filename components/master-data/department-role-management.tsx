"use client"

import { useCallback, useEffect, useState, type FormEvent } from "react"
import { Plus } from "lucide-react"

import { useCurrentUser } from "@/components/rbac/current-user-provider"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableCell, TableHead } from "@/components/ui/table"
import { hasPermission } from "@/src/lib/rbac/guards"
import { Permission } from "@/src/lib/rbac/permissions"

type Department = { id: string; name: string; property: { name: string } }
type DepartmentRole = {
  id: string
  departmentId: string
  name: string
  code: string
  isManager: boolean
  canApproveAttendance: boolean
  canManageSchedule: boolean
  department: Department
}

export function DepartmentRoleManagement() {
  const { currentUser } = useCurrentUser()
  const canManage = hasPermission(currentUser, Permission.MANAGE_DEPARTMENTS)
  const [departments, setDepartments] = useState<Department[]>([])
  const [roles, setRoles] = useState<DepartmentRole[]>([])
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState("")
  const [form, setForm] = useState({ departmentId: "", name: "", code: "", isManager: false, canApproveAttendance: false, canManageSchedule: false })

  const load = useCallback(async () => {
    const [departmentResponse, roleResponse] = await Promise.all([fetch("/api/departments"), fetch("/api/department-roles")])
    const departmentData = await departmentResponse.json()
    const roleData = await roleResponse.json()
    if (!departmentResponse.ok) throw new Error(departmentData.error)
    if (!roleResponse.ok) throw new Error(roleData.error)
    setDepartments(departmentData.departments)
    setRoles(roleData.roles)
  }, [])

  useEffect(() => {
    // Initial remote synchronization is intentionally client-side.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load().catch((caught: Error) => setError(caught.message))
  }, [load])

  async function submit(event: FormEvent) {
    event.preventDefault()
    const response = await fetch("/api/department-roles", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    })
    const body = await response.json()
    if (!response.ok) return setError(body.error)
    setShowForm(false)
    setForm({ departmentId: "", name: "", code: "", isManager: false, canApproveAttendance: false, canManageSchedule: false })
    await load()
  }

  return <Card>
    <CardHeader className="flex-row items-center justify-between">
      <div><h2 className="font-semibold">Department roles</h2><p className="text-sm text-muted-foreground">Configure operational roles and manager capabilities.</p></div>
      {canManage && <Button onClick={() => setShowForm((value) => !value)}><Plus /> Add role</Button>}
    </CardHeader>
    <CardContent className="space-y-4">
      {error && <p className="text-sm text-destructive">{error}</p>}
      {showForm && <form className="grid gap-3 rounded-xl border p-4 md:grid-cols-3" onSubmit={submit}>
        <select required className="h-10 rounded-lg border bg-background px-3 text-sm" value={form.departmentId} onChange={(event) => setForm({ ...form, departmentId: event.target.value })}><option value="">Department</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name} · {department.property.name}</option>)}</select>
        <Input required placeholder="Role name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        <Input required placeholder="Role code" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} />
        {[["isManager", "Manager role"], ["canApproveAttendance", "Can approve attendance"], ["canManageSchedule", "Can manage schedule"]].map(([key, label]) => <label key={key} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form[key as keyof typeof form] as boolean} onChange={(event) => setForm({ ...form, [key]: event.target.checked })} />{label}</label>)}
        <Button type="submit">Create role</Button>
      </form>}
      <Table><thead><tr><TableHead>Role</TableHead><TableHead>Department</TableHead><TableHead>Manager</TableHead><TableHead>Attendance approval</TableHead><TableHead>Schedule management</TableHead></tr></thead>
        <tbody>{roles.map((role) => <tr key={role.id}><TableCell>{role.name} <span className="text-xs text-muted-foreground">({role.code})</span></TableCell><TableCell>{role.department.name}</TableCell><TableCell>{yesNo(role.isManager)}</TableCell><TableCell>{yesNo(role.canApproveAttendance)}</TableCell><TableCell>{yesNo(role.canManageSchedule)}</TableCell></tr>)}</tbody></Table>
      {!roles.length && <p className="text-sm text-muted-foreground">No department roles configured.</p>}
    </CardContent>
  </Card>
}

function yesNo(value: boolean) {
  return value ? "Yes" : "No"
}
