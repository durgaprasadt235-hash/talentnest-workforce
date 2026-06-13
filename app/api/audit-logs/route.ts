import { NextRequest } from "next/server"
import { prisma } from "@/src/lib/prisma"
import { requireServerPermission } from "@/src/lib/rbac/server-guard"
import { Permission } from "@/src/lib/rbac/permissions"
import { errorResponse } from "@/src/lib/http"

export async function GET(request: NextRequest) {
  try {
    await requireServerPermission(request as unknown as Request, Permission.VIEW_AUDIT_LOGS)

    const url = new URL(request.url)
    const q = url.searchParams

    const where: any = {}

    if (q.get("organizationId")) where.organizationId = q.get("organizationId")
    if (q.get("propertyId")) where.propertyId = q.get("propertyId")
    if (q.get("action")) where.action = q.get("action")
    if (q.get("entityType")) where.entityType = q.get("entityType")

    const dateFrom = q.get("dateFrom")
    const dateTo = q.get("dateTo")
    if (dateFrom || dateTo) {
      where.createdAt = {}
      if (dateFrom) where.createdAt.gte = new Date(dateFrom)
      if (dateTo) where.createdAt.lte = new Date(dateTo)
    }

    const logs = await prisma.auditLog.findMany({
      where,
      include: { organization: true, property: true, user: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    })

    // optional server-side employee filter
    const employeeId = q.get("employeeId")
    const filtered = employeeId ? logs.filter((l) => {
      if (l.entityType === "Employee" && l.entityId === employeeId) return true
      if (l.metadata && typeof l.metadata === "object" && (l.metadata as any).employeeId === employeeId) return true
      return false
    }) : logs

    return Response.json(filtered)
  } catch (err) {
    return errorResponse(err, 500)
  }
}
