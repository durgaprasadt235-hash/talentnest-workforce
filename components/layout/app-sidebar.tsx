"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  BarChart3,
  Building2,
  CalendarCheck2,
  CalendarDays,
  CircleDollarSign,
  ClipboardCheck,
  Clock3,
  CreditCard,
  FileCheck2,
  Headphones,
  Hotel,
  LayoutDashboard,
  MonitorSmartphone,
  ReceiptText,
  ScrollText,
  SearchCheck,
  Settings,
  ShieldCheck,
  UserCog,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react"

import { useCurrentUser } from "@/components/rbac/current-user-provider"
import { cn } from "@/lib/utils"
import { Role, type Role as RoleType } from "@/src/lib/rbac/roles"
import { FeatureKey, type FeatureKey as FeatureKeyType } from "@/src/lib/features/feature-keys"

type NavItem = {
  label: string
  href: string
  icon: LucideIcon
  feature?: FeatureKeyType
}

type NavSection = {
  label?: string
  items: NavItem[]
}

const item = {
  dashboard: { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  clients: { label: "Clients", href: "/clients", icon: Building2 },
  onboarding: { label: "Onboarding", href: "/onboarding", icon: ClipboardCheck },
  billing: { label: "Billing", href: "/billing", icon: ReceiptText },
  kiosks: { label: "Kiosks", href: "/kiosks", icon: MonitorSmartphone },
  support: { label: "Support", href: "/support", icon: Headphones },
  security: { label: "Security", href: "/security", icon: ShieldCheck },
  compliance: { label: "Compliance", href: "/compliance", icon: SearchCheck },
  analytics: { label: "Analytics", href: "/analytics", icon: BarChart3 },
  internalTeams: { label: "Internal Teams", href: "/internal-teams", icon: Users },
  platformSettings: { label: "Platform Settings", href: "/platform-settings", icon: Settings },
  organizations: { label: "Organizations", href: "/organizations", icon: Building2 },
  subscriptions: { label: "Subscriptions", href: "/subscriptions", icon: CreditCard },
  platformBilling: { label: "Platform Billing", href: "/platform-billing", icon: ReceiptText },
  properties: { label: "Properties", href: "/properties", icon: Hotel },
  legalEntities: { label: "Legal Entities", href: "/legal-entities", icon: Building2 },
  departments: { label: "Departments", href: "/departments", icon: UsersRound },
  employees: { label: "Employees", href: "/employees", icon: Users },
  staffingCompanies: { label: "Staffing Companies", href: "/staffing-companies", icon: UserCog, feature: FeatureKey.STAFFING },
  schedules: { label: "Schedules", href: "/schedules", icon: CalendarDays, feature: FeatureKey.SCHEDULING },
  attendance: { label: "Attendance", href: "/attendance", icon: ClipboardCheck, feature: FeatureKey.ATTENDANCE },
  kiosk: { label: "Attendance Kiosk", href: "/kiosk", icon: MonitorSmartphone, feature: FeatureKey.KIOSK },
  weeklyAttendance: { label: "Weekly Attendance", href: "/weekly-attendance", icon: CalendarCheck2, feature: FeatureKey.TIMESHEETS },
  timesheets: { label: "Timesheets", href: "/timesheets", icon: Clock3, feature: FeatureKey.TIMESHEETS },
  invoices: { label: "Invoices", href: "/invoices", icon: FileCheck2, feature: FeatureKey.INVOICES },
  payments: { label: "Payments", href: "/payments", icon: CircleDollarSign, feature: FeatureKey.PAYMENTS },
  users: { label: "Users & Access", href: "/users", icon: UserCog },
  roles: { label: "Roles", href: "/roles", icon: ShieldCheck },
  auditLogs: { label: "Audit Logs", href: "/audit-logs", icon: ScrollText },
  platformAuditLogs: { label: "Platform Audit Logs", href: "/audit-logs", icon: ScrollText },
  propertyAuditLogs: { label: "Property Audit Logs", href: "/audit-logs", icon: ScrollText },
  departmentAuditLogs: { label: "Department Audit Logs", href: "/audit-logs", icon: ScrollText },
  myActivity: { label: "My Activity", href: "/audit-logs", icon: ScrollText },
  deviceSupport: { label: "Device Support", href: "/devices", icon: MonitorSmartphone },
  kioskSetup: { label: "Kiosk Setup", href: "/devices", icon: MonitorSmartphone, feature: FeatureKey.KIOSK },
  platformAnalytics: { label: "Platform Analytics", href: "/platform-analytics", icon: BarChart3 },
} satisfies Record<string, NavItem>

const platformConsoleNavigation: NavSection[] = [
  {
    items: [
      item.dashboard,
      item.clients,
      item.onboarding,
      item.subscriptions,
      item.billing,
      item.kiosks,
      item.support,
      item.security,
      item.compliance,
      item.analytics,
      item.internalTeams,
      item.platformSettings,
      item.auditLogs,
    ],
  },
]

const platformConsoleRoles: RoleType[] = [
  Role.PLATFORM_OWNER,
  Role.PLATFORM_SUPER_ADMIN,
  Role.PLATFORM_ADMIN,
  Role.PLATFORM_OPERATIONS,
  Role.ONBOARDING_MANAGER,
  Role.IMPLEMENTATION_SPECIALIST,
  Role.CUSTOMER_SUCCESS_MANAGER,
  Role.SUPPORT_AGENT,
  Role.SUPPORT_MANAGER,
  Role.FINANCE_ADMIN,
  Role.BILLING_SPECIALIST,
  Role.COMPLIANCE_OFFICER,
  Role.SECURITY_ADMIN,
  Role.ANALYTICS_ADMIN,
  Role.READ_ONLY_AUDITOR,
]

const roleNavigation: Record<RoleType, NavSection[]> = {
  [Role.PLATFORM_OWNER]: platformConsoleNavigation,
  [Role.PLATFORM_SUPER_ADMIN]: platformConsoleNavigation,
  [Role.PLATFORM_ADMIN]: platformConsoleNavigation,
  [Role.PLATFORM_OPERATIONS]: platformConsoleNavigation,
  [Role.ONBOARDING_MANAGER]: platformConsoleNavigation,
  [Role.IMPLEMENTATION_SPECIALIST]: platformConsoleNavigation,
  [Role.CUSTOMER_SUCCESS_MANAGER]: platformConsoleNavigation,
  [Role.SUPPORT_AGENT]: platformConsoleNavigation,
  [Role.SUPPORT_MANAGER]: platformConsoleNavigation,
  [Role.BILLING_SPECIALIST]: platformConsoleNavigation,
  [Role.COMPLIANCE_OFFICER]: platformConsoleNavigation,
  [Role.SECURITY_ADMIN]: platformConsoleNavigation,
  [Role.ANALYTICS_ADMIN]: platformConsoleNavigation,
  [Role.READ_ONLY_AUDITOR]: platformConsoleNavigation,
  [Role.ORGANIZATION_OWNER]: [
    { items: [item.dashboard] },
    { label: "Organization", items: [item.legalEntities, item.properties, item.departments] },
    { label: "Workforce", items: [item.employees, item.staffingCompanies] },
    { label: "Operations", items: [item.schedules, item.attendance, item.kiosk, item.weeklyAttendance, item.timesheets] },
    { label: "Finance", items: [item.invoices, item.payments] },
    { label: "Settings", items: [item.users, item.auditLogs] },
  ],
  [Role.REGIONAL_MANAGER]: [
    { items: [item.dashboard] },
    { label: "Organization", items: [item.properties, item.departments] },
    { label: "Workforce", items: [item.employees] },
    { label: "Operations", items: [item.schedules, item.attendance, item.kiosk, item.weeklyAttendance, item.timesheets] },
  ],
  [Role.HR_OPERATIONS_ADMIN]: [
    { items: [item.dashboard] },
    { label: "Organization", items: [item.properties, item.departments] },
    { label: "Workforce", items: [item.employees] },
    { label: "Operations", items: [item.schedules, item.attendance, item.kiosk, item.weeklyAttendance, item.timesheets] },
    { label: "Settings", items: [item.users, item.auditLogs] },
  ],
  [Role.FINANCE_ADMIN]: platformConsoleNavigation,
  [Role.AUDIT_ADMIN]: [
    { items: [item.dashboard] },
    { label: "Audit", items: [item.auditLogs] },
  ],
  [Role.CORPORATE_ADMIN]: [
    { items: [item.dashboard] },
    { label: "Organization", items: [item.legalEntities, item.properties, item.departments] },
    { label: "Workforce", items: [item.employees, item.staffingCompanies] },
    { label: "Operations", items: [item.schedules, item.kiosk, item.weeklyAttendance, item.timesheets] },
    { label: "Finance", items: [item.invoices, item.payments] },
    { label: "Settings", items: [item.users, item.auditLogs] },
  ],
  [Role.PROPERTY_MANAGER]: [
    { items: [item.dashboard] },
    { label: "Workforce", items: [item.employees] },
    { label: "Operations", items: [item.schedules, item.attendance, item.kiosk, item.weeklyAttendance, item.timesheets, item.kioskSetup] },
    { label: "Settings", items: [item.propertyAuditLogs] },
  ],
  [Role.DEPARTMENT_MANAGER]: [
    { items: [item.dashboard] },
    { label: "Department", items: [item.departmentAuditLogs] },
  ],
  [Role.FINANCE_USER]: [
    { items: [item.dashboard] },
    { label: "Finance", items: [item.weeklyAttendance, item.invoices, item.payments] },
  ],
  [Role.FINANCE]: [
    { items: [item.dashboard] },
    { label: "Finance", items: [item.weeklyAttendance, item.invoices, item.payments] },
  ],
  [Role.HR]: [
    { items: [item.dashboard] },
    { label: "Workforce", items: [item.employees] },
    { label: "Settings", items: [item.users] },
  ],
  [Role.STAFFING_ADMIN]: [
    { items: [item.dashboard] },
    { label: "Workforce", items: [item.employees, item.weeklyAttendance, item.timesheets] },
    { label: "Finance", items: [item.invoices, item.payments] },
  ],
  [Role.STAFFING_OWNER]: [
    { items: [item.dashboard] },
    { label: "Workforce", items: [item.employees, item.weeklyAttendance, item.timesheets] },
    { label: "Finance", items: [item.invoices, item.payments] },
  ],
  [Role.RECRUITER]: [
    { items: [item.dashboard] },
    { label: "Workforce", items: [item.employees] },
  ],
  [Role.ACCOUNT_MANAGER]: [
    { items: [item.dashboard] },
    { label: "Workforce", items: [item.employees, item.timesheets] },
    { label: "Finance", items: [item.invoices, item.payments] },
  ],
  [Role.STAFFING_BILLING]: [
    { items: [item.dashboard] },
    { label: "Finance", items: [item.timesheets, item.invoices, item.payments] },
  ],
  [Role.EMPLOYEE]: [
    { items: [item.dashboard] },
    { label: "Workforce", items: [item.attendance, item.schedules, item.myActivity] },
  ],
  [Role.FRONT_DESK]: [{ items: [item.dashboard, item.attendance, item.schedules, item.myActivity] }],
  [Role.HOUSEKEEPING]: [{ items: [item.dashboard, item.attendance, item.schedules, item.myActivity] }],
  [Role.MAINTENANCE]: [{ items: [item.dashboard, item.attendance, item.schedules, item.myActivity] }],
  [Role.NIGHT_AUDITOR]: [{ items: [item.dashboard, item.attendance, item.schedules, item.myActivity] }],
}

export function AppSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const { currentUser } = useCurrentUser()
  const isPlatformConsole = platformConsoleRoles.includes(currentUser.role)
  const bypass = isPlatformConsole
  const navigation = roleNavigation[currentUser.role]
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (navItem) => bypass || !navItem.feature || currentUser.featureAccess?.features[navItem.feature] !== false,
      ),
    }))
    .filter((section) => section.items.length > 0)

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-white/10 px-5">
        <div className="flex size-9 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
          <Hotel className="size-5" />
        </div>
        <div>
          <p className="text-sm font-semibold tracking-tight text-white">TalentNest</p>
          <p className="text-[11px] font-medium tracking-widest text-slate-400 uppercase">Workforce</p>
        </div>
      </div>

      <nav aria-label="Main navigation" className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
        {navigation.map((section, index) => (
          <div key={section.label ?? "primary"}>
            {section.label && (
              <p className="mb-2 px-3 text-[10px] font-semibold tracking-[0.14em] text-slate-500 uppercase">
                {section.label}
              </p>
            )}
            <div className="space-y-1">
              {section.items.map((navItem) => {
                const active = pathname === navItem.href
                const Icon = navItem.icon

                return (
                  <Link
                    key={navItem.href}
                    href={navItem.href}
                    onClick={onNavigate}
                    className={cn(
                      "group flex h-9 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
                      active
                        ? "bg-sidebar-primary text-sidebar-primary-foreground"
                        : "text-slate-400 hover:bg-white/5 hover:text-white",
                    )}
                  >
                    <Icon className="size-4" />
                    <span>{navItem.label}</span>
                  </Link>
                )
              })}
            </div>
            {index === 0 && <div className="mt-5 border-t border-white/10" />}
          </div>
        ))}
      </nav>
    </div>
  )
}
