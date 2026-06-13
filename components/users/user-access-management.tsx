"use client"

import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react"
import { Pencil, Plus, RotateCcw, UserMinus } from "lucide-react"

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
import { ROLE_LABELS, Role, type Role as RoleType } from "@/src/lib/rbac/roles"

type Status = "ACTIVE" | "INACTIVE"
type NamedOption = { id: string; name: string }
type UserRow = {
  id: string
  email: string
  firstName: string
  lastName: string
  role: RoleType
  organizationId: string | null
  staffingCompanyId: string | null
  status: Status
  createdAt: string
  organization: NamedOption | null
  staffingCompany: { id: string; displayName: string } | null
  properties: NamedOption[]
  propertyIds: string[]
  clerkLinked: boolean
  canManage: boolean
}
type UserData = {
  users: UserRow[]
  options: {
    organizations: NamedOption[]
    properties: (NamedOption & { organizationId: string })[]
    staffingCompanies: { id: string; displayName: string; organizationId: string }[]
    roles: RoleType[]
  }
}
type UserForm = {
  firstName: string
  lastName: string
  email: string
  role: RoleType
  organizationId: string
  propertyIds: string[]
  staffingCompanyId: string
  status: Status
}

const emptyData: UserData = {
  users: [],
  options: { organizations: [], properties: [], staffingCompanies: [], roles: [] },
}

const emptyForm: UserForm = {
  firstName: "",
  lastName: "",
  email: "",
  role: Role.EMPLOYEE,
  organizationId: "",
  propertyIds: [],
  staffingCompanyId: "",
  status: "ACTIVE",
}

const selectClass =
  "h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"

