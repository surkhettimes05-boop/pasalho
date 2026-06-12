import { api } from './client';

export interface LoginCredentials {
  login: string; // email or phone
  password: string;
}

export interface UserMe {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'INVITED';
  defaultBranchId?: string;
  defaultBranch?: { id: string; code: string; name: string; city: string };
  permissions: string[];
  userRoles: Array<{
    roleCode: string;
    roleName: string;
    branchId?: string;
    branchName?: string;
    warehouseId?: string;
  }>;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  userId: string;
  permissions: string[];
}

export const authApi = {
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    return api.post('/auth/login', credentials);
  },
  async refresh(refreshToken: string): Promise<LoginResponse> {
    return api.post('/auth/refresh', { refreshToken });
  },
  async me(): Promise<UserMe> {
    return api.get('/auth/me');
  },
  async logout(): Promise<void> {
    return api.post('/auth/logout');
  },
};

export function hasPermission(perms: string[] | undefined, required: string): boolean {
  if (!perms) return false;
  return perms.includes(required) || perms.includes('roles.manage');
}