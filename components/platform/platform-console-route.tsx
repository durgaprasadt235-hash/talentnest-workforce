"use client"

import { PlatformAdminPage } from "@/components/platform/platform-admin-page"
import { Permission } from "@/src/lib/rbac/permissions"

type ModuleKey =
  | "dashboard"
  | "clients"
  | "onboarding"
  | "subscriptions"
  | "billing"
  | "kiosks"
  | "support"
  | "security"
  | "compliance"
  | "analytics"
  | "internalTeams"
  | "platformSettings"
  | "auditLogs"

type ModuleConfig = Parameters<typeof PlatformAdminPage>[0]

const clientColumns = [
  { key: "name", label: "Client Name" },
  { key: "contact", label: "Primary Contact" },
  { key: "plan", label: "Plan" },
  { key: "status", label: "Status" },
  { key: "locations", label: "Locations" },
  { key: "users", label: "Users" },
  { key: "kiosks", label: "Kiosks" },
  { key: "mrr", label: "MRR" },
  { key: "created", label: "Created Date" },
  { key: "manager", label: "Account Manager" },
]

const clientRows = [
  {
    id: "client-rbac-validation",
    name: "RBAC Validation Hotel Group",
    contact: "Test HR Operations",
    plan: "Enterprise",
    status: "Trial",
    locations: "2",
    users: "7",
    kiosks: "0",
    mrr: "$0",
    created: "Jun 16, 2026",
    manager: "Customer Success",
  },
]

