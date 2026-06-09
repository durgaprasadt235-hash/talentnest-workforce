export function errorResponse(error: unknown, status = 400) {
  const message =
    error instanceof Error ? error.message : "An unexpected error occurred."

  return Response.json({ error: message }, { status })
}
