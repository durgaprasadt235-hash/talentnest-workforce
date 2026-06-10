import { verifyKioskEmployee } from "@/src/lib/attendance/service"
import { kioskEmployeeVerificationSchema } from "@/src/lib/attendance/validation"
import { errorResponse, parseJsonBody } from "@/src/lib/http"

export async function POST(request: Request) {
  try {
    const input = await parseJsonBody(request, kioskEmployeeVerificationSchema)
    return Response.json(await verifyKioskEmployee(input))
  } catch (error) {
    return errorResponse(error)
  }
}
