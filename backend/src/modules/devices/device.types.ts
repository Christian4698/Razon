export interface Device {
  readonly id: string;
  readonly userId: string;
  readonly licenseId: string;
  readonly label: string;
  readonly fingerprintHash: string;
  readonly firstSeenAt: string;
  readonly lastSeenAt: string;
  readonly userAgent?: string | null;
  readonly ipHash?: string | null;
  readonly revoked: boolean;
}

export interface RegisterDeviceInput {
  readonly userId: string;
  readonly licenseId: string;
  readonly deviceId?: string;
  readonly label?: string;
  readonly userAgent?: string | null;
  readonly ipHash?: string | null;
}
