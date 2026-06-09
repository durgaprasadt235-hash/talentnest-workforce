import { resolveException } from "@/src/lib/attendance/service"
import type { ExceptionActionRequest } from "@/src/lib/attendance/types"
import { errorResponse } from "@/src/lib/http"

export async function POST(request: Request) {
  try {
    return Response.json({
      exception: await resolveException(
        (await request.json()) as ExceptionActionRequest,
      ),
    })
  } catch (error) {
    return errorResponse(error)
  }
}
