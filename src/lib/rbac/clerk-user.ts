import { currentUser } from "@clerk/nextjs/server"
import { RecordStatus } from "@prisma/client"

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
  })

  if (!user) {
    const emailUser = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
    })

    if (emailUser?.clerkUserId && emailUser.clerkUserId !== clerkUser.id) {
      throw new AuthorizationError("User is not assigned to TalentNest")
    }

    user = emailUser
      ? await prisma.user.update({
          where: { id: emailUser.id },
          data: { clerkUserId: clerkUser.id },
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
        role: Role.ORGANIZATION_OWNER,
      },
    })
  }

  if (user.status !== RecordStatus.ACTIVE) {
    throw new AuthorizationError("User is not assigned to TalentNest")
  }

  const role = ROLES.find((candidate) => candidate === user.role)
  if (!role) {
    throw new AuthorizationError("User has an invalid TalentNest role.")
  }

  const properties = user.organizationId
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
    propertyIds: properties.map((property) => property.id),
    staffingCompanyId: undefined,
  }
}
