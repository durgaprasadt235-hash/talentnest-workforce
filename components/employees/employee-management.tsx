"use client"

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react"
import { KeyRound, Pencil, Plus, Trash2, UserCheck, UserMinus, UserX } from "lucide-react"

import { useCurrentUser } from "@/components/rbac/current-user-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Table, TableCell, TableHead } from "@/components/ui/table"
import { hasPermission } from "@/src/lib/rbac/guards"
import { mockRoleHeaders } from "@/src/lib/rbac/mock-auth"
import { Permission } from "@/src/lib/rbac/permissions"

type EmploymentType = "DIRECT" | "STAFFING" | "AGENCY" | "TEMPORARY" | "SEASONAL"
type RecordStatus =
  | "ACTIVE"
  | "INACTIVE"
  | "TERMINATED"
  | "ON_LEAVE"
  | "SUSPENDED"
type StatusFilter = RecordStatus | "ALL"
type NamedOption = { id: string; name: string }
type PropertyOption = NamedOption & { organizationId: string }
type DepartmentOption = NamedOption & {
  organizationId: string
  propertyId: string
}
type DepartmentRoleOption = NamedOption & { departmentId: string }
type StaffingCompanyOption = {
  id: string
  organizationId: string
  displayName: string
}
type Employee = {
  id: string
  organizationId: string
  propertyId: string | null
  departmentId: string | null
  departmentRoleId: string | null
  staffingCompanyId: string | null
  employeeNumber: string
  firstName: string
  lastName: string
  employmentType: EmploymentType
  position: string | null
  phone: string | null
  email: string | null
  payRate: string | null
  hireDate: string | null
  status: RecordStatus
  terminatedAt: string | null
  terminationReason: string | null
  organization: NamedOption
  property: NamedOption | null
  department: NamedOption | null
  departmentRole: NamedOption | null
  staffingCompany: { id: string; displayName: string } | null
}
type EmployeeData = {
  employees: Employee[]
  options: {
    organizations: NamedOption[]
    properties: PropertyOption[]
    departments: DepartmentOption[]
    departmentRoles: DepartmentRoleOption[]
    staffingCompanies: StaffingCompanyOption[]
  }
}
type EmployeeForm = {
  organizationId: string
  propertyId: string
  departmentId: string
  departmentRoleId: string
  staffingCompanyId: string
  employeeNumber: string
  firstName: string
  lastName: string
  employmentType: EmploymentType
  position: string
  phone: string
  email: string
  payRate: string
  hireDate: string
  pin: string
}

const emptyData: EmployeeData = {
  employees: [],
  options: {
    organizations: [],
    properties: [],
    departments: [],
    departmentRoles: [],
    staffingCompanies: [],
  },
}

const emptyForm: EmployeeForm = {
  organizationId: "",
  propertyId: "",
  departmentId: "",
  departmentRoleId: "",
  staffingCompanyId: "",
  employeeNumber: "",
  firstName: "",
  lastName: "",
  employmentType: "DIRECT",
  position: "",
  phone: "",
  email: "",
  payRate: "",
  hireDate: "",
  pin: "",
}

const employmentTypes: EmploymentType[] = [
  "DIRECT",
  "STAFFING",
  "AGENCY",
  "TEMPORARY",
  "SEASONAL",
]

const statusFilters: { value: StatusFilter; label: string }[] = [
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
  { value: "TERMINATED", label: "Terminated" },
  { value: "SUSPENDED", label: "Suspended" },
  { value: "ON_LEAVE", label: "On Leave" },
  { value: "ALL", label: "All" },
]

const selectClass =
  "h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"

function generateFourDigitPin() {
  const randomValue = crypto.getRandomValues(new Uint32Array(1))[0]
  return String(1000 + (randomValue % 9000))
}