const modules: Record<ModuleKey, ModuleConfig> = {
  dashboard: {
    title: "Platform Dashboard",
    eyebrow: "TalentNest Platform Admin Console",
    description: "Monitor SaaS clients, subscriptions, kiosk health, onboarding, support, security, and revenue from the TalentNest internal console.",
    requiredPermission: Permission.VIEW_PLATFORM_DASHBOARD,
    metrics: [
      { label: "Total Clients", value: "1", detail: "All tenants", href: "/clients" },
      { label: "Active Clients", value: "0", detail: "Live subscriptions", href: "/clients?status=active" },
      { label: "Trial Clients", value: "1", detail: "Evaluation tenants", href: "/clients?status=trial" },
      { label: "Suspended Clients", value: "0", detail: "Restricted access", href: "/clients?status=suspended" },
      { label: "Monthly Recurring Revenue", value: "$0", detail: "Test data excluded", href: "/billing" },
      { label: "Open Support Tickets", value: "3", detail: "Mock queue", href: "/support" },
      { label: "Offline Kiosks", value: "0", detail: "Last 24 hours", href: "/kiosks" },
      { label: "Pending Onboarding", value: "1", detail: "Implementation projects", href: "/onboarding" },
      { label: "Failed Payments", value: "0", detail: "Needs billing review", href: "/billing" },
      { label: "Security Alerts", value: "0", detail: "No active incidents", href: "/security" },
    ],
    columns: clientColumns,
    rows: clientRows,
    rowActions: [{ label: "View", action: "PLATFORM_CLIENT_VIEWED" }],
    emptyState: "No platform dashboard records found.",
  },
  clients: {
    title: "Clients",
    eyebrow: "Tenant Management",
    description: "Manage client organizations as SaaS tenants. This module manages client accounts, not their employee schedules, attendance approvals, or payroll.",
    requiredPermission: Permission.VIEW_PLATFORM_CLIENTS,
    tabs: ["All Clients", "Active Clients", "Trial Clients", "Suspended Clients", "Archived Clients"],
    columns: clientColumns,
    rows: clientRows,
    primaryActions: [
      { label: "Create Client", action: "PLATFORM_CLIENT_CREATE_STARTED" },
      { label: "Import Clients", action: "PLATFORM_CLIENT_IMPORT_STARTED", variant: "outline" },
    ],
    rowActions: [
      { label: "View", action: "PLATFORM_CLIENT_VIEWED" },
      { label: "Edit", action: "PLATFORM_CLIENT_EDIT_STARTED" },
      { label: "Suspend", action: "PLATFORM_CLIENT_SUSPEND_REQUESTED", critical: true, variant: "destructive" },
      { label: "Reactivate", action: "PLATFORM_CLIENT_REACTIVATE_REQUESTED" },
      { label: "Archive", action: "PLATFORM_CLIENT_ARCHIVE_REQUESTED", critical: true, variant: "outline" },
    ],
    emptyState: "No clients match the selected filters.",
  },
  onboarding: {
    title: "Onboarding",
    eyebrow: "Client Implementation",
    description: "Track client setup projects, training, kiosk readiness, documents, and go-live approvals.",
    requiredPermission: Permission.VIEW_PLATFORM_ONBOARDING,
    tabs: ["Dashboard", "Implementation Projects", "Go-Live Checklist", "Client Training", "Kiosk Setup", "Documents"],
    columns: [
      { key: "client", label: "Client" },
      { key: "status", label: "Status" },
      { key: "specialist", label: "Specialist" },
      { key: "checklist", label: "Checklist" },
      { key: "goLive", label: "Target Go-Live" },
    ],
    rows: [{ id: "onboard-rbac", client: "RBAC Validation Hotel Group", status: "In Progress", specialist: "Implementation", checklist: "3 / 9", goLive: "Not scheduled" }],
    primaryActions: [{ label: "Start Onboarding", action: "PLATFORM_ONBOARDING_STARTED" }],
    rowActions: [
      { label: "Assign Specialist", action: "PLATFORM_ONBOARDING_SPECIALIST_ASSIGNED" },
      { label: "Mark Step Complete", action: "PLATFORM_ONBOARDING_STEP_COMPLETED" },
      { label: "Approve Go-Live", action: "PLATFORM_ONBOARDING_GOLIVE_APPROVED", critical: true },
      { label: "Mark Blocked", action: "PLATFORM_ONBOARDING_BLOCKED", critical: true, variant: "outline" },
    ],
    emptyState: "No onboarding projects found.",
  },
  subscriptions: {
    title: "Subscriptions",
    eyebrow: "Plan Management",
    description: "Define SaaS plans, module entitlements, support levels, prices, billing cycles, and client assignments.",
    requiredPermission: Permission.VIEW_PLATFORM_SUBSCRIPTIONS,
    tabs: ["Starter", "Professional", "Enterprise", "Custom"],
    columns: [
      { key: "plan", label: "Plan" },
      { key: "users", label: "Max Users" },
      { key: "locations", label: "Max Locations" },
      { key: "kiosks", label: "Max Kiosks" },
      { key: "support", label: "Support Level" },
      { key: "price", label: "Price" },
      { key: "cycle", label: "Billing Cycle" },
    ],
    rows: [
      { id: "starter", plan: "Starter", users: "50", locations: "2", kiosks: "2", support: "Standard", price: "$299", cycle: "Monthly" },
      { id: "enterprise", plan: "Enterprise", users: "Unlimited", locations: "Unlimited", kiosks: "Unlimited", support: "Priority", price: "Custom", cycle: "Annual" },
    ],
    primaryActions: [{ label: "Create Plan", action: "PLATFORM_PLAN_CREATE_STARTED" }],
    rowActions: [
      { label: "Edit Plan", action: "PLATFORM_PLAN_EDIT_STARTED" },
      { label: "Duplicate", action: "PLATFORM_PLAN_DUPLICATED" },
      { label: "Deactivate", action: "PLATFORM_PLAN_DEACTIVATE_REQUESTED", critical: true, variant: "outline" },
    ],
    emptyState: "No subscription plans found.",
  },
  billing: {
    title: "Billing",
    eyebrow: "Platform Finance",
    description: "Manage SaaS subscription invoices, payments, failed payments, refunds, credits, and revenue reports. This is not client employee payroll.",
    requiredPermission: Permission.VIEW_PLATFORM_BILLING,
    tabs: ["Invoices", "Payments", "Failed Payments", "Refunds", "Credits", "Revenue Reports"],
    columns: [
      { key: "invoice", label: "Invoice" },
      { key: "client", label: "Client" },
      { key: "status", label: "Status" },
      { key: "amount", label: "Amount" },
      { key: "due", label: "Due" },
    ],
    rows: [{ id: "inv-platform-sample", invoice: "TN-SaaS-0001", client: "RBAC Validation Hotel Group", status: "Draft", amount: "$0", due: "Not issued" }],
    primaryActions: [{ label: "Generate Invoice", action: "PLATFORM_INVOICE_GENERATED" }],
    rowActions: [
      { label: "Send Invoice", action: "PLATFORM_INVOICE_SENT" },
      { label: "Record Payment", action: "PLATFORM_PAYMENT_RECORDED" },
      { label: "Issue Refund", action: "PLATFORM_REFUND_REQUESTED", critical: true, variant: "outline" },
    ],
    emptyState: "No SaaS billing records found.",
  },
  kiosks: {
    title: "Kiosks",
    eyebrow: "Device Framework",
    description: "Manage kiosk registration framework, activation codes, device policies, and device health. Daily employee clock-in operations remain inside the client portal.",
    requiredPermission: Permission.VIEW_PLATFORM_KIOSKS,
    tabs: ["Device Dashboard", "Registered Devices", "Pending Registration", "Offline Devices", "Activation Codes", "Device Policies"],
    columns: [
      { key: "client", label: "Client" },
      { key: "location", label: "Location" },
      { key: "device", label: "Device Name" },
      { key: "type", label: "Device Type" },
      { key: "status", label: "Status" },
      { key: "lastSeen", label: "Last Seen" },
      { key: "registeredBy", label: "Registered By" },
      { key: "activation", label: "Activation Date" },
    ],
    rows: [],
    primaryActions: [{ label: "Generate Activation Code", action: "PLATFORM_KIOSK_ACTIVATION_CODE_GENERATED" }],
    rowActions: [
      { label: "Revoke", action: "PLATFORM_KIOSK_REVOKE_REQUESTED", critical: true, variant: "destructive" },
      { label: "View Logs", action: "PLATFORM_KIOSK_LOGS_VIEWED" },
    ],
    emptyState: "No registered kiosk devices yet.",
  },
  support: {
    title: "Support",
    eyebrow: "Customer Support",
    description: "Handle client support tickets, escalations, SLA queues, and knowledge base workflows.",
    requiredPermission: Permission.VIEW_PLATFORM_SUPPORT,
    tabs: ["All Tickets", "New", "Assigned", "Escalated", "Resolved", "Knowledge Base"],
    columns: [
      { key: "ticket", label: "Ticket" },
      { key: "client", label: "Client" },
      { key: "category", label: "Category" },
      { key: "status", label: "Status" },
      { key: "owner", label: "Owner" },
      { key: "sla", label: "SLA" },
    ],
    rows: [
      { id: "ticket-1", ticket: "SUP-1001", client: "RBAC Validation Hotel Group", category: "Training Request", status: "New", owner: "Unassigned", sla: "24h" },
      { id: "ticket-2", ticket: "SUP-1002", client: "RBAC Validation Hotel Group", category: "Configuration Issue", status: "Assigned", owner: "Support", sla: "8h" },
    ],
    primaryActions: [{ label: "Create Ticket", action: "PLATFORM_SUPPORT_TICKET_CREATED" }],
    rowActions: [
      { label: "Assign", action: "PLATFORM_SUPPORT_TICKET_ASSIGNED" },
      { label: "Escalate", action: "PLATFORM_SUPPORT_TICKET_ESCALATED", critical: true },
      { label: "Resolve", action: "PLATFORM_SUPPORT_TICKET_RESOLVED" },
    ],
    emptyState: "No support tickets found.",
  },
  security: {
    title: "Security",
    eyebrow: "Platform Security",
    description: "Review login activity, MFA posture, sessions, suspicious activity, API keys, and security incidents.",
    requiredPermission: Permission.VIEW_PLATFORM_SECURITY,
    tabs: ["Login Activity", "MFA Management", "Role Permissions", "Suspicious Activity", "API Keys", "Security Incidents"],
    columns: [
      { key: "event", label: "Event" },
      { key: "scope", label: "Scope" },
      { key: "status", label: "Status" },
      { key: "severity", label: "Severity" },
      { key: "date", label: "Date" },
    ],
    rows: [{ id: "sec-1", event: "MFA coverage review", scope: "Platform users", status: "Open", severity: "Medium", date: "Today" }],
    primaryActions: [{ label: "Create Incident", action: "PLATFORM_SECURITY_INCIDENT_CREATED" }],
    rowActions: [
      { label: "Force MFA", action: "PLATFORM_SECURITY_MFA_FORCED", critical: true },
      { label: "Revoke Session", action: "PLATFORM_SECURITY_SESSION_REVOKED", critical: true, variant: "outline" },
      { label: "Resolve", action: "PLATFORM_SECURITY_INCIDENT_RESOLVED" },
    ],
    emptyState: "No security events found.",
  },
  compliance: {
    title: "Compliance",
    eyebrow: "Governance",
    description: "Manage access reviews, data retention policies, compliance reports, export requests, and platform audit evidence.",
    requiredPermission: Permission.VIEW_PLATFORM_COMPLIANCE,
    tabs: ["Audit Logs", "Access Reviews", "Data Retention", "Compliance Reports", "Export Requests"],
    columns: [
      { key: "review", label: "Review" },
      { key: "owner", label: "Owner" },
      { key: "status", label: "Status" },
      { key: "due", label: "Due" },
    ],
    rows: [{ id: "comp-1", review: "Quarterly platform access review", owner: "Compliance", status: "Not Started", due: "TBD" }],
    primaryActions: [{ label: "Run Access Review", action: "PLATFORM_ACCESS_REVIEW_STARTED" }],
    rowActions: [
      { label: "Generate Report", action: "PLATFORM_COMPLIANCE_REPORT_GENERATED" },
      { label: "Approve Export", action: "PLATFORM_DATA_EXPORT_APPROVED", critical: true },
    ],
    emptyState: "No compliance records found.",
  },
  analytics: {
    title: "Analytics",
    eyebrow: "Platform Insights",
    description: "Analyze revenue, usage, kiosk uptime, support operations, retention, and feature adoption across clients.",
    requiredPermission: Permission.VIEW_PLATFORM_ANALYTICS,
    tabs: ["Executive Analytics", "Revenue Analytics", "Usage Analytics", "Kiosk Analytics", "Support Analytics", "Retention Analytics"],
    columns: [
      { key: "report", label: "Report" },
      { key: "metric", label: "Metric" },
      { key: "value", label: "Value" },
      { key: "period", label: "Period" },
    ],
    rows: [
      { id: "mrr", report: "Monthly Recurring Revenue", metric: "MRR", value: "$0", period: "Current" },
      { id: "uptime", report: "Kiosk Uptime", metric: "Uptime", value: "100%", period: "Last 24h" },
    ],
    primaryActions: [{ label: "Export Report", action: "PLATFORM_ANALYTICS_REPORT_EXPORTED", variant: "outline" }],
    emptyState: "No analytics data found.",
  },
  internalTeams: {
    title: "Internal Teams",
    eyebrow: "TalentNest Team Administration",
    description: "Manage TalentNest internal team members, departments, roles, permissions, and activity.",
    requiredPermission: Permission.VIEW_PLATFORM_INTERNAL_TEAMS,
    tabs: ["Team Members", "Departments", "Roles", "Permissions", "Activity"],
    columns: [
      { key: "department", label: "Department" },
      { key: "purpose", label: "Purpose" },
      { key: "members", label: "Members" },
      { key: "lead", label: "Lead" },
    ],
    rows: [
      { id: "exec", department: "Executive", purpose: "Ownership and strategy", members: "1", lead: "Platform Owner" },
      { id: "support", department: "Technical Support", purpose: "Customer support", members: "0", lead: "Support Manager" },
      { id: "security", department: "Compliance & Security", purpose: "Security and compliance", members: "0", lead: "Security Admin" },
    ],
    primaryActions: [{ label: "Add Team Member", action: "PLATFORM_TEAM_MEMBER_ADD_STARTED" }],
    rowActions: [
      { label: "Assign Role", action: "PLATFORM_TEAM_ROLE_ASSIGNED" },
      { label: "Deactivate", action: "PLATFORM_TEAM_MEMBER_DEACTIVATE_REQUESTED", critical: true, variant: "outline" },
    ],
    emptyState: "No internal team members found.",
  },
  platformSettings: {
    title: "Platform Settings",
    eyebrow: "Platform Configuration",
    description: "Configure platform-wide settings, feature flags, notification templates, billing settings, kiosk policies, security policies, and integrations.",
    requiredPermission: Permission.VIEW_PLATFORM_SETTINGS,
    tabs: ["General Settings", "Feature Flags", "Notification Templates", "Billing Settings", "Kiosk Policies", "Security Policies", "Integrations"],
    columns: [
      { key: "setting", label: "Setting" },
      { key: "status", label: "Status" },
      { key: "scope", label: "Scope" },
      { key: "updated", label: "Updated" },
    ],
    rows: [
      { id: "scheduling", setting: "Enable Scheduling Module", status: "Enabled", scope: "Client entitlement", updated: "Today" },
      { id: "payroll-export", setting: "Enable Payroll Export", status: "Configurable", scope: "Client entitlement", updated: "Today" },
      { id: "kiosk-mode", setting: "Enable Kiosk Mode", status: "Enabled", scope: "Client entitlement", updated: "Today" },
    ],
    primaryActions: [{ label: "Create Feature Flag", action: "PLATFORM_FEATURE_FLAG_CREATED" }],
    rowActions: [
      { label: "Edit", action: "PLATFORM_SETTING_EDIT_STARTED" },
      { label: "Disable", action: "PLATFORM_SETTING_DISABLE_REQUESTED", critical: true, variant: "outline" },
    ],
    emptyState: "No platform settings found.",
  },
  auditLogs: {
    title: "Audit Logs",
    eyebrow: "Platform Audit",
    description: "Review platform-wide audit logs for client management, onboarding, billing, security, compliance, and internal-team actions.",
    requiredPermission: Permission.VIEW_PLATFORM_AUDIT_LOGS,
    tabs: ["All Activity", "Client Actions", "Billing Actions", "Security Actions", "Compliance Actions"],
    columns: [
      { key: "action", label: "Action" },
      { key: "actor", label: "Actor" },
      { key: "entity", label: "Entity" },
      { key: "date", label: "Date" },
    ],
    rows: [{ id: "audit-1", action: "PLATFORM_CLIENT_VIEWED", actor: "Platform user", entity: "Clients", date: "Today" }],
    primaryActions: [{ label: "Export Audit Logs", action: "PLATFORM_AUDIT_LOGS_EXPORTED", variant: "outline" }],
    emptyState: "No audit logs found.",
  },
}

export function PlatformConsoleRoute({ moduleKey }: { moduleKey: ModuleKey }) {
  return <PlatformAdminPage {...modules[moduleKey]} />
}
