import type { CreateUserInput, User } from "./user.types";
import { notifySaasMutation } from "../persistence/persistence-bus";

type MutableUserPatch = {
  displayName?: string;
  email?: string;
  firstLoginCompleted?: boolean;
  mustChangePassword?: boolean;
  role?: User["role"];
  status?: User["status"];
  username?: string;
};

function now() {
  return new Date().toISOString();
}

export function stableUserId(value: unknown) {
  if (typeof value !== "string") return "demo-current-user";
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "-").slice(0, 64);
  return normalized || "demo-current-user";
}

export class UsersService {
  private readonly users = new Map<string, User>();

  getOrCreate(input: CreateUserInput = {}): User {
    const id = stableUserId(input.userId ?? input.username ?? input.email);
    const existing = this.users.get(id);
    if (existing) {
      const next = this.mergeUser(existing, input);
      this.users.set(next.id, next);
      if (next !== existing) notifySaasMutation("users:merge");
      return next;
    }

    const timestamp = now();
    const user: User = {
      id,
      username: input.username?.trim().toLowerCase() || id,
      email: input.email?.trim().toLowerCase() || `${id}@local.razon`,
      displayName: input.displayName?.trim() || (id === "demo-current-user" ? "Current user" : id),
      role: input.role ?? "USER",
      status: input.status ?? "ACTIVE",
      mustChangePassword: input.mustChangePassword ?? false,
      firstLoginCompleted: input.firstLoginCompleted ?? false,
      createdAt: timestamp,
      updatedAt: timestamp,
      lastLoginAt: null,
    };

    this.users.set(id, user);
    notifySaasMutation("users:create");
    return user;
  }

  findById(userId: string): User | null {
    return this.users.get(stableUserId(userId)) ?? null;
  }

  findByIdentifier(identifier: string): User | null {
    const normalized = identifier.trim().toLowerCase();
    if (!normalized) return null;

    return Array.from(this.users.values()).find(user =>
      user.id === stableUserId(normalized) ||
      user.username.toLowerCase() === normalized ||
      user.email.toLowerCase() === normalized
    ) ?? null;
  }

  update(userId: string, patch: Partial<Pick<User, "displayName" | "email" | "firstLoginCompleted" | "lastLoginAt" | "mustChangePassword" | "role" | "status" | "username">>): User | null {
    const user = this.findById(userId);
    if (!user) return null;

    const next: User = {
      ...user,
      ...patch,
      email: patch.email?.trim().toLowerCase() ?? user.email,
      username: patch.username?.trim().toLowerCase() ?? user.username,
      displayName: patch.displayName?.trim() || user.displayName,
      updatedAt: now(),
    };
    this.users.set(next.id, next);
    notifySaasMutation("users:update");
    return next;
  }

  list(): readonly User[] {
    return Array.from(this.users.values());
  }

  exportPersistence(): readonly User[] {
    return this.list();
  }

  importPersistence(users: readonly User[]) {
    this.users.clear();
    for (const user of users) this.users.set(user.id, user);
  }

  reset() {
    this.users.clear();
    notifySaasMutation("users:reset");
  }

  private mergeUser(existing: User, input: CreateUserInput): User {
    const patch: MutableUserPatch = {};
    if (input.email) patch.email = input.email.trim().toLowerCase();
    if (input.username) patch.username = input.username.trim().toLowerCase();
    if (input.displayName) patch.displayName = input.displayName.trim();
    if (input.role) patch.role = input.role;
    if (input.status) patch.status = input.status;
    if (typeof input.mustChangePassword === "boolean") patch.mustChangePassword = input.mustChangePassword;
    if (typeof input.firstLoginCompleted === "boolean") patch.firstLoginCompleted = input.firstLoginCompleted;
    if (Object.keys(patch).length === 0) return existing;

    return {
      ...existing,
      ...patch,
      updatedAt: now(),
    };
  }
}

export function createUsersService() {
  return new UsersService();
}

export const usersService = createUsersService();
