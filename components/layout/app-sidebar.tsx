"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Building2,
  CalendarDays,
  CalendarCheck2,
  CircleDollarSign,
  ClipboardCheck,
  Clock3,
  FileCheck2,
  Hotel,
  LayoutDashboard,
  MonitorSmartphone,
  ScrollText,
  ShieldCheck,
  UserCog,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react"

import { useCurrentUser } from "@/components/rbac/current-user-provider"
import { cn } from "@/lib/utils"
import { hasPermission } from "@/src/lib/rbac/guards"
import {
  Permission,
  type Permission as PermissionType,
} from "@/src/lib/rbac/permissions"

type NavItem = {
  label: string
  href: string
  icon: LucideIcon
  permission?: PermissionType
}

const navigation: { label?: string; items: NavItem[] }[] = [
  {
    items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Organization",
    items: [
      { label: "Organizations", href: "/organizations", icon: Building2, permission: Permission.VIEW_ORGANIZATION },
      { label: "Properties", href: "/properties", icon: Hotel, permission: Permission.VIEW_PROPERTIES },
      { label: "Departments", href: "/departments", icon: UsersRound, permission: Permission.VIEW_DEPARTMENTS },
    ],
  },
  {
    label: "Workforce",
    items: [
      { label: "Employees", href: "/employees", icon: Users, permission: Permission.VIEW_EMPLOYEES },
      {
        label: "Staffing Companies",
        href: "/staffing-companies",
        icon: UserCog,
        permission: Permission.VIEW_STAFFING_COMPANIES,
      },
    ],
  },
  {
    label: "Operations",
    items: [
      { label: "Schedules", href: "/schedules", icon: CalendarDays, permission: Permission.VIEW_SCHEDULES },
      { label: "Attendance", href: "/attendance", icon: ClipboardCheck, permission: Permission.VIEW_ATTENDANCE },
      { label: "Attendance Kiosk", href: "/kiosk", icon: MonitorSmartphone, permission: Permission.VIEW_ATTENDANCE },
      { label: "Attendance Admin", href: "/attendance/admin", icon: ShieldCheck, permission: Permission.APPROVE_ATTENDANCE },
      { label: "Weekly Attendance", href: "/weekly-attendance", icon: CalendarCheck2, permission: Permission.VIEW_WEEKLY_ATTENDANCE },
      { label: "Timesheets", href: "/timesheets", icon: Clock3, permission: Permission.VIEW_TIMESHEETS },
    ],
  },
  {
    label: "Finance",
    items: [
      { label: "Invoices", href: "/invoices", icon: FileCheck2, permission: Permission.VIEW_INVOICES },
      { label: "Payments", href: "/payments", icon: CircleDollarSign, permission: Permission.VIEW_PAYMENTS },
    ],
  },
  {
    label: "Administration",
    items: [
      { label: "Device Management", href: "/devices", icon: MonitorSmartphone, permission: Permission.MANAGE_PROPERTIES },
      { label: "Users", href: "/users", icon: UserCog, permission: Permission.VIEW_USERS },
      { label: "Roles", href: "/roles", icon: ShieldCheck, permission: Permission.VIEW_USERS },
      { label: "Audit Logs", href: "/audit-logs", icon: ScrollText, permission: Permission.VIEW_AUDIT_LOGS },
    ],
  },
]

export function AppSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const { currentUser } = useCurrentUser()
  const visibleNavigation = navigation
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) =>
          !item.permission || hasPermission(currentUser, item.permission),
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
          <p className="text-sm font-semibold tracking-tight text-white">
            TalentNest
          </p>
          <p className="text-[11px] font-medium tracking-widest text-slate-400 uppercase">
            Workforce
          </p>
        </div>
      </div>

      <nav aria-label="Main navigation" className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
        {visibleNavigation.map((section, index) => (
          <div key={section.label ?? "primary"}>
            {section.label && (
              <p className="mb-2 px-3 text-[10px] font-semibold tracking-[0.14em] text-slate-500 uppercase">
                {section.label}
              </p>
            )}
            <div className="space-y-1">
              {section.items.map((item) => {
                const active = pathname === item.href
                const Icon = item.icon

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      "group flex h-9 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
                      active
                        ? "bg-sidebar-primary text-sidebar-primary-foreground"
                        : "text-slate-400 hover:bg-white/5 hover:text-white",
                    )}
                  >
                    <Icon className="size-4" />
                    <span>{item.label}</span>
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
