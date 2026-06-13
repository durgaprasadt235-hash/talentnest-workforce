import { prisma } from "@/src/lib/prisma"
import { resolveClerkCurrentUser } from "@/src/lib/rbac/clerk-user"
import { AuthorizationError } from "@/src/lib/rbac/errors"
import { Role, type Role as RoleType } from "@/src/lib/rbac/roles"
import { getStripePriceId } from "@/src/lib/stripe/plans"
import { isStripeConfigured, requireStripe } from "@/src/lib/stripe/server"
import { checkoutSessionSchema } from "@/src/lib/stripe/validation"
import { errorResponse, parseJsonBody } from "@/src/lib/http"

const checkoutRoles: RoleType[] = [
  Role.PLATFORM_OWNER,
  Role.PLATFORM_ADMIN,
  Role.ORGANIZATION_OWNER,
]

export async function POST(request: Request) {
  try {
    const user = await resolveClerkCurrentUser()
    if (!checkoutRoles.includes(user.role)) {
      throw new AuthorizationError("You do not have permission to create a checkout session.")
    }

    const input = await parseJsonBody(request, checkoutSessionSchema)
    if (
      user.role === Role.ORGANIZATION_OWNER &&
      user.organizationId !== input.organizationId
    ) {
      throw new AuthorizationError("You cannot create checkout for another organization.")
    }

    const organization = await prisma.organization.findUnique({
      where: { id: input.organizationId },
      select: { id: true },
    })
    if (!organization) throw new Error("Organization not found.")

    if (!isStripeConfigured()) {
      return Response.json({ error: "Stripe is not configured." }, { status: 500 })
    }

    const priceId = getStripePriceId(input.planKey, input.billingCycle)
    if (!priceId) {
      return Response.json({ error: "Stripe is not configured." }, { status: 500 })
    }

    const stripe = requireStripe()
    const origin = new URL(request.url).origin
    const metadata = {
      organizationId: input.organizationId,
      planKey: input.planKey,
      billingCycle: input.billingCycle,
    }
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      metadata,
      subscription_data: { metadata },
      success_url: `${origin}/platform-billing?checkout=success`,
      cancel_url: `${origin}/platform-billing?checkout=cancelled`,
    })

    return Response.json({ url: session.url })
  } catch (error) {
    if (error instanceof Error && error.message === "Stripe is not configured.") {
      return Response.json({ error: error.message }, { status: 500 })
    }
    return errorResponse(error)
  }
}
