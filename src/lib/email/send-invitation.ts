import "server-only"

import { Resend } from "resend"

export type SendInvitationInput = {
  email: string
  ownerName: string
  organizationName: string
  invitationUrl: string
  expiryDate: Date
}

export async function sendInvitation(input: SendInvitationInput) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) throw new Error("RESEND_API_KEY is not configured.")

  const expiryDate = new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "America/New_York",
  }).format(input.expiryDate)
  const text = [
    `Hello ${input.ownerName},`,
    "",
    `You have been invited as Organization Owner for ${input.organizationName}.`,
    "",
    "Click below to activate your account:",
    "",
    input.invitationUrl,
    "",
    `This invitation expires on ${expiryDate}.`,
    "",
    "TalentNest Workforce Team",
  ].join("\n")

  const resend = new Resend(apiKey)
  const { data, error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || "TalentNest Workforce <onboarding@resend.dev>",
    to: input.email,
    subject: "Welcome to TalentNest Workforce",
    text,
    html: [
      `<p>Hello ${escapeHtml(input.ownerName)},</p>`,
      `<p>You have been invited as Organization Owner for <strong>${escapeHtml(input.organizationName)}</strong>.</p>`,
      "<p>Click below to activate your account:</p>",
      `<p><a href="${escapeHtml(input.invitationUrl)}">Activate your TalentNest Workforce account</a></p>`,
      `<p>This invitation expires on ${escapeHtml(expiryDate)}.</p>`,
      "<p>TalentNest Workforce Team</p>",
    ].join(""),
  })

  if (error) throw new Error(error.message || "Email delivery failed.")
  return data
}

export function invitationUrl(token: string) {
  const appUrl = (
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3000")
  ).replace(/\/$/, "")

  return `${appUrl}/accept-invitation?token=${encodeURIComponent(token)}`
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}