export function EmployeeManagement() {
  const { currentUser } = useCurrentUser()
  const canManage = hasPermission(currentUser, Permission.MANAGE_EMPLOYEES)
  const [data, setData] = useState<EmployeeData>(emptyData)
  const [form, setForm] = useState<EmployeeForm>(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [employeeFormOpen, setEmployeeFormOpen] = useState(false)
  const [pinEmployee, setPinEmployee] = useState<Employee | null>(null)
  const [pinReset, setPinReset] = useState("")
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null)
  const [terminateTarget, setTerminateTarget] = useState<Employee | null>(null)
  const [terminationReason, setTerminationReason] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ACTIVE")
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  const requestHeaders = useMemo(
    () => mockRoleHeaders(currentUser.role),
    [currentUser.role],
  )

  const load = useCallback(async () => {
    const response = await fetch(
      `/api/employees?status=${encodeURIComponent(statusFilter)}`,
      { headers: requestHeaders },
    )
    const result = await response.json()
    if (!response.ok) throw new Error(result.error)
    setData(result)
  }, [requestHeaders, statusFilter])

  useEffect(() => {
    // Initial remote synchronization is intentionally client-side for this module.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load().catch((caught: Error) => setError(caught.message))
  }, [load])

  const properties = data.options.properties.filter(
    (item) => item.organizationId === form.organizationId,
  )
  const departments = data.options.departments.filter(
    (item) =>
      item.organizationId === form.organizationId &&
      item.propertyId === form.propertyId,
  )
  const staffingCompanies = data.options.staffingCompanies.filter(
    (item) => item.organizationId === form.organizationId,
  )
  const departmentRoles = data.options.departmentRoles.filter(
    (item) => item.departmentId === form.departmentId,
  )

  function updateForm<K extends keyof EmployeeForm>(
    key: K,
    value: EmployeeForm[K],
  ) {
    setForm((current) => {
      const next = { ...current, [key]: value }
      if (key === "organizationId") {
        next.propertyId = ""
        next.departmentId = ""
        next.departmentRoleId = ""
        next.staffingCompanyId = ""
      }
      if (key === "propertyId") {
        next.departmentId = ""
        next.departmentRoleId = ""
      }
      if (key === "departmentId") next.departmentRoleId = ""
      if (key === "employmentType" && value !== "AGENCY" && value !== "STAFFING") {
        next.staffingCompanyId = ""
      }
      return next
    })
  }

  function startCreate() {
    setEditingId(null)
    setForm(emptyForm)
    setPinEmployee(null)
    setEmployeeFormOpen(true)
    setError("")
    setMessage("")
  }

  function startEdit(employee: Employee) {
    setEditingId(employee.id)
    setForm({
      organizationId: employee.organizationId,
      propertyId: employee.propertyId ?? "",
      departmentId: employee.departmentId ?? "",
      departmentRoleId: employee.departmentRoleId ?? "",
      staffingCompanyId: employee.staffingCompanyId ?? "",
      employeeNumber: employee.employeeNumber,
      firstName: employee.firstName,
      lastName: employee.lastName,
      employmentType: employee.employmentType,
      position: employee.position ?? "",
      phone: employee.phone ?? "",
      email: employee.email ?? "",
      payRate: employee.payRate ?? "",
      hireDate: employee.hireDate?.slice(0, 10) ?? "",
      pin: "",
    })
    setPinEmployee(null)
    setEmployeeFormOpen(true)
    setError("")
    setMessage("")
  }

  async function submitEmployee(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if ((!editingId || form.pin) && !/^\d{4}$/.test(form.pin)) {
      return setError("PIN must be exactly 4 digits.")
    }
    setBusy(true)
    setError("")
    setMessage("")

    const response = await fetch(
      editingId ? `/api/employees/${editingId}` : "/api/employees",
      {
        method: editingId ? "PATCH" : "POST",
        headers: { "content-type": "application/json", ...requestHeaders },
        body: JSON.stringify({
          ...form,
          pin: form.pin || undefined,
          propertyId: form.propertyId || null,
          departmentId: form.departmentId || null,
          departmentRoleId: form.departmentRoleId || null,
          staffingCompanyId: form.staffingCompanyId || null,
          position: form.position || null,
          phone: form.phone || null,
          email: form.email || null,
          payRate: form.payRate ? Number(form.payRate) : null,
          hireDate: form.hireDate || null,
        }),
      },
    )
    const result = await response.json()
    setBusy(false)

    if (!response.ok) return setError(result.error)
    setMessage(editingId ? "Employee updated." : "Employee created.")
    setEditingId(null)
    setForm(emptyForm)
    setEmployeeFormOpen(false)
    await load()
  }

  async function changeStatus(employee: Employee) {
    const status: RecordStatus =
      employee.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"
    const response = await fetch(`/api/employees/${employee.id}/deactivate`, {
      method: "POST",
      headers: { "content-type": "application/json", ...requestHeaders },
      body: JSON.stringify({ status }),
    })
    const result = await response.json()
    if (!response.ok) return setError(result.error)
    setMessage(status === "ACTIVE" ? "Employee reactivated." : "Employee marked inactive.")
    await load()
  }

  async function terminateSelectedEmployee(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!terminateTarget) return

    setBusy(true)
    setError("")
    setMessage("")
    const response = await fetch(`/api/employees/${terminateTarget.id}/terminate`, {
      method: "POST",
      headers: { "content-type": "application/json", ...requestHeaders },
      body: JSON.stringify({ reason: terminationReason }),
    })
    const result = await response.json()
    setBusy(false)

    if (!response.ok) return setError(result.error)
    setTerminateTarget(null)
    setTerminationReason("")
    setMessage("Employee terminated.")
    await load()
  }

  async function resetPin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!pinEmployee) return

    setBusy(true)
    setError("")
    const response = await fetch(`/api/employees/${pinEmployee.id}/reset-pin`, {
      method: "POST",
      headers: { "content-type": "application/json", ...requestHeaders },
      body: JSON.stringify({
        pin: pinReset,
        confirmPin: pinReset,
      }),
    })
    const result = await response.json()
    setBusy(false)

    if (!response.ok) return setError(result.error)
    setPinReset("")
    setPinEmployee(null)
    setMessage("Employee PIN reset securely.")
  }

  async function deleteSelectedEmployee() {
    if (!deleteTarget) return

    setBusy(true)
    setError("")
    setMessage("")
    const response = await fetch(`/api/employees/${deleteTarget.id}`, {
      method: "DELETE",
      headers: requestHeaders,
    })
    const result = await response.json()
    setBusy(false)

    if (!response.ok) return setError(result.error)
    setDeleteTarget(null)
    setMessage("Employee deleted.")
    await load()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Employees</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Manage clock-in employee records, assignments, status, and kiosk PINs.
            Create property managers, organization admins, HR/Ops, and finance users in Users &amp; Access.
          </p>
        </div>
        {canManage && (
          <Button onClick={startCreate}>
            <Plus /> Add Employee
          </Button>
        )}
      </div>

      {(message || error) && (
        <p className={error ? "text-sm text-destructive" : "text-sm text-foreground"}>
          {error || message}
        </p>
      )}

      {canManage && (
        <Sheet open={employeeFormOpen} onOpenChange={setEmployeeFormOpen}>
          <SheetContent className="overflow-y-auto sm:max-w-2xl">
            <SheetHeader>
              <SheetTitle>{editingId ? "Edit employee" : "Create employee"}</SheetTitle>
              <SheetDescription>
                Manage the employee master record and organizational assignments.
              </SheetDescription>
            </SheetHeader>
            <form onSubmit={submitEmployee} className="grid gap-4 px-4 sm:grid-cols-2">
              {error && <p className="text-sm text-destructive sm:col-span-2">{error}</p>}
              <Input
                value={form.employeeNumber}
                onChange={(event) => updateForm("employeeNumber", event.target.value)}
                placeholder="Employee number"
                required
              />
              <Input
                value={form.firstName}
                onChange={(event) => updateForm("firstName", event.target.value)}
                placeholder="First name"
                required
              />
              <Input
                value={form.lastName}
                onChange={(event) => updateForm("lastName", event.target.value)}
                placeholder="Last name"
                required
              />
              <Input
                value={form.position}
                onChange={(event) => updateForm("position", event.target.value)}
                placeholder="Position"
              />
              <Input value={form.phone} onChange={(event) => updateForm("phone", event.target.value)} placeholder="Phone (optional)" />
              <Input type="email" value={form.email} onChange={(event) => updateForm("email", event.target.value)} placeholder="Email (optional)" />
              <Input type="number" min="0" step="0.01" value={form.payRate} onChange={(event) => updateForm("payRate", event.target.value)} placeholder="Pay rate (optional)" />
              <Input type="date" value={form.hireDate} onChange={(event) => updateForm("hireDate", event.target.value)} />
              <Input
                value={form.pin}
                onChange={(event) => updateForm("pin", event.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder={editingId ? "New 4-digit kiosk PIN (optional)" : "Required 4-digit kiosk PIN"}
                type="password"
                inputMode="numeric"
                pattern="\d{4}"
                maxLength={4}
                required={!editingId}
              />
              <select
                className={selectClass}
                value={form.employmentType}
                onChange={(event) =>
                  updateForm("employmentType", event.target.value as EmploymentType)
                }
              >
                {employmentTypes.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
              <select
                className={selectClass}
                value={form.organizationId}
                onChange={(event) => updateForm("organizationId", event.target.value)}
                required
              >
                <option value="">Organization</option>
                {data.options.organizations.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
              <select
                className={selectClass}
                value={form.propertyId}
                onChange={(event) => updateForm("propertyId", event.target.value)}
                required={!editingId || Boolean(form.pin)}
              >
                <option value="">Select property</option>
                {properties.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
              <select
                className={selectClass}
                value={form.departmentId}
                onChange={(event) => updateForm("departmentId", event.target.value)}
                disabled={!form.propertyId}
              >
                <option value="">No department assignment</option>
                {departments.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
              <select
                className={selectClass}
                value={form.departmentRoleId}
                onChange={(event) => updateForm("departmentRoleId", event.target.value)}
                disabled={!form.departmentId}
              >
                <option value="">No department role</option>
                {departmentRoles.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
              {(form.employmentType === "AGENCY" || form.employmentType === "STAFFING") && (
                <select
                  className={selectClass}
                  value={form.staffingCompanyId}
                  onChange={(event) => updateForm("staffingCompanyId", event.target.value)}
                  required
                >
                  <option value="">Staffing company</option>
                  {staffingCompanies.map((item) => (
                    <option key={item.id} value={item.id}>{item.displayName}</option>
                  ))}
                </select>
              )}
              <SheetFooter className="px-0 sm:col-span-2">
                <Button disabled={busy}>
                  {busy ? "Saving..." : editingId ? "Save changes" : "Create employee"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setEmployeeFormOpen(false)}>
                  Cancel
                </Button>
              </SheetFooter>
            </form>
          </SheetContent>
        </Sheet>
      )}

      {canManage && (
        <Sheet open={Boolean(pinEmployee)} onOpenChange={(open) => {
          if (!open) {
            setPinEmployee(null)
            setPinReset("")
          }
        }}>
          <SheetContent className="sm:max-w-md">
            <SheetHeader>
              <SheetTitle>
                Reset PIN{pinEmployee ? ` for ${pinEmployee.firstName} ${pinEmployee.lastName}` : ""}
              </SheetTitle>
              <SheetDescription>
                Set a new kiosk PIN without exposing the existing PIN.
              </SheetDescription>
            </SheetHeader>
            <form onSubmit={resetPin} className="grid gap-4 px-4">
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Input value={pinReset} onChange={(event) => setPinReset(event.target.value.replace(/\D/g, "").slice(0, 4))} name="pin" type="password" inputMode="numeric" pattern="\d{4}" maxLength={4} placeholder="New 4-digit PIN" required />
              <Button type="button" variant="outline" onClick={() => setPinReset(generateFourDigitPin())}>
                Generate 4-digit PIN
              </Button>
              <SheetFooter className="px-0">
                <Button disabled={busy || pinReset.length !== 4}>{busy ? "Resetting..." : "Reset PIN"}</Button>
                <Button type="button" variant="outline" onClick={() => setPinEmployee(null)}>
                  Cancel
                </Button>
              </SheetFooter>
            </form>
            <p className="px-4 text-sm text-muted-foreground">
              PIN values are hashed before storage and are never displayed.
            </p>
          </SheetContent>
        </Sheet>
      )}

      {canManage && (
        <Sheet open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <SheetContent className="sm:max-w-md">
            <SheetHeader>
              <SheetTitle>Delete employee</SheetTitle>
              <SheetDescription>
                This will permanently delete this employee record. This action cannot be undone.
              </SheetDescription>
            </SheetHeader>
            {deleteTarget && (
              <p className="px-4 text-sm font-medium">
                {deleteTarget.firstName} {deleteTarget.lastName} ({deleteTarget.employeeNumber})
              </p>
            )}
            <SheetFooter>
              <Button
                variant="destructive"
                disabled={busy}
                onClick={deleteSelectedEmployee}
              >
                <Trash2 /> {busy ? "Deleting..." : "Delete employee"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>
                Cancel
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      )}

      {canManage && (
        <Sheet
          open={Boolean(terminateTarget)}
          onOpenChange={(open) => {
            if (!open) {
              setTerminateTarget(null)
              setTerminationReason("")
            }
          }}
        >
          <SheetContent className="sm:max-w-md">
            <SheetHeader>
              <SheetTitle>Terminate employee</SheetTitle>
              <SheetDescription>
                Termination prevents future scheduling and clock-in while preserving workforce history.
              </SheetDescription>
            </SheetHeader>
            <form onSubmit={terminateSelectedEmployee} className="grid gap-4 px-4">
              <textarea
                value={terminationReason}
                onChange={(event) => setTerminationReason(event.target.value)}
                className="min-h-28 rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                placeholder="Termination reason"
                required
              />
              <SheetFooter className="px-0">
                <Button variant="destructive" disabled={busy}>
                  <UserX /> {busy ? "Terminating..." : "Terminate employee"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setTerminateTarget(null)
                    setTerminationReason("")
                  }}
                >
                  Cancel
                </Button>
              </SheetFooter>
            </form>
          </SheetContent>
        </Sheet>
      )}

      <Card>
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <h2 className="font-semibold">Employee master records</h2>
          <div className="flex flex-wrap gap-2" aria-label="Employee status filter">
            {statusFilters.map((filter) => (
              <Button
                key={filter.value}
                size="sm"
                variant={statusFilter === filter.value ? "default" : "outline"}
                onClick={() => setStatusFilter(filter.value)}
              >
                {filter.label}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <thead>
              <tr>
                <TableHead>Employee</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Organization</TableHead>
                <TableHead>Property / Department</TableHead>
                <TableHead>Staffing company</TableHead>
                <TableHead>Status</TableHead>
                {canManage && <TableHead>Actions</TableHead>}
              </tr>
            </thead>
            <tbody>
              {data.employees.map((employee) => (
                <tr key={employee.id}>
                  <TableCell>
                    <p className="font-medium">{employee.firstName} {employee.lastName}</p>
                    <p className="text-xs text-muted-foreground">
                      {employee.employeeNumber}{employee.position ? ` · ${employee.position}` : ""}
                    </p>
                  </TableCell>
                  <TableCell><Badge>{employee.employmentType}</Badge></TableCell>
                  <TableCell>{employee.organization.name}</TableCell>
                  <TableCell>
                    {employee.property?.name ?? "Unassigned"}
                    {employee.department && (
                      <p className="text-xs text-muted-foreground">{employee.department.name}</p>
                    )}
                  </TableCell>
                  <TableCell>{employee.staffingCompany?.displayName ?? "—"}</TableCell>
                  <TableCell>
                    <Badge>{employee.status}</Badge>
                    {employee.status === "TERMINATED" && (
                      <div className="mt-2 max-w-56 text-xs text-muted-foreground">
                        {employee.terminatedAt && (
                          <p>{new Date(employee.terminatedAt).toLocaleDateString()}</p>
                        )}
                        {employee.terminationReason && <p>{employee.terminationReason}</p>}
                      </div>
                    )}
                  </TableCell>
                  {canManage && (
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => startEdit(employee)}>
                          <Pencil /> Edit
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => { setError(""); setPinEmployee(employee) }}>
                          <KeyRound /> Reset PIN
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => changeStatus(employee)}
                        >
                          {employee.status === "ACTIVE" ? <UserMinus /> : <UserCheck />}
                          {employee.status === "ACTIVE" ? "Mark Inactive" : "Reactivate"}
                        </Button>
                        {employee.status !== "TERMINATED" && (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => setTerminateTarget(employee)}
                          >
                            <UserX /> Terminate Employee
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => setDeleteTarget(employee)}
                        >
                          <Trash2 /> Delete
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </tr>
              ))}
            </tbody>
          </Table>
          {data.employees.length === 0 && (
            <p className="p-6 text-center text-sm text-muted-foreground">
              No employees found. Create your first employee.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
