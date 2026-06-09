import { clockOut } from "@/src/lib/attendance/service"
import type { ClockRequest } from "@/src/lib/attendance/types"
import { errorResponse } from "@/src/lib/http"

export async function POST(request: Request) {
  try {
    return Response.json(await clockOut((await request.json()) as ClockRequest))
  } catch (error) {
    return errorResponse(error)
  }
}
