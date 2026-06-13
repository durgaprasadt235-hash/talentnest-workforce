import type Stripe from "stripe"

import { createAuditLog } from "@/src/lib/audit"
import { stripe } from "@/src/lib/stripe/server"

const supportedEvents = new Set<Stripe.Event.Type>([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.payment_succeeded",
  "invoice.payment_failed",
])

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!stripe || !webhookSecret) {
    return Response.json({ error: "Stripe is not configured." }, { status: 500 })
  }

  const signature = request.headers.get("stripe-signature")
  if (!signature) {
    return Response.json({ error: "Invalid Stripe signature." }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(
      await request.text(),
      signature,
      webhookSecret,
    )
  } catch {
    return Response.json({ error: "Invalid Stripe signature." }, { status: 400 })
  }

  if (supportedEvents.has(event.type)) {
    const object = event.data.object
    const metadata = "metadata" in object ? object.metadata : null
    const stripeObjectId =
      "id" in object && typeof object.id === "string" ? object.id : undefined

    await createAuditLog({
      action: `STRIPE_${event.type.replaceAll(".", "_").toUpperCase()}`,
      entityType: "StripeEvent",
      entityId: event.id,
      metadata: {
        stripeEventType: event.type,
        stripeObjectId: stripeObjectId ?? null,
        organizationId: metadata?.organizationId ?? null,
        planKey: metadata?.planKey ?? null,
        billingCycle: metadata?.billingCycle ?? null,
      },
    })

    // TODO: Update CustomerSubscription when organization subscription tables exist.
  }

  return Response.json({ received: true })
}
