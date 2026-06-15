import { randomBytes } from "node:crypto"

import { clerkClient } from "@clerk/nextjs/server"
import { hash } from "bcryptjs"
import {
  OrganizationInvitationStatus,
  OrganizationStatus,
  OrganizationSubscriptionStatus,
  RecordStatus,
  SubscriptionBillingCycle,
} from "@prisma/client"

import { createAuditLog } from "@/src/lib/audit"
import { invitationUrl, sendInvitation } from "@/src/lib/email/send-invitation"
import type { OrganizationFeatureOverrideInput, OrganizationOnboardingInput, OnboardingSubscriptionOption } from "@/src/lib/organizations/validation"
import { prisma } from "@/src/lib/prisma"
import type { CurrentUser } from "@/src/lib/rbac/current-user"
import { AuthorizationError } from "@/src/lib/rbac/errors"
import { Role } from "@/src/lib/rbac/roles"

const subscriptionOptions: Record<OnboardingSubscriptionOption, {
  planKey: string
  planName: string
  billingCycle: SubscriptionBillingCycle
  status: OrganizationSubscriptionStatus
}> = {
  "trial-30": {
    planKey: "trial",
    planName: "Trial",
    billingCycle: SubscriptionBillingCycle.TRIAL,
    status: OrganizationSubscriptionStatus.TRIAL,
  },
  "starter-monthly": {
    planKey: "starter",
    planName: "Starter",
    billingCycle: SubscriptionBillingCycle.MONTHLY,
    status: OrganizationSubscriptionStatus.PENDING,
  },
  "starter-annual": {
    planKey: "starter",
    planName: "Starter",
    billingCycle: SubscriptionBillingCycle.ANNUAL,
    status: OrganizationSubscriptionStatus.PENDING,
  },
  "growth-monthly": {
    planKey: "growth",
    planName: "Growth",
    billingCycle: SubscriptionBillingCycle.MONTHLY,
    status: OrganizationSubscriptionStatus.PENDING,
  },
  "growth-annual": {
    planKey: "growth",
    planName: "Growth",
    billingCycle: SubscriptionBillingCycle.ANNUAL,
    status: OrganizationSubscriptionStatus.PENDING,
  },
  "enterprise-manual": {
    planKey: "enterprise",
    planName: "Enterprise",
    billingCycle: SubscriptionBillingCycle.MANUAL,
    status: OrganizationSubscriptionStatus.PENDING,
  },
}

export async function onboardOrganization(input: OrganizationOnboardingInput, actor: CurrentUser) {
  assertPlatformActor(actor)

  const existing = await prisma.user.findFirst({
    where: { email: { equals: input.owner.email, mode: "insensitive" } },
    select: { id: true },
  })
  if (existing) throw new Error("A TalentNest user with the owner email already exists.")

  const subscription = subscriptionOptions[input.subscriptionOption]
  const now = new Date()
  const trialEndsAt =
    subscription.billingCycle === SubscriptionBillingCycle.TRIAL
      ? addDays(now, 30)
      : null
  const invitationToken = randomBytes(32).toString("hex")
  const settings = await prisma.systemSetting.upsert({
    where: { id: "system" },
    create: { id: "system", enableInvitations: false },
    update: {},
  })
  const client = await clerkClient()
  const clerkUser = await client.users.createUser({
    emailAddress: [input.owner.email],
    password: input.owner.temporaryPassword,
    firstName: input.owner.firstName,
    lastName: input.owner.lastName,
  })
  const temporaryPassword = await hash(input.owner.temporaryPassword, 12)

  let result
  try {
    result = await prisma.$transaction(async (tx) => {
    const organization = await tx.organization.create({
      data: {
        ...normalizeOrganization(input.organization),
        organizationStatus: OrganizationStatus.ONBOARDING,
        status: RecordStatus.ACTIVE,
        subscription: {
          create: {
            ...subscription,
            trialEndsAt,
            startedAt: subscription.status === OrganizationSubscriptionStatus.TRIAL ? now : null,
          },
        },
        featureOverride: { create: normalizeFeatures(input.features) },
      },
    })

    const owner = await tx.user.create({
      data: {
        organizationId: organization.id,
        clerkUserId: clerkUser.id,
        email: input.owner.email,
        firstName: input.owner.firstName,
        lastName: input.owner.lastName,
        role: Role.ORGANIZATION_OWNER,
        status: RecordStatus.ACTIVE,
        temporaryPassword,
        mustChangePassword: true,
      },
    })

    const invitation = settings.enableInvitations ? await tx.organizationInvitation.create({
      data: {
        organizationId: organization.id,
        email: input.owner.email,
        firstName: input.owner.firstName,
        lastName: input.owner.lastName,
        role: Role.ORGANIZATION_OWNER,
        status: OrganizationInvitationStatus.PENDING,
        token: invitationToken,
        expiresAt: addDays(now, 7),
      },
    }) : null

    return { organization, owner, invitation }
    })
  } catch (error) {
    await client.users.deleteUser(clerkUser.id).catch(() => undefined)
    throw error
  }

  await createAuditLog({
    action: "ONBOARD_ORGANIZATION",
    entityType: "Organization",
    entityId: result.organization.id,
    organizationId: result.organization.id,
    userId: actor.id,
    metadata: {
      subscriptionOption: input.subscriptionOption,
      invitationId: result.invitation?.id,
      ownerUserId: result.owner.id,
    },
  })

  const emailDelivery = result.invitation
    ? await deliverInvitation(result.invitation, result.organization.name)
    : {
        sent: false,
        status: null,
        message: "Direct login account created. No invitation email required.",
      }

  return {
    organizationId: result.organization.id,
    organizationName: result.organization.name,
    ownerEmail: result.owner.email,
    invitationStatus: emailDelivery.status,
    emailSent: emailDelivery.sent,
    emailMessage: emailDelivery.message,
    expiresAt: result.invitation?.expiresAt ?? null,
  }
}

