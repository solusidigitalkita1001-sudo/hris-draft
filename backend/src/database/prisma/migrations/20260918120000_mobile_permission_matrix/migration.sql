INSERT INTO `permissions` (`id`, `resource`, `action`, `name`, `code`, `module`, `created_at`) VALUES
  (UUID(), 'work-calendar', 'create', 'Create Work Calendar', 'work-calendar:create', 'work-calendar', CURRENT_TIMESTAMP(3)),
  (UUID(), 'work-calendar', 'read', 'Read Work Calendar', 'work-calendar:read', 'work-calendar', CURRENT_TIMESTAMP(3)),
  (UUID(), 'work-calendar', 'update', 'Update Work Calendar', 'work-calendar:update', 'work-calendar', CURRENT_TIMESTAMP(3)),
  (UUID(), 'work-calendar', 'delete', 'Delete Work Calendar', 'work-calendar:delete', 'work-calendar', CURRENT_TIMESTAMP(3)),
  (UUID(), 'permission-request', 'read', 'Read Permission Requests', 'permission-request:read', 'permission-request', CURRENT_TIMESTAMP(3)),
  (UUID(), 'permission-request', 'update', 'Review Permission Requests', 'permission-request:update', 'permission-request', CURRENT_TIMESTAMP(3)),
  (UUID(), 'employee-loan', 'read', 'Read Employee Loans', 'employee-loan:read', 'employee-loan', CURRENT_TIMESTAMP(3)),
  (UUID(), 'employee-loan', 'update', 'Review Employee Loans', 'employee-loan:update', 'employee-loan', CURRENT_TIMESTAMP(3))
ON DUPLICATE KEY UPDATE `code` = VALUES(`code`);

-- Global administrators receive every new permission.
INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.`id`, p.`id`
FROM `roles` r
JOIN `permissions` p ON p.`code` IN (
  'work-calendar:create', 'work-calendar:read', 'work-calendar:update', 'work-calendar:delete',
  'permission-request:read', 'permission-request:update',
  'employee-loan:read', 'employee-loan:update'
)
WHERE r.`code` IN ('SUPER_ADMIN', 'GROUP_ADMIN');

INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.`id`, p.`id`
FROM `roles` r
JOIN `permissions` p ON p.`code` IN (
  'leave:create', 'work-calendar:create', 'work-calendar:read', 'work-calendar:update', 'work-calendar:delete',
  'permission-request:read', 'permission-request:update',
  'employee-loan:read', 'employee-loan:update'
)
WHERE r.`code` = 'COMPANY_ADMIN';

INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.`id`, p.`id`
FROM `roles` r
JOIN `permissions` p ON p.`code` IN (
  'leave:create', 'work-calendar:create', 'work-calendar:read', 'work-calendar:update',
  'permission-request:read', 'permission-request:update',
  'employee-loan:read', 'employee-loan:update'
)
WHERE r.`code` = 'HR_MANAGER';

INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.`id`, p.`id`
FROM `roles` r
JOIN `permissions` p ON p.`code` IN (
  'work-calendar:read', 'permission-request:read', 'employee-loan:read'
)
WHERE r.`code` = 'HR_STAFF';

INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.`id`, p.`id`
FROM `roles` r
JOIN `permissions` p ON p.`code` IN (
  'work-calendar:read', 'permission-request:read', 'permission-request:update',
  'employee-loan:read', 'employee-loan:update'
)
WHERE r.`code` = 'MANAGER';

INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.`id`, p.`id`
FROM `roles` r
JOIN `permissions` p ON p.`code` IN ('leave:create', 'payroll:read')
WHERE r.`code` = 'EMPLOYEE';
