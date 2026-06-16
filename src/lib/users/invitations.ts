import { randomBytes } from "node:crypto"

import { OrganizationInvitationStatus } from "@prisma/client"

import { createAuditLog } from "@/src/lib/audit"
import { invitationUrl, sendInvitation } from "@/src/lib/email/send-invitation"
import { prisma } from "@/src/lib/prisma"
import type { CurrentUser } from "@/src/lib/rbac/current-user"
import { AuthorizationError } from "@/src/lib/rbac/errors"
import { Role, type Role as RoleType } from "@/src/lib/rbac/roles"
import type { InvitationInput } from "@/src/lib/users/validation"

const platformRoles: RoleType[] = [Role.PLATFORM_OWNER, Role.PLATFORM_ADMIN, Role.PLATFORM_OPERATIONS]
const organizationOwnerInviteRoles: RoleType[] = [
  Role.HR_OPERATIONS_ADMIN,
  Role.FINANCE_ADMIN,
  Role.AUDIT_ADMIN,
  Role.REGIONAL_MANAGER,
  Role.PROPERTY_MANAGER,
]
const hrOperationsInviteRoles: RoleType[] = [
  ...organizationOwnerInviteRoles,
  Role.EMPLOYEE,
]

export async function listUserInvitations(actor: CurrentUser) {
  const where =
    actor.role === Role.PLATFORM_OWNER || actor.role === Role.PLATFORM_ADMIN || actor.role === Role.PLATFORM_OPERATIONS
      ? {}
      : actor.organizationId
        ? { organizationId: actor.organizationId }
        : null

  if (!where) throw new AuthorizationError("You do not have permission to view invitations.")

  return prisma.userInvitation.findMany({
    where,
    include: {
      organization: { select: { id: true, name: true } },
      department: { select: { id: true, name: true } },
      staffingCompany: { select: { id: true, displayName: true } },
      invitedBy: { select: { id: true, firstName: true, lastName: true, role: true } },
    },
    orderBy: { invitedAt: "desc" },
  })
}

export async function inviteUser(input: InvitationInput, actor: CurrentUser) {
  assertCanInviteRole(actor, input.role)

  const organizationId = platformRoles.includes(input.role)
    ? null
    : actor.organizationId ?? input.organizationId ?? null
  if (!platformRoles.includes(input.role) && !organizationId) {
    throw new Error("Organization is required for this invitation.")
  }

  if (organizationId && actor.organizationId && actor.organizationId !== organizationId) {
    throw new AuthorizationError("You cannot invite users outside your organization.")
  }

  const existingUser = await prisma.user.findFirst({
    where: { email: { equals: input.email, mode: "insensitive" } },
    select: { id: true },
  })
  if (existingUser) throw new Error("A TalentNest user already exists with this email.")

  const now = new Date()
  const invitation = await prisma.userInvitation.create({
    data: {
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      role: input.role,
      organizationId,
      departmentId: input.departmentId ?? null,
      staffingCompanyId: input.staffingCompanyId ?? null,
      token: randomBytes(32).toString("hex"),
      invitedByUserId: actor.id,
      expiresAt: addDays(now, 7),
    },
  })

  const delivery = await deliverUserInvitation(invitation)
  await auditInvitation("USER_INVITED", invitation.id, actor, organizationId, {
    emailSent: delivery.sent,
    role: input.role,
  })

  return { invitation: { ...invitation, status: delivery.status, sentAt: delivery.sentAt, lastError: delivery.lastError }, delivery }
}

export async function resendUserInvitation(id: string, actor: CurrentUser) {
  const invitation = await getScopedInvitation(id, actor)
  if (invitation.status === OrganizationInvitationStatus.ACCEPTED) throw new Error("Accepted invitations cannot be resent.")
  if (invitation.status === OrganizationInvitationStatus.CANCELLED) throw new Error("Revoked invitations cannot be resent.")

  const updated = await prisma.userInvitation.update({
    where: { id },
    data: {
      token: randomBytes(32).toString("hex"),
      status: OrganizationInvitationStatus.PENDING,
      invitedAt: new Date(),
      sentAt: null,
      lastError: null,
      acceptedAt: null,
      expiresAt: addDays(new Date(), 7),
    },
  })
  const delivery = await deliverUserInvitation(updated)
  await auditInvitation("INVITATION_RESENT", id, actor, updated.organizationId, {
    emailSent: delivery.sent,
  })
  return { invitation: { ...updated, status: delivery.status, sentAt: delivery.sentAt, lastError: delivery.lastError }, delivery }
}

export async function revokeUserInvitation(id: string, actor: CurrentUser) {
  const invitation = await getScopedInvitation(id, actor)
  if (invitation.status === OrganizationInvitationStatus.ACCEPTED) throw new Error("Accepted invitations cannot be revoked.")
  const updated = await prisma.userInvitation.update({
    where: { id },
    data: { status: OrganizationInvitationStatus.CANCELLED },
  })
  await auditInvitation("INVITATION_REVOKED", id, actor, updated.organizationId)
  return updated
}

