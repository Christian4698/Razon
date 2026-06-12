import type { Device } from "../devices";
import type { UserSession } from "../sessions";

export type LicensePlan = "STARTER" | "PRO" | "ELITE" | "LIFETIME";
export type LicenseDuration = "1_MONTH" | "2_MONTHS" | "3_MONTHS" | "6_MONTHS" | "1_YEAR" | "LIFETIME";
export type LicenseStatus = "PENDING" | "ACTIVE" | "EXPIRED" | "SUSPENDED" | "REVOKED";

export interface LicensePlanDefinition {
  readonly plan: LicensePlan;
  readonly label: string;
  readonly deviceLimit: number;
  readonly sessionLimit: number;
}

export interface Subscription {
  readonly id: string;
  readonly userId: string;
  readonly licenseId: string;
  readonly plan: LicensePlan;
  readonly status: LicenseStatus;
  readonly startedAt: string | null;
  readonly expiresAt: string | null;
  readonly renewedAt: string | null;
  readonly paymentProvider: "NONE";
}

export interface License {
  readonly id: string;
  readonly userId: string;
  readonly plan: LicensePlan;
  readonly duration: LicenseDuration;
  readonly status: LicenseStatus;
  readonly licenseKeyHash: string;
  readonly licenseKeyPreview: string;
  readonly createdAt: string;
  readonly activatedAt: string | null;
  readonly expiresAt: string | null;
  readonly suspendedAt: string | null;
  readonly revokedAt: string | null;
  readonly subscriptionId: string;
}

export interface SafeLicense {
  readonly id: string;
  readonly userId: string;
  readonly plan: LicensePlan;
  readonly duration: LicenseDuration;
  readonly status: LicenseStatus;
  readonly licenseKeyPreview: string;
  readonly createdAt: string;
  readonly activatedAt: string | null;
  readonly expiresAt: string | null;
  readonly suspendedAt: string | null;
  readonly revokedAt: string | null;
  readonly subscriptionId: string;
}

export interface LicenseStatusSnapshot {
  readonly userId: string;
  readonly license: SafeLicense | null;
  readonly subscription: Subscription | null;
  readonly plan: LicensePlan | "NONE";
  readonly status: LicenseStatus | "MISSING";
  readonly expiryDate: string | null;
  readonly deviceLimit: number | null;
  readonly activeDevices: number;
  readonly sessionLimit: number | null;
  readonly activeSessions: number;
  readonly devices: readonly Device[];
  readonly sessions: readonly UserSession[];
  readonly dashboardBlocked: boolean;
  readonly limitedReadOnly: boolean;
  readonly readOnly: true;
  readonly liveExecutionEnabled: false;
  readonly automaticTradingAllowed: false;
  readonly message: string;
  readonly warnings: readonly string[];
}

export interface CreateLicenseInput {
  readonly userId: string;
  readonly email?: string;
  readonly displayName?: string;
  readonly plan: LicensePlan;
  readonly duration: LicenseDuration;
  readonly startsAt?: string;
  readonly expiresAt?: string | null;
}

export interface CreateLicenseResult {
  readonly license: SafeLicense;
  readonly oneTimeLicenseKey: string;
  readonly warning: "LICENSE_KEY_VISIBLE_ONCE";
}

export interface ActivateLicenseInput {
  readonly userId: string;
  readonly licenseKey: string;
  readonly deviceId?: string;
  readonly deviceLabel?: string;
  readonly sessionId?: string;
}

export interface LicenseActionInput {
  readonly userId?: string;
  readonly licenseId?: string;
  readonly duration?: LicenseDuration;
  readonly reason?: string;
}

export interface LicenseActionResult {
  readonly ok: boolean;
  readonly status: LicenseStatus | "MISSING";
  readonly message: string;
  readonly snapshot: LicenseStatusSnapshot;
}