export async function getInvitationByToken(token: string) {
  const invitation = await prisma.organizationInvitation.findUnique({
    where: { token },
    select: {
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      status: true,
      invitedAt: true,
      expiresAt: true,
      organization: { select: { name: true, legalBusinessName: true } },
    },
  })
  if (!invitation) throw new Error("Invitation not found.")

  const status =
    (
      invitation.status === OrganizationInvitationStatus.PENDING ||
      invitation.status === OrganizationInvitationStatus.SENT
    ) &&
    invitation.expiresAt.getTime() < Date.now()
      ? OrganizationInvitationStatus.EXPIRED
      : invitation.status

  if (status === OrganizationInvitationStatus.EXPIRED && invitation.status !== status) {
    await prisma.organizationInvitation.update({
      where: { token },
      data: { status },
    })
  }

  return { ...invitation, status }
}

export async function acceptInvitationByToken(token: string, actor: CurrentUser) {
  if (!actor.email || !actor.organizationId) {
    throw new AuthorizationError("This Clerk account is not assigned to the invitation.")
  }

  const invitation = await prisma.organizationInvitation.findUnique({
    where: { token },
    include: { organization: { select: { id: true, name: true } } },
  })
  if (!invitation) throw new Error("Invitation not found.")
  if (invitation.expiresAt.getTime() < Date.now()) {
    if (
      invitation.status === OrganizationInvitationStatus.PENDING ||
      invitation.status === OrganizationInvitationStatus.SENT
    ) {
      await prisma.organizationInvitation.update({
        where: { id: invitation.id },
        data: { status: OrganizationInvitationStatus.EXPIRED },
      })
    }
    throw new AuthorizationError("This invitation has expired.")
  }
  if (
    invitation.organizationId !== actor.organizationId ||
    invitation.email.toLowerCase() !== actor.email.toLowerCase()
  ) {
    throw new AuthorizationError("This Clerk account does not match the invitation.")
  }
  if (
    invitation.status !== OrganizationInvitationStatus.PENDING &&
    invitation.status !== OrganizationInvitationStatus.SENT &&
    invitation.status !== OrganizationInvitationStatus.ACCEPTED
  ) {
    throw new AuthorizationError("This invitation can no longer be accepted.")
  }

  const accepted =
    invitation.status === OrganizationInvitationStatus.ACCEPTED
      ? invitation
      : await prisma.organizationInvitation.update({
          where: { id: invitation.id },
          data: {
            status: OrganizationInvitationStatus.ACCEPTED,
            acceptedAt: new Date(),
          },
          include: { organization: { select: { id: true, name: true } } },
        })

  return {
    status: accepted.status,
    organization: accepted.organization,
  }
}

