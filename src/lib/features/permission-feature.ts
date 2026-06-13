import { FeatureKey, type FeatureKey as FeatureKeyType } from "@/src/lib/features/feature-keys"
import { Permission, type Permission as PermissionType } from "@/src/lib/rbac/permissions"

const permissionFeatures: Partial<Record<PermissionType, FeatureKeyType>> = {
  [Permission.VIEW_SCHEDULES]: FeatureKey.SCHEDULING,
  [Permission.MANAGE_SCHEDULES]: FeatureKey.SCHEDULING,
  [Permission.VIEW_ATTENDANCE]: FeatureKey.ATTENDANCE,
  [Permission.MANAGE_ATTENDANCE]: FeatureKey.ATTENDANCE,
  [Permission.APPROVE_ATTENDANCE]: FeatureKey.ATTENDANCE,
  [Permission.VIEW_DEVICES]: FeatureKey.KIOSK,
  [Permission.MANAGE_DEVICES]: FeatureKey.KIOSK,
  [Permission.VIEW_WEEKLY_ATTENDANCE]: FeatureKey.TIMESHEETS,
  [Permission.GENERATE_WEEKLY_ATTENDANCE]: FeatureKey.TIMESHEETS,
  [Permission.APPROVE_WEEKLY_ATTENDANCE]: FeatureKey.TIMESHEETS,
  [Permission.LOCK_WEEKLY_ATTENDANCE]: FeatureKey.TIMESHEETS,
  [Permission.MANAGE_CORPORATE_WEEKLY_ATTENDANCE]: FeatureKey.TIMESHEETS,
  [Permission.SEND_WEEKLY_ATTENDANCE_TO_CORPORATE]: FeatureKey.TIMESHEETS,
  [Permission.SEND_WEEKLY_ATTENDANCE_TO_FINANCE]: FeatureKey.TIMESHEETS,
  [Permission.MANAGE_WEEKLY_ATTENDANCE_PAYABLES]: FeatureKey.INVOICES,
  [Permission.VIEW_TIMESHEETS]: FeatureKey.TIMESHEETS,
  [Permission.APPROVE_TIMESHEETS]: FeatureKey.TIMESHEETS,
  [Permission.VIEW_INVOICES]: FeatureKey.INVOICES,
  [Permission.MANAGE_INVOICES]: FeatureKey.INVOICES,
  [Permission.APPROVE_INVOICES]: FeatureKey.INVOICES,
  [Permission.VIEW_PAYMENTS]: FeatureKey.PAYMENTS,
  [Permission.APPROVE_PAYMENTS]: FeatureKey.PAYMENTS,
  [Permission.VIEW_STAFFING_COMPANIES]: FeatureKey.STAFFING,
  [Permission.MANAGE_STAFFING_COMPANIES]: FeatureKey.STAFFING,
}

export function featureForPermission(permission: PermissionType) {
  return permissionFeatures[permission]
}
