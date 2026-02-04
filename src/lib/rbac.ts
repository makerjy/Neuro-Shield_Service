// Role-Based Access Control (RBAC) System for Neuro-Shield

export type Role = 'citizen' | 'counselor' | 'center_manager' | 'regional_manager' | 'central_admin';

export type Permission = 
  // Appointment permissions
  | 'appointments:view'
  | 'appointments:create'
  | 'appointments:approve'
  | 'appointments:cancel'
  
  // Consultation permissions
  | 'consultations:view'
  | 'consultations:create'
  | 'consultations:edit'
  | 'consultations:delete'
  
  // Citizen permissions
  | 'citizens:view'
  | 'citizens:create'
  | 'citizens:edit'
  | 'citizens:delete'
  | 'citizens:view_sensitive'
  
  // Report permissions
  | 'reports:view'
  | 'reports:create'
  | 'reports:export'
  
  // User management permissions
  | 'users:view'
  | 'users:create'
  | 'users:edit'
  | 'users:delete'
  
  // Settings permissions
  | 'settings:view'
  | 'settings:edit'
  
  // Audit log permissions
  | 'audit:view'
  | 'audit:export';

// Role-Permission Matrix
const rolePermissions: Record<Role, Permission[]> = {
  citizen: [],
  
  counselor: [
    'appointments:view',
    'appointments:create',
    'appointments:approve',
    'appointments:cancel',
    'consultations:view',
    'consultations:create',
    'consultations:edit',
    'citizens:view',
    'citizens:create',
    'citizens:edit',
    'citizens:view_sensitive',
  ],
  
  center_manager: [
    'appointments:view',
    'appointments:create',
    'appointments:approve',
    'appointments:cancel',
    'consultations:view',
    'consultations:create',
    'consultations:edit',
    'consultations:delete',
    'citizens:view',
    'citizens:create',
    'citizens:edit',
    'citizens:delete',
    'citizens:view_sensitive',
    'reports:view',
    'reports:create',
    'reports:export',
    'users:view',
    'users:create',
    'users:edit',
    'settings:view',
    'settings:edit',
    'audit:view',
  ],
  
  regional_manager: [
    'appointments:view',
    'consultations:view',
    'citizens:view',
    'reports:view',
    'reports:create',
    'reports:export',
    'users:view',
    'settings:view',
    'audit:view',
    'audit:export',
  ],
  
  central_admin: [
    'appointments:view',
    'appointments:create',
    'appointments:approve',
    'appointments:cancel',
    'consultations:view',
    'consultations:create',
    'consultations:edit',
    'consultations:delete',
    'citizens:view',
    'citizens:create',
    'citizens:edit',
    'citizens:delete',
    'citizens:view_sensitive',
    'reports:view',
    'reports:create',
    'reports:export',
    'users:view',
    'users:create',
    'users:edit',
    'users:delete',
    'settings:view',
    'settings:edit',
    'audit:view',
    'audit:export',
  ],
};

// Check if a role has a specific permission
export function hasPermission(role: Role, permission: Permission): boolean {
  return rolePermissions[role]?.includes(permission) ?? false;
}

// Check if a role has any of the specified permissions
export function hasAnyPermission(role: Role, permissions: Permission[]): boolean {
  return permissions.some(permission => hasPermission(role, permission));
}

// Check if a role has all of the specified permissions
export function hasAllPermissions(role: Role, permissions: Permission[]): boolean {
  return permissions.every(permission => hasPermission(role, permission));
}

// Get all permissions for a role
export function getRolePermissions(role: Role): Permission[] {
  return rolePermissions[role] || [];
}

// Audit log types
export type AuditAction = 
  | 'login'
  | 'logout'
  | 'appointment:create'
  | 'appointment:approve'
  | 'appointment:reject'
  | 'appointment:cancel'
  | 'consultation:create'
  | 'consultation:update'
  | 'consultation:delete'
  | 'consultation:view'
  | 'citizen:create'
  | 'citizen:update'
  | 'citizen:delete'
  | 'citizen:view'
  | 'report:generate'
  | 'report:export'
  | 'user:create'
  | 'user:update'
  | 'user:delete'
  | 'settings:update';

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  userRole: Role;
  action: AuditAction;
  resourceType: string;
  resourceId: string;
  details?: Record<string, any>;
  ipAddress?: string;
  timestamp: Date;
}

// Mock function to log audit events
export function logAudit(params: Omit<AuditLog, 'id' | 'timestamp'>): void {
  const log: AuditLog = {
    ...params,
    id: `AUDIT-${Date.now()}`,
    timestamp: new Date(),
  };
  
  // In a real application, this would send the log to a backend service
  console.log('[AUDIT]', log);
}

// Role display names in Korean
export const roleDisplayNames: Record<Role, string> = {
  citizen: '시민',
  counselor: '상담사',
  center_manager: '센터장',
  regional_manager: '광역센터 관리자',
  central_admin: '중앙 관리자',
};

export function getRoleDisplayName(role: Role): string {
  return roleDisplayNames[role] || role;
}
