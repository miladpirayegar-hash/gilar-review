import type { Membership, PermissionLevel, Role } from './domain/models'

export type Permission = 'view_financial_data' | 'manage_integrations' | 'view_opportunities' | 'approve_actions' | 'manage_agents' | 'invite_users' | 'manage_settings'

const rolePermissions: Record<Role, readonly Permission[]> = {
  Owner: ['view_financial_data', 'manage_integrations', 'view_opportunities', 'approve_actions', 'manage_agents', 'invite_users', 'manage_settings'],
  Admin: ['view_financial_data', 'manage_integrations', 'view_opportunities', 'approve_actions', 'manage_agents', 'invite_users', 'manage_settings'],
  Manager: ['view_financial_data', 'view_opportunities', 'approve_actions', 'manage_agents'],
  Member: ['view_opportunities', 'manage_agents'],
  Viewer: ['view_opportunities'],
}

export function hasPermission(membership: Membership, permission: Permission): boolean {
  return rolePermissions[membership.role].includes(permission)
}

export function canUseIntegrationLevel(membership: Membership, requested: PermissionLevel): boolean {
  if (requested === 'observe') return true
  return membership.role !== 'Viewer'
}

export function permissionsForRole(role: Role): readonly Permission[] { return rolePermissions[role] }
