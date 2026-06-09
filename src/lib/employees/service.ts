import {
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
import { hashPin } from "@/src/lib/security/pin"

const employeeSelect = {
  id: true,
  organizationId: true,
  propertyId: true,
  departmentId: true,
  staffingCompanyId: true,
  employeeNumber: true,
  firstName: true,
  lastName: true,
  employmentType: true,
  position: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  organization: { select: { id: true, name: true } },
  property: { select: { id: true, name: true } },
  department: { select: { id: true, name: true } },
  staffingCompany: { select: { id: true, displayName: true } },
} satisfies Prisma.EmployeeSelect

export async function listEmployees() {
  const [employees, organizations, properties, departments, staffingCompanies] =
    await Promise.all([
      prisma.employee.findMany({
        select: employeeSelect,
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      }),
      prisma.organization.findMany({
        where: { status: RecordStatus.ACTIVE },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.property.findMany({
        where: { status: RecordStatus.ACTIVE },
        select: { id: true, organizationId: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.department.findMany({
        where: { status: RecordStatus.ACTIVE },
        select: { id: true, organizationId: true, propertyId: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.staffingCompany.findMany({
        where: {
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
    options: { organizations, properties, departments, staffingCompanies },
  }
}

export async function createEmployee(input: CreateEmployeeInput) {
  await validateAssignments(input)

  const employee = await prisma.employee.create({
    data: normalizeEmployeeInput(input),
    select: employeeSelect,
  })

  await createAuditLog({
    action: "EMPLOYEE_CREATED",
    entityType: "Employee",
    entityId: employee.id,
    organizationId: employee.organizationId,
    propertyId: employee.propertyId ?? undefined,
    metadata: { employeeNumber: employee.employeeNumber },
  })

  return employee
}

export async function updateEmployee(id: string, input: UpdateEmployeeInput) {
  await validateAssignments(input)

  const employee = await prisma.employee.update({
    where: { id },
    data: normalizeEmployeeInput(input),
    select: employeeSelect,
  })

  await createAuditLog({
    action: "EMPLOYEE_UPDATED",
    entityType: "Employee",
    entityId: employee.id,
    organizationId: employee.organizationId,
    propertyId: employee.propertyId ?? undefined,
    metadata: { employeeNumber: employee.employeeNumber },
  })

  return employee
}

export async function setEmployeeStatus(id: string, status: RecordStatus) {
  const employee = await prisma.employee.update({
    where: { id },
    data: { status },
    select: employeeSelect,
  })

  await createAuditLog({
    action:
      status === RecordStatus.ACTIVE
        ? "EMPLOYEE_ACTIVATED"
        : "EMPLOYEE_DEACTIVATED",
    entityType: "Employee",
    entityId: employee.id,
    organizationId: employee.organizationId,
    propertyId: employee.propertyId ?? undefined,
    metadata: { employeeNumber: employee.employeeNumber },
  })

  return employee
}

export async function resetEmployeePin(id: string, pin: string) {
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
    metadata: { employeeNumber: employee.employeeNumber },
  })

  return employee
}

function normalizeEmployeeInput(input: CreateEmployeeInput | UpdateEmployeeInput) {
  return {
    ...input,
    propertyId: input.propertyId || null,
    departmentId: input.departmentId || null,
    position: input.position || null,
    staffingCompanyId:
      input.employmentType === EmploymentType.AGENCY
        ? input.staffingCompanyId || null
        : null,
  }
}

async function validateAssignments(
  input: CreateEmployeeInput | UpdateEmployeeInput,
) {
  const [organization, property, department, staffingCompany] =
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
  if (input.staffingCompanyId && !staffingCompany) {
    throw new Error("Staffing company does not belong to the organization.")
  }
}
