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
  Hotel,
  LayoutDashboard,
  MonitorSmartphone,
  ReceiptText,
  ScrollText,
  ShieldCheck,
  UserCog,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react"

import { useCurrentUser } from "@/components/rbac/current-user-provider"
import { cn } from "@/lib/utils"
import { Role, type Role as RoleType } from "@/src/lib/rbac/roles"

type NavItem = {
  label: string
  href: string
  icon: LucideIcon
}

type NavSection = {
  label?: string
  items: NavItem[]
}

const item = {
  dashboard: { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  organizations: { label: "Organizations", href: "/organizations", icon: Building2 },
  subscriptions: { label: "Subscriptions", href: "/subscriptions", icon: CreditCard },
  platformBilling: { label: "Platform Billing", href: "/platform-billing", icon: ReceiptText },
  properties: { label: "Properties", href: "/properties", icon: Hotel },
  departments: { label: "Departments", href: "/departments", icon: UsersRound },
  employees: { label: "Employees", href: "/employees", icon: Users },
  staffingCompanies: { label: "Staffing Companies", href: "/staffing-companies", icon: UserCog },
  schedules: { label: "Schedules", href: "/schedules", icon: CalendarDays },
  attendance: { label: "Attendance", href: "/attendance", icon: ClipboardCheck },
  kiosk: { label: "Attendance Kiosk", href: "/kiosk", icon: MonitorSmartphone },
  weeklyAttendance: { label: "Weekly Attendance", href: "/weekly-attendance", icon: CalendarCheck2 },
  timesheets: { label: "Timesheets", href: "/timesheets", icon: Clock3 },
  invoices: { label: "Invoices", href: "/invoices", icon: FileCheck2 },
  payments: { label: "Payments", href: "/payments", icon: CircleDollarSign },
  users: { label: "Users & Access", href: "/users", icon: UserCog },
  roles: { label: "Roles", href: "/roles", icon: ShieldCheck },
  auditLogs: { label: "Audit Logs", href: "/audit-logs", icon: ScrollText },
  deviceSupport: { label: "Device Support", href: "/devices", icon: MonitorSmartphone },
  platformAnalytics: { label: "Platform Analytics", href: "/platform-analytics", icon: BarChart3 },
} satisfies Record<string, NavItem>

const roleNavigation: Record<RoleType, NavSection[]> = {
  [Role.PLATFORM_OWNER]: [
    { items: [item.dashboard] },
    { label: "Platform", items: [item.organizations, item.subscriptions, item.platformBilling, item.platformAnalytics] },
    { label: "Administration", items: [item.users, item.roles, item.auditLogs, item.deviceSupport] },
  ],
  [Role.PLATFORM_ADMIN]: [
    { items: [item.dashboard] },
    { label: "Organization", items: [item.organizations, item.properties] },
    { label: "Workforce", items: [item.employees, item.staffingCompanies] },
    { label: "Operations", items: [item.kiosk, item.weeklyAttendance] },
    { label: "Finance", items: [item.invoices, item.payments] },
    { label: "Settings", items: [item.users, item.auditLogs] },
  ],
  [Role.ORGANIZATION_OWNER]: [
    { items: [item.dashboard] },
    { label: "Organization", items: [item.properties, item.departments] },
    { label: "Workforce", items: [item.employees, item.staffingCompanies] },
    { label: "Operations", items: [item.schedules, item.attendance, item.kiosk, item.weeklyAttendance, item.timesheets] },
    { label: "Finance", items: [item.invoices, item.payments] },
    { label: "Settings", items: [item.users, item.auditLogs] },
  ],
  [Role.CORPORATE_ADMIN]: [
    { items: [item.dashboard] },
    { label: "Organization", items: [item.properties, item.departments] },
    { label: "Workforce", items: [item.employees, item.staffingCompanies] },
    { label: "Operations", items: [item.schedules, item.kiosk, item.weeklyAttendance, item.timesheets] },
    { label: "Finance", items: [item.invoices, item.payments] },
    { label: "Settings", items: [item.users, item.auditLogs] },
  ],
  [Role.PROPERTY_MANAGER]: [
    { items: [item.dashboard] },
    { label: "Workforce", items: [item.employees] },
    { label: "Operations", items: [item.schedules, item.attendance, item.kiosk, item.weeklyAttendance, item.timesheets] },
  ],
  [Role.FINANCE_USER]: [
    { items: [item.dashboard] },
    { label: "Finance", items: [item.weeklyAttendance, item.invoices, item.payments] },
  ],
  [Role.STAFFING_ADMIN]: [
    { items: [item.dashboard] },
    { label: "Workforce", items: [item.employees, item.weeklyAttendance, item.timesheets] },
    { label: "Finance", items: [item.invoices, item.payments] },
  ],
  [Role.STAFFING_BILLING]: [
    { items: [item.dashboard] },
    { label: "Finance", items: [item.timesheets, item.invoices, item.payments] },
  ],
  [Role.EMPLOYEE]: [
    { items: [item.dashboard] },
    { label: "Workforce", items: [item.attendance, item.schedules] },
  ],
}

export function AppSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const { currentUser } = useCurrentUser()
  const navigation = roleNavigation[currentUser.role]

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
