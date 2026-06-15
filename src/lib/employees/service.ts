import {
  AuditType,
  EmployeeStatus,
  EmploymentType,
  Prisma,
  RecordStatus,
  StaffingCompanyStatus,
} from "@prisma/client"

import { createAuditLog } from "@/src/lib/audit"
import type {
  CreateEmployeeInput,
  UpdateEmployeeInput,
} from "@/src/lib/employees/validation"
import { prisma } from "@/src/lib/prisma"
import type { CurrentUser } from "@/src/lib/rbac/current-user"
import { Role } from "@/src/lib/rbac/roles"
import { hashPin, verifyPin } from "@/src/lib/security/pin"

const DUPLICATE_PIN_ERROR =
  "This PIN is already assigned to another active employee at this property."
const PROPERTY_PIN_ERROR = "Assign a property before assigning a kiosk PIN."

const employeeSelect = {
  id: true,
  organizationId: true,
  propertyId: true,
  departmentId: true,
  departmentRoleId: true,
  staffingCompanyId: true,
  employeeNumber: true,
  firstName: true,
  lastName: true,
  employmentType: true,
  position: true,
  phone: true,
  email: true,
  payRate: true,
  hireDate: true,
  status: true,
  terminatedAt: true,
  terminationReason: true,
  createdAt: true,
  updatedAt: true,
  organization: { select: { id: true, name: true } },
  property: { select: { id: true, name: true } },
  department: { select: { id: true, name: true } },
  departmentRole: { select: { id: true, name: true } },
  staffingCompany: { select: { id: true, displayName: true } },
} satisfies Prisma.EmployeeSelect

