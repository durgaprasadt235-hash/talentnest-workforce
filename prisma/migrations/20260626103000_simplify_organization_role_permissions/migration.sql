-- Refresh role permission rows for simplified small-business organization roles.
DELETE FROM "role_permissions"
WHERE "role" IN (
  'ORGANIZATION_OWNER',
  'CORPORATE_ADMIN',
  'HR_OPERATIONS_ADMIN',
  'FINANCE_ADMIN',
  'PROPERTY_MANAGER'
);
