import { prisma } from "@/src/lib/prisma"

export async function listOrganizations() {
  return prisma.organization.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
    },
    orderBy: { name: "asc" },
  })
}

export async function listProperties() {
  return prisma.property.findMany({
    select: {
      id: true,
      name: true,
      code: true,
      city: true,
      state: true,
      status: true,
      organization: { select: { id: true, name: true } },
    },
    orderBy: { name: "asc" },
  })
}

export async function listDepartments() {
  return prisma.department.findMany({
    select: {
      id: true,
      name: true,
      code: true,
      status: true,
      property: { select: { id: true, name: true } },
    },
    orderBy: { name: "asc" },
  })
}
