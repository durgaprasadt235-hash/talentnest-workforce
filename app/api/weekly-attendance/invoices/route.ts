import {
  WeeklyAttendanceInvoiceStatus,
  WeeklyAttendanceInvoiceType,
} from "@prisma/client"

import { errorResponse } from "@/src/lib/http"
import { listInvoices } from "@/src/lib/invoices/service"
import { Permission } from "@/src/lib/rbac/permissions"
import { requireServerPermission } from "@/src/lib/rbac/server-guard"

export async function GET(request: Request) {
  try {
    const user = requireServerPermission(request, Permission.VIEW_INVOICES)
    const url = new URL(request.url)
    return Response.json(await listInvoices(user, {
      organizationId: value(url, "organizationId"),
      propertyId: value(url, "propertyId"),
      status: enumValue(WeeklyAttendanceInvoiceStatus, value(url, "status")),
      type: enumValue(WeeklyAttendanceInvoiceType, value(url, "type")),
      from: dateValue(value(url, "from")),
      to: dateValue(value(url, "to"), true),
      search: value(url, "search"),
    }))
  } catch (error) {
    return errorResponse(error)
  }
}

function value(url: URL, key: string) {
  return url.searchParams.get(key) || undefined
}

function enumValue<T extends Record<string, string>>(values: T, value?: string) {
  return value && Object.values(values).includes(value) ? value as T[keyof T] : undefined
}

function dateValue(value?: string, endOfDay = false) {
  if (!value) return undefined
  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`)
  return Number.isNaN(date.getTime()) ? undefined : date
}
