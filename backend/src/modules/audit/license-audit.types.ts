import type { LicenseStatus } from "../licenses/license.types";

export type LicenseActivationLogEvent =
  | "LICENSE_CREATED"
  | "LICENSE_ACTIVATED"
  | "LICENSE_RENEWED"
  | "LICENSE_EXPIRED"
  | "LICENSE_SUSPENDED"
  | "LICENSE_REVOKED"
  | "DEVICE_LIMIT_REACHED"
  | "SESSION_LIMIT_REACHED"
  | "LICENSE_ACTIVATION_FAILED";

export interface LicenseActivationLog {
  readonly id: string;
  readonly timestamp: string;
  readonly userId: string;
  readonly licenseId: string | null;
  readonly event: LicenseActivationLogEvent;
  readonly status: LicenseStatus | "MISSING";
  readonly message: string;
  readonly metadata: Readonly<Record<string, string | number | boolean | null>>;
}

export interface CreateLicenseActivationLogInput {
  readonly userId: string;
  readonly licenseId?: string | null;
  readonly event: LicenseActivationLogEvent;
  readonly status: LicenseStatus | "MISSING";
  readonly message: string;
  readonly metadata?: Readonly<Record<string, string | number | boolean | null>>;
}