export async function expireUserInvitation(id: string, actor: CurrentUser) {
  const invitation = await getScopedInvitation(id, actor)
  if (invitation.status === OrganizationInvitationStatus.ACCEPTED) throw new Error("Accepted invitations cannot be expired.")
  const updated = await prisma.userInvitation.update({
    where: { id },
    data: { status: OrganizationInvitationStatus.EXPIRED, expiresAt: new Date() },
  })
  await auditInvitation("INVITATION_EXPIRED", id, actor, updated.organizationId)
  return updated
}

export async function acceptUserInvitationByToken(token: string, actor: CurrentUser) {
  const invitation = await prisma.userInvitation.findUnique({ where: { token } })
  if (!invitation) throw new Error("Invitation not found.")
  if (!actor.email || actor.email.toLowerCase() !== invitation.email.toLowerCase()) {
    throw new AuthorizationError("This Clerk account does not match the invitation.")
  }
  if (invitation.expiresAt.getTime() < Date.now()) {
    await prisma.userInvitation.update({
      where: { id: invitation.id },
      data: { status: OrganizationInvitationStatus.EXPIRED },
    })
    throw new AuthorizationError("This invitation has expired.")
  }
  if (
    invitation.status !== OrganizationInvitationStatus.PENDING &&
    invitation.status !== OrganizationInvitationStatus.SENT &&
    invitation.status !== OrganizationInvitationStatus.ACCEPTED
  ) {
    throw new AuthorizationError("This invitation can no longer be accepted.")
  }

  const updated = invitation.status === OrganizationInvitationStatus.ACCEPTED
    ? invitation
    : await prisma.userInvitation.update({
        where: { id: invitation.id },
        data: { status: OrganizationInvitationStatus.ACCEPTED, acceptedAt: new Date() },
      })
  await auditInvitation("INVITATION_ACCEPTED", updated.id, actor, updated.organizationId)
  return updated
}

function assertCanInviteRole(actor: CurrentUser, role: RoleType) {
  if (actor.role === Role.PLATFORM_OWNER) {
    if (role === Role.ORGANIZATION_OWNER || role === Role.PLATFORM_OPERATIONS) return
  }
  if (actor.role === Role.ORGANIZATION_OWNER) {
    if (organizationOwnerInviteRoles.includes(role)) return
  }
  if (actor.role === Role.HR_OPERATIONS_ADMIN) {
    if (hrOperationsInviteRoles.includes(role)) return
  }
  throw new AuthorizationError("You do not have permission to invite this role.")
}

async function getScopedInvitation(id: string, actor: CurrentUser) {
  const invitation = await prisma.userInvitation.findUnique({ where: { id } })
  if (!invitation) throw new Error("Invitation not found.")
  if (actor.role === Role.PLATFORM_OWNER || actor.role === Role.PLATFORM_ADMIN || actor.role === Role.PLATFORM_OPERATIONS) return invitation
  if (actor.organizationId && actor.organizationId === invitation.organizationId) return invitation
  throw new AuthorizationError("You do not have permission to manage this invitation.")
}

async function deliverUserInvitation(invitation: {
  id: string
  email: string
  firstName: string
  lastName: string
  token: string
  expiresAt: Date
}) {
  try {
    await sendInvitation({
      email: invitation.email,
      ownerName: `${invitation.firstName} ${invitation.lastName}`.trim(),
      organizationName: "TalentNest Workforce",
      invitationUrl: invitationUrl(invitation.token),
      expiryDate: invitation.expiresAt,
    })
    const sentAt = new Date()
    await prisma.userInvitation.update({
      where: { id: invitation.id },
      data: { status: OrganizationInvitationStatus.SENT, sentAt, lastError: null },
    })
    return {
      sent: true,
      status: OrganizationInvitationStatus.SENT,
      sentAt,
      lastError: null,
      message: "Invitation email sent successfully.",
    }
  } catch (error) {
    const lastError = error instanceof Error ? error.message : "Email delivery failed."
    await prisma.userInvitation.update({
      where: { id: invitation.id },
      data: { status: OrganizationInvitationStatus.PENDING, sentAt: null, lastError },
    })
    return {
      sent: false,
      status: OrganizationInvitationStatus.PENDING,
      sentAt: null,
      lastError,
      message: "Email delivery failed. Check Resend configuration.",
    }
  }
}

function auditInvitation(
  action: string,
  invitationId: string,
  actor: CurrentUser,
  organizationId: string | null,
  metadata?: Record<string, unknown>,
) {
  return createAuditLog({
    action,
    entityType: "UserInvitation",
    entityId: invitationId,
    userId: actor.id,
    organizationId: organizationId ?? actor.organizationId,
    metadata,
  })
}

function addDays(value: Date, days: number) {
  return new Date(value.getTime() + days * 24 * 60 * 60 * 1000)
}
