import { currentUser } from "@clerk/nextjs/server"
import { OrganizationInvitationStatus, RecordStatus } from "@prisma/client"

import { prisma } from "@/src/lib/prisma"
import type { CurrentUser } from "@/src/lib/rbac/current-user"
import { AuthorizationError } from "@/src/lib/rbac/errors"
import { Role, ROLES } from "@/src/lib/rbac/roles"

export async function resolveClerkCurrentUser(): Promise<CurrentUser> {
  const clerkUser = await currentUser()

  if (!clerkUser) {
    throw new AuthorizationError("Authentication required.", 401)
  }

  const email = (
    clerkUser.primaryEmailAddress?.emailAddress ??
    clerkUser.emailAddresses[0]?.emailAddress
  )?.toLowerCase()
  if (!email) {
    throw new AuthorizationError("Your Clerk account does not have an email address.")
  }

  let user = await prisma.user.findUnique({
    where: { clerkUserId: clerkUser.id },
    include: {
      organization: { select: { name: true } },
      staffingCompany: { select: { displayName: true } },
      propertyAccesses: { select: { propertyId: true } },
    },
  })

  if (!user) {
    const emailUser = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      include: {
        organization: { select: { name: true } },
        staffingCompany: { select: { displayName: true } },
        propertyAccesses: { select: { propertyId: true } },
      },
    })

    if (emailUser?.clerkUserId && emailUser.clerkUserId !== clerkUser.id) {
      throw new AuthorizationError("User is not assigned to TalentNest")
    }

    user = emailUser
      ? await prisma.user.update({
          where: { id: emailUser.id },
          data: { clerkUserId: clerkUser.id },
          include: {
            organization: { select: { name: true } },
            staffingCompany: { select: { displayName: true } },
            propertyAccesses: { select: { propertyId: true } },
          },
        })
      : null
  }

  if (!user) {
    const userCount = await prisma.user.count()

    if (userCount > 0) {
      throw new AuthorizationError("User is not assigned to TalentNest")
    }

    user = await prisma.user.create({
      data: {
        clerkUserId: clerkUser.id,
        email,
        firstName: clerkUser.firstName || "Organization",
        lastName: clerkUser.lastName || "Owner",
        role: Role.PLATFORM_OWNER,
      },
      include: {
        organization: { select: { name: true } },
        staffingCompany: { select: { displayName: true } },
        propertyAccesses: { select: { propertyId: true } },
      },
    })
  }

  if (user.status !== RecordStatus.ACTIVE) {
    throw new AuthorizationError("User is not assigned to TalentNest")
  }

  if (user.organizationId) {
    await prisma.organizationInvitation.updateMany({
      where: {
        organizationId: user.organizationId,
        email: { equals: user.email, mode: "insensitive" },
        status: OrganizationInvitationStatus.PENDING,
        expiresAt: { gte: new Date() },
      },
      data: {
        status: OrganizationInvitationStatus.ACCEPTED,
        acceptedAt: new Date(),
      },
    })
  }

  const role = ROLES.find((candidate) => candidate === user.role)
  if (!role) {
    throw new AuthorizationError("User has an invalid TalentNest role.")
  }

  const organizationProperties = user.organizationId
    ? await prisma.property.findMany({
        where: { organizationId: user.organizationId },
        select: { id: true },
      })
    : []

  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role,
    organizationId: user.organizationId ?? undefined,
    propertyIds:
      role === Role.PROPERTY_MANAGER
        ? user.propertyAccesses.map((access) => access.propertyId)
        : organizationProperties.map((property) => property.id),
    staffingCompanyId: user.staffingCompanyId ?? undefined,
    companyName:
      role === Role.PLATFORM_OWNER || role === Role.PLATFORM_ADMIN
        ? "TalentNest Technologies"
        : user.staffingCompany?.displayName ?? user.organization?.name ?? undefined,
  }
}
