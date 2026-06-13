import { randomBytes } from "node:crypto"

import {
  OrganizationInvitationStatus,
  OrganizationStatus,
  OrganizationSubscriptionStatus,
  RecordStatus,
  SubscriptionBillingCycle,
} from "@prisma/client"

import { createAuditLog } from "@/src/lib/audit"
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

  const result = await prisma.$transaction(async (tx) => {
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
        email: input.owner.email,
        firstName: input.owner.firstName,
        lastName: input.owner.lastName,
        role: Role.ORGANIZATION_OWNER,
        status: RecordStatus.ACTIVE,
      },
    })

    const invitation = await tx.organizationInvitation.create({
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
    })

    return { organization, owner, invitation }
  })

  await createAuditLog({
    action: "ONBOARD_ORGANIZATION",
    entityType: "Organization",
    entityId: result.organization.id,
    organizationId: result.organization.id,
    userId: actor.id,
    metadata: {
      subscriptionOption: input.subscriptionOption,
      invitationId: result.invitation.id,
      ownerUserId: result.owner.id,
    },
  })

  // TODO: Send this invitation through the configured email provider.
  return {
    organizationId: result.organization.id,
    organizationName: result.organization.name,
    ownerEmail: result.owner.email,
    invitationStatus: result.invitation.status,
    inviteLink: `/accept-invitation?token=${result.invitation.token}`,
    expiresAt: result.invitation.expiresAt,
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
    invitation.status === OrganizationInvitationStatus.PENDING &&
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
