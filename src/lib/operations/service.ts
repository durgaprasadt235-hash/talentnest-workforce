import { Prisma, RecordStatus, ScheduleStatus, StaffingCompanyStatus } from "@prisma/client"

import { prisma } from "@/src/lib/prisma"
import type { CurrentUser } from "@/src/lib/rbac/current-user"
import { Role } from "@/src/lib/rbac/roles"
import type {
  departmentRoleSchema,
  scheduleSchema,
  scheduleShiftSchema,
  staffingCompanySchema,
} from "@/src/lib/operations/validation"
import type { z } from "zod"

export async function listDepartmentRoles(user: CurrentUser, departmentId?: string) {
  return prisma.departmentRole.findMany({
    where: {
      departmentId,
      department: departmentWhere(user),
    },
    include: { department: { include: { property: true } } },
    orderBy: [{ department: { name: "asc" } }, { name: "asc" }],
  })
}

export async function saveDepartmentRole(
  input: z.infer<typeof departmentRoleSchema>,
  user: CurrentUser,
  roleId?: string,
) {
  const department = await prisma.department.findFirst({
    where: { id: input.departmentId, ...departmentWhere(user) },
  })
  if (!department) throw new Error("Department is outside your access.")
  const data = { ...input, status: input.status ?? RecordStatus.ACTIVE }
  return roleId
    ? prisma.departmentRole.update({ where: { id: roleId }, data })
    : prisma.departmentRole.create({ data })
}

export async function listStaffingCompanies(user: CurrentUser) {
  return prisma.staffingCompany.findMany({
    where: staffingCompanyWhere(user),
    include: { organization: { select: { id: true, name: true } } },
    orderBy: { displayName: "asc" },
  })
}

export async function saveStaffingCompany(
  input: z.infer<typeof staffingCompanySchema>,
  user: CurrentUser,
  companyId?: string,
) {
  assertOrganization(user, input.organizationId)
  const data = {
    ...input,
    contactName: input.contactName || null,
    email: input.email || null,
    phone: input.phone || null,
    billingEmail: input.billingEmail || null,
    status: input.status ?? StaffingCompanyStatus.ACTIVE,
  }
  return companyId
    ? prisma.staffingCompany.update({ where: { id: companyId }, data })
    : prisma.staffingCompany.create({ data })
}

export async function listScheduleData(user: CurrentUser) {
  const property = propertyWhere(user)
  const [schedules, organizations, properties, departments, departmentRoles, employees] =
    await Promise.all([
      prisma.schedule.findMany({
        where: scheduleWhere(user),
        include: {
          property: { select: { id: true, name: true } },
          organization: { select: { id: true, name: true } },
          shifts: {
            include: {
              employee: { select: { id: true, firstName: true, lastName: true } },
              department: { select: { id: true, name: true } },
              departmentRole: { select: { id: true, name: true } },
            },
            orderBy: { startTime: "asc" },
          },
        },
        orderBy: { weekStartDate: "desc" },
      }),
      prisma.organization.findMany({ where: { status: RecordStatus.ACTIVE, ...organizationWhere(user) }, select: { id: true, name: true } }),
      prisma.property.findMany({ where: { status: RecordStatus.ACTIVE, ...property }, select: { id: true, organizationId: true, name: true } }),
      prisma.department.findMany({ where: { status: RecordStatus.ACTIVE, ...departmentWhere(user) }, select: { id: true, propertyId: true, name: true } }),
      prisma.departmentRole.findMany({ where: { status: RecordStatus.ACTIVE, department: departmentWhere(user) }, select: { id: true, departmentId: true, name: true } }),
      prisma.employee.findMany({ where: { status: "ACTIVE", ...employeeWhere(user) }, select: { id: true, propertyId: true, departmentId: true, firstName: true, lastName: true } }),
    ])
  return { schedules, options: { organizations, properties, departments, departmentRoles, employees } }
}

export async function createSchedule(input: z.infer<typeof scheduleSchema>, user: CurrentUser) {
  assertProperty(user, input.organizationId, input.propertyId)
  return prisma.schedule.create({
    data: { ...input, weekStartDate: new Date(input.weekStartDate), notes: input.notes || null },
  })
}

