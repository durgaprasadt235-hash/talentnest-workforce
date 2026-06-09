"use client"

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react"
import { KeyRound, Pencil, Plus, UserCheck, UserX } from "lucide-react"

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

type EmploymentType = "DIRECT" | "AGENCY" | "TEMPORARY" | "SEASONAL"
type RecordStatus = "ACTIVE" | "INACTIVE"
type NamedOption = { id: string; name: string }
type PropertyOption = NamedOption & { organizationId: string }
type DepartmentOption = NamedOption & {
  organizationId: string
  propertyId: string
}
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
  staffingCompanyId: string | null
  employeeNumber: string
  firstName: string
  lastName: string
  employmentType: EmploymentType
  position: string | null
  status: RecordStatus
  organization: NamedOption
  property: NamedOption | null
  department: NamedOption | null
  staffingCompany: { id: string; displayName: string } | null
}
type EmployeeData = {
  employees: Employee[]
  options: {
    organizations: NamedOption[]
    properties: PropertyOption[]
    departments: DepartmentOption[]
    staffingCompanies: StaffingCompanyOption[]
  }
}
type EmployeeForm = {
  organizationId: string
  propertyId: string
  departmentId: string
  staffingCompanyId: string
  employeeNumber: string
  firstName: string
  lastName: string
  employmentType: EmploymentType
  position: string
}

const emptyData: EmployeeData = {
  employees: [],
  options: {
    organizations: [],
    properties: [],
    departments: [],
    staffingCompanies: [],
  },
}

const emptyForm: EmployeeForm = {
  organizationId: "",
  propertyId: "",
  departmentId: "",
  staffingCompanyId: "",
  employeeNumber: "",
  firstName: "",
  lastName: "",
  employmentType: "DIRECT",
  position: "",
}

const employmentTypes: EmploymentType[] = [
  "DIRECT",
  "AGENCY",
  "TEMPORARY",
  "SEASONAL",
]

const selectClass =
  "h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"

export function EmployeeManagement() {
  const { currentUser } = useCurrentUser()
  const canManage = hasPermission(currentUser, Permission.MANAGE_EMPLOYEES)
  const [data, setData] = useState<EmployeeData>(emptyData)
  const [form, setForm] = useState<EmployeeForm>(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [employeeFormOpen, setEmployeeFormOpen] = useState(false)
  const [pinEmployee, setPinEmployee] = useState<Employee | null>(null)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  const requestHeaders = useMemo(
    () => mockRoleHeaders(currentUser.role),
    [currentUser.role],
  )

  const load = useCallback(async () => {
    const response = await fetch("/api/employees", { headers: requestHeaders })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error)
    setData(result)
  }, [requestHeaders])

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

  function updateForm<K extends keyof EmployeeForm>(
    key: K,
    value: EmployeeForm[K],
  ) {
    setForm((current) => {
      const next = { ...current, [key]: value }
      if (key === "organizationId") {
        next.propertyId = ""
        next.departmentId = ""
        next.staffingCompanyId = ""
      }
      if (key === "propertyId") next.departmentId = ""
      if (key === "employmentType" && value !== "AGENCY") {
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
      staffingCompanyId: employee.staffingCompanyId ?? "",
      employeeNumber: employee.employeeNumber,
      firstName: employee.firstName,
      lastName: employee.lastName,
      employmentType: employee.employmentType,
      position: employee.position ?? "",
    })
    setPinEmployee(null)
    setEmployeeFormOpen(true)
    setError("")
    setMessage("")
  }

  async function submitEmployee(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
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
          propertyId: form.propertyId || null,
          departmentId: form.departmentId || null,
          staffingCompanyId: form.staffingCompanyId || null,
          position: form.position || null,
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
    setMessage(status === "ACTIVE" ? "Employee activated." : "Employee deactivated.")
    await load()
  }

  async function resetPin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!pinEmployee) return

    setBusy(true)
    setError("")
    const formData = new FormData(event.currentTarget)
    const response = await fetch(`/api/employees/${pinEmployee.id}/reset-pin`, {
      method: "POST",
      headers: { "content-type": "application/json", ...requestHeaders },
      body: JSON.stringify({
        pin: formData.get("pin"),
        confirmPin: formData.get("confirmPin"),
      }),
    })
    const result = await response.json()
    setBusy(false)

    if (!response.ok) return setError(result.error)
    event.currentTarget.reset()
    setPinEmployee(null)
    setMessage("Employee PIN reset securely.")
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Employees</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Manage employee master records, assignments, status, and kiosk PINs.
          </p>
        </div>
        {canManage && (
          <Button onClick={startCreate}>
            <Plus /> New employee
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
              >
                <option value="">No property assignment</option>
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
              {form.employmentType === "AGENCY" && (
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
        <Sheet open={Boolean(pinEmployee)} onOpenChange={(open) => !open && setPinEmployee(null)}>
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
              <Input name="pin" type="password" inputMode="numeric" placeholder="New PIN" required />
              <Input name="confirmPin" type="password" inputMode="numeric" placeholder="Confirm new PIN" required />
              <SheetFooter className="px-0">
                <Button disabled={busy}>{busy ? "Resetting..." : "Reset PIN"}</Button>
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

      <Card>
        <CardHeader><h2 className="font-semibold">Employee master records</h2></CardHeader>
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
                  <TableCell><Badge>{employee.status}</Badge></TableCell>
                  {canManage && (
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => startEdit(employee)}>
                          <Pencil /> Edit
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setPinEmployee(employee)}>
                          <KeyRound /> Reset PIN
                        </Button>
                        <Button
                          size="sm"
                          variant={employee.status === "ACTIVE" ? "destructive" : "outline"}
                          onClick={() => changeStatus(employee)}
                        >
                          {employee.status === "ACTIVE" ? <UserX /> : <UserCheck />}
                          {employee.status === "ACTIVE" ? "Deactivate" : "Activate"}
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
              No employee records found.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
