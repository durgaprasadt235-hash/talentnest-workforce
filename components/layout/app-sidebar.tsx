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
import { Role, type Role as RoleType } from "@/src/lib/rbac/roles"

type NavItem = {
  label: string
  href: string
  icon: LucideIcon
}

const navigation: { label?: string; items: NavItem[] }[] = [
  {
    items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Organization",
    items: [
      { label: "Organizations", href: "/organizations", icon: Building2 },
      { label: "Properties", href: "/properties", icon: Hotel },
      { label: "Departments", href: "/departments", icon: UsersRound },
    ],
  },
  {
    label: "Workforce",
    items: [
      { label: "Employees", href: "/employees", icon: Users },
      { label: "Staffing Companies", href: "/staffing-companies", icon: UserCog },
    ],
  },
  {
    label: "Operations",
    items: [
      { label: "Schedules", href: "/schedules", icon: CalendarDays },
      { label: "Attendance", href: "/attendance", icon: ClipboardCheck },
      { label: "Attendance Kiosk", href: "/kiosk", icon: MonitorSmartphone },
      { label: "Weekly Attendance", href: "/weekly-attendance", icon: CalendarCheck2 },
      { label: "Timesheets", href: "/timesheets", icon: Clock3 },
    ],
  },
  {
    label: "Finance",
    items: [
      { label: "Invoices", href: "/invoices", icon: FileCheck2 },
      { label: "Payments", href: "/payments", icon: CircleDollarSign },
    ],
  },
  {
    label: "Settings",
    items: [
      { label: "Users & Access", href: "/users", icon: UserCog },
      { label: "Roles", href: "/roles", icon: ShieldCheck },
      { label: "Audit Logs", href: "/audit-logs", icon: ScrollText },
    ],
  },
]

const roleRoutes: Record<RoleType, readonly string[]> = {
  [Role.PLATFORM_OWNER]: ["/dashboard", "/organizations", "/properties", "/departments", "/employees", "/staffing-companies", "/schedules", "/attendance", "/kiosk", "/weekly-attendance", "/timesheets", "/invoices", "/payments", "/users", "/roles", "/audit-logs"],
  [Role.PLATFORM_ADMIN]: ["/dashboard", "/organizations", "/properties", "/employees", "/staffing-companies", "/kiosk", "/weekly-attendance", "/invoices", "/payments", "/users", "/audit-logs"],
  [Role.ORGANIZATION_OWNER]: ["/dashboard", "/properties", "/departments", "/employees", "/staffing-companies", "/schedules", "/attendance", "/kiosk", "/weekly-attendance", "/timesheets", "/invoices", "/payments", "/users", "/audit-logs"],
  [Role.CORPORATE_ADMIN]: ["/dashboard", "/properties", "/departments", "/employees", "/staffing-companies", "/schedules", "/kiosk", "/weekly-attendance", "/timesheets", "/invoices", "/payments", "/users", "/audit-logs"],
  [Role.PROPERTY_MANAGER]: ["/dashboard", "/employees", "/schedules", "/attendance", "/kiosk", "/weekly-attendance", "/timesheets"],
  [Role.FINANCE_USER]: ["/dashboard", "/weekly-attendance", "/invoices", "/payments"],
  [Role.STAFFING_ADMIN]: ["/dashboard", "/employees", "/weekly-attendance", "/timesheets", "/invoices", "/payments"],
  [Role.STAFFING_BILLING]: ["/dashboard", "/timesheets", "/invoices", "/payments"],
  [Role.EMPLOYEE]: ["/dashboard", "/attendance", "/schedules"],
}

export function AppSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const { currentUser } = useCurrentUser()
  const routes = roleRoutes[currentUser.role]
  const visibleNavigation = navigation
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => routes.includes(item.href)),
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
