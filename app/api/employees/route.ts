import { createEmployee, listEmployees } from "@/src/lib/employees/service"
import { createEmployeeSchema } from "@/src/lib/employees/validation"
import { errorResponse, parseJsonBody } from "@/src/lib/http"
import { Permission } from "@/src/lib/rbac/permissions"
import { requireServerPermission } from "@/src/lib/rbac/server-guard"
import { EmployeeStatus } from "@prisma/client"

export async function GET(request: Request) {
  try {
    requireServerPermission(request, Permission.VIEW_EMPLOYEES)
    const requestedStatus = new URL(request.url).searchParams.get("status")
    const status =
      requestedStatus === "ALL"
        ? "ALL"
        : Object.values(EmployeeStatus).find((value) => value === requestedStatus) ??
          EmployeeStatus.ACTIVE
    return Response.json(await listEmployees(status))
  } catch (error) {
    return errorResponse(error, 500)
  }
}

export async function POST(request: Request) {
  try {
    requireServerPermission(request, Permission.MANAGE_EMPLOYEES)
    const input = await parseJsonBody(request, createEmployeeSchema)
    return Response.json({ employee: await createEmployee(input) }, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}
