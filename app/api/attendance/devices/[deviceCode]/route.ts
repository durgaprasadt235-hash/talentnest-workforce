import { getDevice } from "@/src/lib/attendance/service"
import { errorResponse } from "@/src/lib/http"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ deviceCode: string }> },
) {
  try {
    const { deviceCode } = await params
    const device = await getDevice(deviceCode)

    if (!device) {
      return Response.json({ error: "Device not found." }, { status: 404 })
    }

    return Response.json({ device })
  } catch (error) {
    return errorResponse(error, 500)
  }
}
