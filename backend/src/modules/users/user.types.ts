export type UserRole = "OWNER" | "ADMIN" | "USER";
export type UserStatus = "ACTIVE" | "DISABLED";

export interface User {
  readonly id: string;
  readonly username: string;
  readonly email: string;
  readonly displayName: string;
  readonly role: UserRole;
  readonly status: UserStatus;
  readonly mustChangePassword: boolean;
  readonly firstLoginCompleted: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly lastLoginAt: string | null;
}

export interface CreateUserInput {
  readonly userId?: string;
  readonly username?: string;
  readonly email?: string;
  readonly displayName?: string;
  readonly role?: UserRole;
  readonly status?: UserStatus;
  readonly mustChangePassword?: boolean;
  readonly firstLoginCompleted?: boolean;
}
