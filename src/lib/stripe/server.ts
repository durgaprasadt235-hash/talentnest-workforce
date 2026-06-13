import "server-only"

import Stripe from "stripe"

export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null

export function requireStripe() {
  if (!stripe) throw new Error("Stripe is not configured.")
  return stripe
}

export function isStripeConfigured() {
  return Boolean(
    stripe &&
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY &&
      process.env.STRIPE_WEBHOOK_SECRET &&
      process.env.STRIPE_PRICE_STARTER_MONTHLY &&
      process.env.STRIPE_PRICE_STARTER_ANNUAL &&
      process.env.STRIPE_PRICE_GROWTH_MONTHLY &&
      process.env.STRIPE_PRICE_GROWTH_ANNUAL &&
      process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY &&
      process.env.STRIPE_PRICE_ENTERPRISE_ANNUAL,
  )
}
