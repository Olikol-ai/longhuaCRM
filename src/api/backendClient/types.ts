export type UserRole = 'admin' | 'teacher' | 'student';

export type UserStatus = 'active' | 'inactive' | 'pending';

export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  firstName?: string | null;
  lastName?: string | null;
}

export interface AuthResponse {
  accessToken: string;
  user: UserProfile;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface UsersQuery {
  role?: UserRole;
  status?: UserStatus;
  search?: string;
}
