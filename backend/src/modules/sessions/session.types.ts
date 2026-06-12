export interface UserSession {
  readonly id: string;
  readonly userId: string;
  readonly licenseId: string;
  readonly deviceId: string;
  readonly createdAt: string;
  readonly lastSeenAt: string;
  readonly revoked: boolean;
}

export interface StartUserSessionInput {
  readonly userId: string;
  readonly licenseId: string;
  readonly deviceId: string;
  readonly sessionId?: string;
}
