import { releaseFreeze } from "@/src/lib/attendance/service"
import { errorResponse } from "@/src/lib/http"

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      freezeId: string
      note?: string
      userId?: string
    }
    return Response.json({
      freeze: await releaseFreeze(body.freezeId, body.note, body.userId),
    })
  } catch (error) {
    return errorResponse(error)
  }
}
