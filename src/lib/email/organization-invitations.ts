import "server-only"

import { Resend } from "resend"

type InvitationEmailInput = {
  email: string
  firstName: string
  organizationName: string
  token: string
}

export type InvitationEmailResult = {
  sent: boolean
  message: string
}

export function isInvitationEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL)
}

export async function sendOrganizationInvitationEmail(
  input: InvitationEmailInput,
): Promise<InvitationEmailResult> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL

  if (!apiKey || !from) {
    return {
      sent: false,
      message: "Invitation email delivery is not configured.",
    }
  }

  const inviteUrl = `${getAppUrl()}/accept-invitation?token=${encodeURIComponent(input.token)}`
  const resend = new Resend(apiKey)
  const { error } = await resend.emails.send({
    from,
    to: input.email,
    subject: `You are invited to ${input.organizationName} on TalentNest Workforce`,
    text: [
      `Hello ${input.firstName},`,
      "",
      `You have been invited to manage ${input.organizationName} in TalentNest Workforce.`,
      `Accept your invitation: ${inviteUrl}`,
      "",
      "This invitation expires in 7 days.",
    ].join("\n"),
    html: [
      `<p>Hello ${escapeHtml(input.firstName)},</p>`,
      `<p>You have been invited to manage <strong>${escapeHtml(input.organizationName)}</strong> in TalentNest Workforce.</p>`,
      `<p><a href="${inviteUrl}">Accept invitation</a></p>`,
      "<p>This invitation expires in 7 days.</p>",
    ].join(""),
  })

  if (error) {
    return {
      sent: false,
      message: error.message || "Invitation email could not be sent.",
    }
  }

  return { sent: true, message: "Invitation sent." }
}

function getAppUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.replace(/^/, "https://") ??
    "http://localhost:3000"
  ).replace(/\/$/, "")
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}