export async function listEmployees(
  status: EmployeeStatus | "ALL" = EmployeeStatus.ACTIVE,
  actor?: CurrentUser,
) {
  const where = employeeScope(actor)
  const [employees, organizations, properties, departments, departmentRoles, staffingCompanies] =
    await Promise.all([
      prisma.employee.findMany({
        where: { ...where, ...(status === "ALL" ? {} : { status }) },
        select: employeeSelect,
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      }),
      prisma.organization.findMany({
        where: { status: RecordStatus.ACTIVE, ...(actor?.organizationId ? { id: actor.organizationId } : {}) },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.property.findMany({
        where: { status: RecordStatus.ACTIVE, ...propertyScope(actor) },
        select: { id: true, organizationId: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.department.findMany({
        where: { status: RecordStatus.ACTIVE, ...departmentScope(actor) },
        select: { id: true, organizationId: true, propertyId: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.departmentRole.findMany({
        where: { status: RecordStatus.ACTIVE, department: departmentScope(actor) },
        select: { id: true, departmentId: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.staffingCompany.findMany({
        where: {
          ...(actor?.organizationId ? { organizationId: actor.organizationId } : {}),
          status: {
            in: [StaffingCompanyStatus.ACTIVE, StaffingCompanyStatus.PENDING],
          },
        },
        select: { id: true, organizationId: true, displayName: true },
        orderBy: { displayName: "asc" },
      }),
    ])

  return {
    employees,
    options: { organizations, properties, departments, departmentRoles, staffingCompanies },
  }
}

export async function createEmployee(input: CreateEmployeeInput, actor?: CurrentUser) {
  assertEmployeeScope(actor, input.organizationId, input.propertyId)
  await validateAssignments(input)
  if (!input.propertyId) throw new Error(PROPERTY_PIN_ERROR)
  await ensureUniqueActivePin(input.propertyId, input.pin)

  const employee = await prisma.employee.create({
    data: {
      ...normalizeEmployeeInput(input),
      clockPinHash: await hashPin(input.pin),
    },
    select: employeeSelect,
  })

  await createAuditLog({
    action: "EMPLOYEE_CREATED",
    entityType: "Employee",
    entityId: employee.id,
    organizationId: employee.organizationId,
    propertyId: employee.propertyId ?? undefined,
    departmentId: employee.departmentId ?? undefined,
    metadata: { employeeNumber: employee.employeeNumber },
  })

  return employee
}

export async function updateEmployee(id: string, input: UpdateEmployeeInput, actor?: CurrentUser) {
  assertEmployeeScope(actor, input.organizationId, input.propertyId)
  await validateAssignments(input)
  const existing = await prisma.employee.findUnique({
    where: { id },
    select: { organizationId: true, propertyId: true, clockPinHash: true },
  })
  if (!existing) throw new Error("Employee not found.")
  assertEmployeeScope(actor, existing.organizationId, existing.propertyId)
  if (input.pin) {
    if (!input.propertyId) throw new Error(PROPERTY_PIN_ERROR)
    await ensureUniqueActivePin(input.propertyId, input.pin, id)
  } else if (existing.clockPinHash && existing.propertyId !== input.propertyId) {
    throw new Error("Enter a new 4-digit PIN when changing an employee's property.")
  }

  const employee = await prisma.employee.update({
    where: { id },
    data: {
      ...normalizeEmployeeInput(input),
      clockPinHash: input.pin ? await hashPin(input.pin) : undefined,
    },
    select: employeeSelect,
  })

  await createAuditLog({
    action: "EMPLOYEE_UPDATED",
    entityType: "Employee",
    entityId: employee.id,
    organizationId: employee.organizationId,
    propertyId: employee.propertyId ?? undefined,
    departmentId: employee.departmentId ?? undefined,
    metadata: { employeeNumber: employee.employeeNumber },
  })

  return employee
}

export async function setEmployeeStatus(id: string, status: EmployeeStatus, actor?: CurrentUser) {
  const existing = await prisma.employee.findUnique({
    where: { id },
    select: { organizationId: true, propertyId: true, clockPinHash: true },
  })
  if (!existing) throw new Error("Employee not found.")
  assertEmployeeScope(actor, existing.organizationId, existing.propertyId)
  if (status === EmployeeStatus.ACTIVE) {
    if (!existing.clockPinHash) {
      throw new Error("Assign a 4-digit PIN before reactivating this employee.")
    }
  }

  const employee = await prisma.employee.update({
    where: { id },
    data: {
      status,
      terminatedAt: status === EmployeeStatus.ACTIVE ? null : undefined,
      terminationReason: status === EmployeeStatus.ACTIVE ? null : undefined,
      clockPinHash: status === EmployeeStatus.INACTIVE ? null : undefined,
    },
    select: employeeSelect,
  })

  await createAuditLog({
    action:
      status === EmployeeStatus.ACTIVE
        ? "REACTIVATE_EMPLOYEE"
        : "MARK_EMPLOYEE_INACTIVE",
    entityType: "Employee",
    entityId: employee.id,
    organizationId: employee.organizationId,
    propertyId: employee.propertyId ?? undefined,
    departmentId: employee.departmentId ?? undefined,
    metadata: { employeeNumber: employee.employeeNumber },
  })

  return employee
}

export async function terminateEmployee(id: string, reason: string, actor?: CurrentUser) {
  await assertExistingEmployeeScope(id, actor)
  const employee = await prisma.employee.update({
    where: { id },
    data: {
      status: EmployeeStatus.TERMINATED,
      terminatedAt: new Date(),
      terminationReason: reason,
      clockPinHash: null,
    },
    select: employeeSelect,
  })

  await createAuditLog({
    action: "TERMINATE_EMPLOYEE",
    entityType: "Employee",
    entityId: employee.id,
    organizationId: employee.organizationId,
    propertyId: employee.propertyId ?? undefined,
    departmentId: employee.departmentId ?? undefined,
    metadata: { employeeNumber: employee.employeeNumber, reason },
  })

  return employee
}

export async function resetEmployeePin(id: string, pin: string, actor?: CurrentUser) {
  const existing = await prisma.employee.findUnique({
    where: { id },
    select: { organizationId: true, propertyId: true },
  })
  if (!existing) throw new Error("Employee not found.")
  assertEmployeeScope(actor, existing.organizationId, existing.propertyId)
  if (!existing.propertyId) throw new Error(PROPERTY_PIN_ERROR)
  await ensureUniqueActivePin(existing.propertyId, pin, id)

  const employee = await prisma.employee.update({
    where: { id },
    data: { clockPinHash: await hashPin(pin) },
    select: employeeSelect,
  })

  await createAuditLog({
    action: "EMPLOYEE_PIN_RESET",
    entityType: "Employee",
    entityId: employee.id,
    organizationId: employee.organizationId,
    propertyId: employee.propertyId ?? undefined,
    departmentId: employee.departmentId ?? undefined,
    metadata: { employeeNumber: employee.employeeNumber },
  })

  return employee
}

export async function deleteEmployee(id: string, actor?: CurrentUser) {
  await assertExistingEmployeeScope(id, actor)
  return prisma.$transaction(async (transaction) => {
    const employee = await transaction.employee.findUnique({
      where: { id },
      select: {
        id: true,
        employeeNumber: true,
        organizationId: true,
        propertyId: true,
        departmentId: true,
        _count: {
          select: {
            shifts: true,
            attendanceRecords: true,
            attendanceExceptions: true,
            attendanceFreezes: true,
            attendanceAlerts: true,
          },
        },
      },
    })

    if (!employee) {
      throw new Error("Employee not found.")
    }

    const workforceRecordCount = Object.values(employee._count).reduce(
      (sum, count) => sum + count,
      0,
    )

    if (workforceRecordCount > 0) {
      throw new Error(
        "Employee has workforce history. Terminate or mark inactive instead.",
      )
    }

    await transaction.auditLog.create({
      data: {
        action: "DELETE_EMPLOYEE",
        auditType: AuditType.ORGANIZATION,
        entityType: "Employee",
        entityId: employee.id,
        organizationId: employee.organizationId,
        propertyId: employee.propertyId,
        departmentId: employee.departmentId,
        employeeId: employee.id,
        metadata: { employeeNumber: employee.employeeNumber },
      },
    })

    await transaction.employee.delete({ where: { id: employee.id } })

    return { id: employee.id }
  })
}

function normalizeEmployeeInput(input: CreateEmployeeInput | UpdateEmployeeInput) {
  return {
    organizationId: input.organizationId,
    employeeNumber: input.employeeNumber,
    firstName: input.firstName,
    lastName: input.lastName,
    employmentType: input.employmentType,
    propertyId: input.propertyId || null,
    departmentId: input.departmentId || null,
    departmentRoleId: input.departmentRoleId || null,
    position: input.position || null,
    phone: input.phone || null,
    email: input.email || null,
    payRate: input.payRate ?? null,
    hireDate: input.hireDate ? new Date(input.hireDate) : null,
    staffingCompanyId:
      input.employmentType === EmploymentType.AGENCY ||
      input.employmentType === EmploymentType.STAFFING
        ? input.staffingCompanyId || null
        : null,
  }
}

async function ensureUniqueActivePin(
  propertyId: string,
  pin: string,
  excludedEmployeeId?: string,
) {
  const employees = await prisma.employee.findMany({
    where: {
      propertyId,
      status: EmployeeStatus.ACTIVE,
      clockPinHash: { not: null },
      id: excludedEmployeeId ? { not: excludedEmployeeId } : undefined,
    },
    select: { clockPinHash: true },
  })
  const matches = await Promise.all(
    employees.map((employee) => verifyPin(pin, employee.clockPinHash!)),
  )
  if (matches.some(Boolean)) throw new Error(DUPLICATE_PIN_ERROR)
}

async function validateAssignments(
  input: CreateEmployeeInput | UpdateEmployeeInput,
) {
  const [organization, property, department, departmentRole, staffingCompany] =
    await Promise.all([
      prisma.organization.findFirst({
        where: { id: input.organizationId, status: RecordStatus.ACTIVE },
      }),
      input.propertyId
        ? prisma.property.findFirst({
            where: {
              id: input.propertyId,
              organizationId: input.organizationId,
              status: RecordStatus.ACTIVE,
            },
          })
        : null,
      input.departmentId
        ? prisma.department.findFirst({
            where: {
              id: input.departmentId,
              organizationId: input.organizationId,
              propertyId: input.propertyId ?? undefined,
              status: RecordStatus.ACTIVE,
            },
          })
        : null,
      input.departmentRoleId
        ? prisma.departmentRole.findFirst({
            where: {
              id: input.departmentRoleId,
              departmentId: input.departmentId ?? undefined,
              status: RecordStatus.ACTIVE,
            },
          })
        : null,
      input.staffingCompanyId
        ? prisma.staffingCompany.findFirst({
            where: {
              id: input.staffingCompanyId,
              organizationId: input.organizationId,
              status: {
                in: [
                  StaffingCompanyStatus.ACTIVE,
                  StaffingCompanyStatus.PENDING,
                ],
              },
            },
          })
        : null,
    ])

  if (!organization) throw new Error("Organization is not active or valid.")
  if (input.propertyId && !property) {
    throw new Error("Property does not belong to the selected organization.")
  }
  if (input.departmentId && !input.propertyId) {
    throw new Error("A property is required when assigning a department.")
  }
  if (input.departmentId && !department) {
    throw new Error("Department does not belong to the selected property.")
  }
  if (input.departmentRoleId && !departmentRole) {
    throw new Error("Department role does not belong to the selected department.")
  }
  if (input.staffingCompanyId && !staffingCompany) {
    throw new Error("Staffing company does not belong to the organization.")
  }
}

function employeeScope(actor?: CurrentUser): Prisma.EmployeeWhereInput {
  if (!actor || actor.role === Role.PLATFORM_OWNER || actor.role === Role.PLATFORM_ADMIN) return {}
  if (actor.role === Role.PROPERTY_MANAGER) return { propertyId: { in: actor.propertyIds ?? [] } }
  return { organizationId: actor.organizationId ?? "" }
}

function propertyScope(actor?: CurrentUser): Prisma.PropertyWhereInput {
  if (!actor || actor.role === Role.PLATFORM_OWNER || actor.role === Role.PLATFORM_ADMIN) return {}
  if (actor.role === Role.PROPERTY_MANAGER) return { id: { in: actor.propertyIds ?? [] } }
  return { organizationId: actor.organizationId ?? "" }
}

function departmentScope(actor?: CurrentUser): Prisma.DepartmentWhereInput {
  if (!actor || actor.role === Role.PLATFORM_OWNER || actor.role === Role.PLATFORM_ADMIN) return {}
  if (actor.role === Role.PROPERTY_MANAGER) return { propertyId: { in: actor.propertyIds ?? [] } }
  return { organizationId: actor.organizationId ?? "" }
}

function assertEmployeeScope(actor: CurrentUser | undefined, organizationId: string, propertyId?: string | null) {
  if (!actor || actor.role === Role.PLATFORM_OWNER || actor.role === Role.PLATFORM_ADMIN) return
  if (actor.organizationId !== organizationId) throw new Error("Unauthorized.")
  if (actor.role === Role.PROPERTY_MANAGER && (!propertyId || !actor.propertyIds?.includes(propertyId))) {
    throw new Error("This property is not assigned to the current property manager.")
  }
}

async function assertExistingEmployeeScope(id: string, actor?: CurrentUser) {
  const employee = await prisma.employee.findUnique({ where: { id }, select: { organizationId: true, propertyId: true } })
  if (!employee) throw new Error("Employee not found.")
  assertEmployeeScope(actor, employee.organizationId, employee.propertyId)
}