export async function resendOrganizationInvitation(
  organizationId: string,
  invitationId: string,
  actor: CurrentUser,
) {
  assertPlatformOwner(actor)
  const invitation = await prisma.organizationInvitation.findFirst({
    where: { id: invitationId, organizationId },
    include: { organization: { select: { name: true } } },
  })
  if (!invitation) throw new Error("Invitation not found.")
  if (invitation.status === OrganizationInvitationStatus.ACCEPTED) {
    throw new Error("Accepted invitations cannot be resent.")
  }
  if (invitation.status === OrganizationInvitationStatus.CANCELLED) {
    throw new Error("Cancelled invitations cannot be resent.")
  }

  const token = randomBytes(32).toString("hex")
  const updated = await prisma.organizationInvitation.update({
    where: { id: invitation.id },
    data: {
      token,
      status: OrganizationInvitationStatus.PENDING,
      invitedAt: new Date(),
      sentAt: null,
      lastError: null,
      expiresAt: addDays(new Date(), 7),
      acceptedAt: null,
    },
  })
  const emailDelivery = await deliverInvitation(updated, invitation.organization.name)

  await createAuditLog({
    action: "RESEND_ORGANIZATION_INVITATION",
    entityType: "OrganizationInvitation",
    entityId: updated.id,
    organizationId,
    userId: actor.id,
    metadata: { emailSent: emailDelivery.sent, status: emailDelivery.status },
  })

  return {
    invitationStatus: emailDelivery.status,
    expiresAt: updated.expiresAt,
    sentAt: emailDelivery.sentAt,
    lastError: emailDelivery.lastError,
    emailSent: emailDelivery.sent,
    emailMessage: emailDelivery.message,
  }
}

async function deliverInvitation(
  invitation: {
    id: string
    email: string
    firstName: string
    lastName: string
    token: string
    expiresAt: Date
  },
  organizationName: string,
) {
  try {
    await sendInvitation({
      email: invitation.email,
      ownerName: `${invitation.firstName} ${invitation.lastName}`.trim(),
      organizationName,
      invitationUrl: invitationUrl(invitation.token),
      expiryDate: invitation.expiresAt,
    })
    const sentAt = new Date()
    await prisma.organizationInvitation.update({
      where: { id: invitation.id },
      data: {
        status: OrganizationInvitationStatus.SENT,
        sentAt,
        lastError: null,
      },
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
    await prisma.organizationInvitation.update({
      where: { id: invitation.id },
      data: {
        status: OrganizationInvitationStatus.PENDING,
        sentAt: null,
        lastError,
      },
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

export async function updateOrganizationFeatureOverride(
  organizationId: string,
  input: OrganizationFeatureOverrideInput,
  actor: CurrentUser,
) {
  assertPlatformActor(actor)
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true },
  })
  if (!organization) throw new Error("Organization not found.")

  const featureOverride = await prisma.organizationFeatureOverride.upsert({
    where: { organizationId },
    create: { organizationId, ...normalizeFeatures(input) },
    update: normalizeFeatures(input),
  })
  await createAuditLog({
    action: "UPDATE_ORGANIZATION_FEATURE_ACCESS",
    entityType: "OrganizationFeatureOverride",
    entityId: featureOverride.id,
    organizationId,
    userId: actor.id,
    metadata: { features: normalizeFeatures(input) },
  })
  return featureOverride
}

function assertPlatformActor(actor: CurrentUser) {
  if (actor.role !== Role.PLATFORM_OWNER && actor.role !== Role.PLATFORM_ADMIN) {
    throw new AuthorizationError("Only platform administrators can onboard organizations.")
  }
}

function assertPlatformOwner(actor: CurrentUser) {
  if (actor.role !== Role.PLATFORM_OWNER) {
    throw new AuthorizationError("Only the platform owner can resend invitations.")
  }
}

function normalizeOrganization(input: OrganizationOnboardingInput["organization"]) {
  return {
    ...input,
    contactPhone: input.contactPhone || null,
    billingAddress: input.billingAddress || null,
    billingCity: input.billingCity || null,
    billingState: input.billingState || null,
    billingZip: input.billingZip || null,
  }
}

function normalizeFeatures(input: OrganizationOnboardingInput["features"]) {
  return { ...input, reason: input.reason || null }
}

function addDays(value: Date, days: number) {
  return new Date(value.getTime() + days * 24 * 60 * 60 * 1000)
}
