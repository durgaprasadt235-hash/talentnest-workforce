import { clockOut } from "@/src/lib/attendance/service"
import { clockRequestSchema } from "@/src/lib/attendance/validation"
import { errorResponse, parseJsonBody } from "@/src/lib/http"

export async function POST(request: Request) {
  try {
    return Response.json(await clockOut(await parseJsonBody(request, clockRequestSchema)))
  } catch (error) {
    return errorResponse(error)
  }
}
