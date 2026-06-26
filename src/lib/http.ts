import type { z } from "zod"

import { AuthorizationError } from "@/src/lib/rbac/errors"

export class RequestValidationError extends Error {
  constructor(public readonly issues: z.core.$ZodIssue[]) {
    super("Request body is invalid.")
  }
}

export async function parseJsonBody<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<T> {
  let body: unknown

  try {
    body = await request.json()
  } catch {
    throw new RequestValidationError([])
  }

  const result = schema.safeParse(body)
  if (!result.success) {
    throw new RequestValidationError(result.error.issues)
  }

  return result.data
}

export function errorResponse(error: unknown, status = 400) {
  if (error instanceof AuthorizationError) {
    return Response.json({ error: error.message }, { status: error.status })
  }

  if (error instanceof RequestValidationError) {
    return Response.json(
      { error: error.message, issues: error.issues },
      { status: 400 },
    )
  }

  const message =
    error instanceof Error ? error.message : "An unexpected error occurred."

  if (message.includes("Invalid `prisma.")) {
    console.error("Database operation failed", error)
    return Response.json(
      { error: "The request could not be completed. Please try again." },
      { status: 500 },
    )
  }

  return Response.json({ error: message }, { status })
}