export async function addScheduleShift(
  scheduleId: string,
  input: z.infer<typeof scheduleShiftSchema>,
  user: CurrentUser,
) {
  const schedule = await prisma.schedule.findFirst({ where: { id: scheduleId, ...scheduleWhere(user) } })
  if (!schedule) throw new Error("Schedule is outside your access.")
  if (schedule.status === ScheduleStatus.LOCKED) throw new Error("Locked schedules cannot be changed.")
  const employee = await prisma.employee.findFirst({ where: { id: input.employeeId, propertyId: schedule.propertyId } })
  if (!employee) throw new Error("Employee is not assigned to this property.")
  return prisma.shift.create({
    data: {
      scheduleId,
      organizationId: schedule.organizationId,
      propertyId: schedule.propertyId,
      employeeId: input.employeeId,
      departmentId: input.departmentId || null,
      departmentRoleId: input.departmentRoleId || null,
      position: "Scheduled shift",
      shiftDate: new Date(input.shiftDate),
      startTime: new Date(input.startTime),
      endTime: new Date(input.endTime),
      breakMinutes: input.breakMinutes,
      notes: input.notes || null,
    },
  })
}

export async function setScheduleStatus(id: string, status: ScheduleStatus, user: CurrentUser) {
  const schedule = await prisma.schedule.findFirst({ where: { id, ...scheduleWhere(user) } })
  if (!schedule) throw new Error("Schedule is outside your access.")
  return prisma.$transaction(async (tx) => {
    await tx.shift.updateMany({
      where: { scheduleId: id },
      data: { status: status === ScheduleStatus.DRAFT ? "DRAFT" : "PUBLISHED" },
    })
    return tx.schedule.update({ where: { id }, data: { status } })
  })
}

function organizationWhere(user: CurrentUser): Prisma.OrganizationWhereInput {
  return isPlatform(user) ? {} : { id: user.organizationId ?? "" }
}

function staffingCompanyWhere(user: CurrentUser): Prisma.StaffingCompanyWhereInput {
  return isPlatform(user) ? {} : { organizationId: user.organizationId ?? "" }
}

function scheduleWhere(user: CurrentUser): Prisma.ScheduleWhereInput {
  if (isPlatform(user)) return {}
  if (user.role === Role.PROPERTY_MANAGER) return { propertyId: { in: user.propertyIds ?? [] } }
  return { organizationId: user.organizationId ?? "" }
}

function propertyWhere(user: CurrentUser): Prisma.PropertyWhereInput {
  if (isPlatform(user)) return {}
  if (user.role === Role.PROPERTY_MANAGER) return { id: { in: user.propertyIds ?? [] } }
  return { organizationId: user.organizationId ?? "" }
}

function departmentWhere(user: CurrentUser): Prisma.DepartmentWhereInput {
  if (isPlatform(user)) return {}
  if (user.role === Role.PROPERTY_MANAGER) return { propertyId: { in: user.propertyIds ?? [] } }
  return { organizationId: user.organizationId ?? "" }
}

function employeeWhere(user: CurrentUser): Prisma.EmployeeWhereInput {
  if (isPlatform(user)) return {}
  if (user.role === Role.PROPERTY_MANAGER) return { propertyId: { in: user.propertyIds ?? [] } }
  return { organizationId: user.organizationId ?? "" }
}

function assertOrganization(user: CurrentUser, organizationId: string) {
  if (!isPlatform(user) && user.organizationId !== organizationId) throw new Error("Unauthorized.")
}

function assertProperty(user: CurrentUser, organizationId: string, propertyId: string) {
  assertOrganization(user, organizationId)
  if (user.role === Role.PROPERTY_MANAGER && !user.propertyIds?.includes(propertyId)) {
    throw new Error("This property is outside your access.")
  }
}

function isPlatform(user: CurrentUser) {
  return user.role === Role.PLATFORM_OWNER || user.role === Role.PLATFORM_ADMIN
}
