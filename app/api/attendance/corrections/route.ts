import { createAttendanceCorrectionRequest } from "@/src/lib/attendance/service"
import { attendanceCorrectionRequestSchema } from "@/src/lib/attendance/validation"
import { errorResponse, parseJsonBody } from "@/src/lib/http"

export async function POST(request: Request) {
  try {
    const input = await parseJsonBody(request, attendanceCorrectionRequestSchema)
    return Response.json({
      correction: await createAttendanceCorrectionRequest(input),
      message: "Correction request submitted.",
    })
  } catch (error) {
    return errorResponse(error)
  }
}