export function UserAccessManagement() {
  const { currentUser } = useCurrentUser()
  const canCreate = hasPermission(currentUser, Permission.MANAGE_USERS)
  const [data, setData] = useState<UserData>(emptyData)
  const [form, setForm] = useState<UserForm>(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  const requestHeaders = useMemo(
    () =>
      mockRoleHeaders(currentUser.role, {
        organizationId: currentUser.organizationId,
        propertyIds: currentUser.propertyIds,
        staffingCompanyId: currentUser.staffingCompanyId,
      }),
    [currentUser],
  )
  const load = useCallback(async () => {
    const response = await fetch("/api/users", { headers: requestHeaders })
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
    (property) => property.organizationId === form.organizationId,
  )
  const staffingCompanies = data.options.staffingCompanies.filter(
    (company) => company.organizationId === form.organizationId,
  )
  const isPlatformRole =
    form.role === Role.PLATFORM_OWNER || form.role === Role.PLATFORM_ADMIN
  const isPropertyManager = form.role === Role.PROPERTY_MANAGER
  const isStaffingRole =
    form.role === Role.STAFFING_ADMIN || form.role === Role.STAFFING_BILLING

  function startCreate() {
    setEditingId(null)
    setForm({ ...emptyForm, role: data.options.roles[0] ?? Role.EMPLOYEE })
    setError("")
    setOpen(true)
  }

  function startEdit(user: UserRow) {
    setEditingId(user.id)
    setForm({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId ?? "",
      propertyIds: user.propertyIds,
      staffingCompanyId: user.staffingCompanyId ?? "",
      status: user.status,
    })
    setError("")
    setOpen(true)
  }

  function updateRole(role: RoleType) {
    setForm((current) => ({
      ...current,
      role,
      organizationId:
        role === Role.PLATFORM_OWNER || role === Role.PLATFORM_ADMIN
          ? ""
          : current.organizationId,
      propertyIds: role === Role.PROPERTY_MANAGER ? current.propertyIds : [],
      staffingCompanyId:
        role === Role.STAFFING_ADMIN || role === Role.STAFFING_BILLING
          ? current.staffingCompanyId
          : "",
    }))
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError("")
    setMessage("")
    const response = await fetch(editingId ? `/api/users/${editingId}` : "/api/users", {
      method: editingId ? "PATCH" : "POST",
      headers: { "content-type": "application/json", ...requestHeaders },
      body: JSON.stringify({
        ...form,
        organizationId: form.organizationId || null,
        staffingCompanyId: form.staffingCompanyId || null,
      }),
    })
    const result = await response.json()
    setBusy(false)
    if (!response.ok) return setError(result.error)
    setOpen(false)
    setMessage(editingId ? "User access updated." : "User created.")
    await load()
  }

  async function changeStatus(user: UserRow) {
    setError("")
    setMessage("")
    const action = user.status === "ACTIVE" ? "deactivate" : "reactivate"
    const response = await fetch(`/api/users/${user.id}/${action}`, {
      method: "PATCH",
      headers: requestHeaders,
    })
    const result = await response.json()
    if (!response.ok) return setError(result.error)
    setMessage(user.status === "ACTIVE" ? "User deactivated." : "User reactivated.")
    await load()
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Users &amp; Access</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage roles, organization access, property assignments, and account status.
          </p>
        </div>
        {canCreate && (
          <Button onClick={startCreate}>
            <Plus className="size-4" />
            Add user
          </Button>
        )}
      </div>

      {(message || error) && (
        <p className={error ? "text-sm text-destructive" : "text-sm text-emerald-700"}>
          {error || message}
        </p>
      )}

      <Card>
        <CardHeader>
          <p className="font-semibold">Access directory</p>
          <p className="text-sm text-muted-foreground">{data.users.length} users in your scope</p>
        </CardHeader>
        <CardContent className="p-0">
          <Table className="min-w-[1250px]">
            <thead>
              <tr>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Organization</TableHead>
                <TableHead>Assigned properties</TableHead>
                <TableHead>Staffing company</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Clerk</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </tr>
            </thead>
            <tbody>
              {data.users.map((user) => (
                <tr key={user.id}>
                  <TableCell className="font-medium">{user.firstName} {user.lastName}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell><Badge>{ROLE_LABELS[user.role]}</Badge></TableCell>
                  <TableCell>{user.organization?.name ?? "TalentNest Technologies"}</TableCell>
                  <TableCell>{user.properties.map((property) => property.name).join(", ") || "—"}</TableCell>
                  <TableCell>{user.staffingCompany?.displayName ?? "—"}</TableCell>
                  <TableCell>
                    <Badge className={user.status === "ACTIVE" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : ""}>
                      {user.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{user.clerkLinked ? "Linked" : "Unlinked"}</TableCell>
                  <TableCell>{new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(user.createdAt))}</TableCell>
                  <TableCell>
                    {user.canManage ? (
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon-sm" onClick={() => startEdit(user)}>
                          <Pencil className="size-4" />
                          <span className="sr-only">Edit {user.firstName}</span>
                        </Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => changeStatus(user)}>
                          {user.status === "ACTIVE" ? <UserMinus className="size-4" /> : <RotateCcw className="size-4" />}
                          <span className="sr-only">{user.status === "ACTIVE" ? "Deactivate" : "Reactivate"} {user.firstName}</span>
                        </Button>
                      </div>
                    ) : "—"}
                  </TableCell>
                </tr>
              ))}
              {!data.users.length && (
                <tr><TableCell colSpan={10} className="py-10 text-center text-muted-foreground">No users found.</TableCell></tr>
              )}
            </tbody>
          </Table>
        </CardContent>
      </Card>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>{editingId ? "Edit user access" : "Add user"}</SheetTitle>
            <SheetDescription>Assign the user to the appropriate customer, properties, or staffing company.</SheetDescription>
          </SheetHeader>
          <form onSubmit={submit} className="space-y-5 px-4 pb-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="First name"><Input required value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} /></Field>
              <Field label="Last name"><Input required value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} /></Field>
            </div>
            <Field label="Email"><Input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></Field>
            <Field label="Role">
              <select className={selectClass} value={form.role} onChange={(event) => updateRole(event.target.value as RoleType)}>
                {data.options.roles.map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}
              </select>
            </Field>
            {!isPlatformRole && (
              <Field label="Organization">
                <select required className={selectClass} value={form.organizationId} onChange={(event) => setForm({ ...form, organizationId: event.target.value, propertyIds: [], staffingCompanyId: "" })}>
                  <option value="">Select organization</option>
                  {data.options.organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}
                </select>
              </Field>
            )}
            {isPropertyManager && (
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">Properties</legend>
                <div className="grid gap-2 rounded-lg border p-3">
                  {properties.map((property) => (
                    <label key={property.id} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={form.propertyIds.includes(property.id)} onChange={(event) => setForm({ ...form, propertyIds: event.target.checked ? [...form.propertyIds, property.id] : form.propertyIds.filter((id) => id !== property.id) })} />
                      {property.name}
                    </label>
                  ))}
                  {!properties.length && <p className="text-sm text-muted-foreground">Select an organization with properties.</p>}
                </div>
              </fieldset>
            )}
            {isStaffingRole && (
              <Field label="Staffing company">
                <select required className={selectClass} value={form.staffingCompanyId} onChange={(event) => setForm({ ...form, staffingCompanyId: event.target.value })}>
                  <option value="">Select staffing company</option>
                  {staffingCompanies.map((company) => <option key={company.id} value={company.id}>{company.displayName}</option>)}
                </select>
              </Field>
            )}
            <Field label="Status">
              <select className={selectClass} value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as Status })}>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </Field>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <SheetFooter className="px-0">
              <Button disabled={busy} type="submit">{busy ? "Saving..." : "Save user"}</Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="grid gap-2 text-sm font-medium">{label}{children}</label>
}
