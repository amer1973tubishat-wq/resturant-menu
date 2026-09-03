import type { Role } from '@prisma/client';

/**
 * Permissions are the unit of authorisation; roles are just bundles of them.
 * Route handlers ask for a permission, never for a role, so adding a role
 * later does not mean auditing every handler again.
 */
export const PERMISSIONS = [
  'menu:read', 'menu:write',
  'content:read', 'content:write',
  'media:read', 'media:write', 'media:delete',
  'messages:read', 'messages:write',
  'settings:read', 'settings:write',
  'users:read', 'users:write',
  'audit:read',
  'backup:run',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const VIEWER: Permission[] = ['menu:read', 'content:read', 'media:read', 'messages:read', 'settings:read'];
const EDITOR: Permission[] = [...VIEWER, 'menu:write', 'media:write'];
const ADMIN: Permission[] = [
  ...EDITOR,
  'content:write', 'media:delete', 'messages:write', 'settings:write', 'audit:read',
];
const SUPER_ADMIN: Permission[] = [...ADMIN, 'users:read', 'users:write', 'backup:run'];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  VIEWER,
  EDITOR,
  ADMIN,
  SUPER_ADMIN,
};

export function can(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function canAll(role: Role, permissions: Permission[]): boolean {
  return permissions.every((p) => can(role, p));
}

/** Navigation is filtered by the same table that guards the API. */
export const NAV_PERMISSION: Record<string, Permission> = {
  '/': 'menu:read',
  '/menu': 'menu:read',
  '/hero': 'content:read',
  '/media': 'media:read',
  '/content': 'content:read',
  '/builder': 'menu:read',
  '/messages': 'messages:read',
  '/users': 'users:read',
  '/audit': 'audit:read',
  '/settings': 'settings:read',
};
