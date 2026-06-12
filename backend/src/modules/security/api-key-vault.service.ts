import { EncryptionService } from "./encryption.service";
import type { ApiKeyMetadata, EncryptedSecret } from "./security.types";

export interface StoreApiKeyInput {
  readonly provider: string;
  readonly keyName: string;
  readonly plaintext: string;
  readonly purpose: string;
  readonly actorId: string;
}

function createId(provider: string, keyName: string) {
  return `secret-${provider}-${keyName}`.replace(/[^a-zA-Z0-9_-]/g, "-").toLowerCase();
}

function metadata(secret: EncryptedSecret): ApiKeyMetadata {
  return {
    id: secret.id,
    provider: secret.provider,
    keyName: secret.keyName,
    maskedValue: secret.maskedValue,
    createdAt: secret.createdAt,
    rotatedAt: secret.rotatedAt,
  };
}

export class ApiKeyVaultService {
  private readonly secrets = new Map<string, EncryptedSecret>();

  constructor(
    private readonly masterKey: string,
    private readonly encryption = new EncryptionService(),
  ) {}

  async storeApiKey(input: StoreApiKeyInput): Promise<ApiKeyMetadata> {
    this.assertServerOnly(input.keyName);
    const id = createId(input.provider, input.keyName);
    const encrypted = await this.encryption.encryptSecret({
      id,
      provider: input.provider,
      keyName: input.keyName,
      purpose: input.purpose,
      plaintext: input.plaintext,
      masterKey: this.masterKey,
    });

    this.secrets.set(id, encrypted);
    return metadata(encrypted);
  }

  async rotateApiKey(input: StoreApiKeyInput): Promise<ApiKeyMetadata> {
    const stored = await this.storeApiKey(input);
    const current = this.secrets.get(stored.id);
    if (!current) return stored;
    const rotated = { ...current, rotatedAt: new Date().toISOString() };
    this.secrets.set(rotated.id, rotated);
    return metadata(rotated);
  }

  listApiKeys(): readonly ApiKeyMetadata[] {
    return [...this.secrets.values()].map(metadata);
  }

  getApiKeyMetadata(id: string): ApiKeyMetadata | null {
    const secret = this.secrets.get(id);
    return secret ? metadata(secret) : null;
  }

  async revealForServerUse(id: string, reason: string): Promise<string> {
    if (!reason) throw new Error("A reveal reason is required for auditability.");
    const secret = this.secrets.get(id);
    if (!secret) throw new Error(`Secret '${id}' was not found.`);
    return this.encryption.decryptSecret(secret, this.masterKey);
  }

  sanitizeLogPayload<T>(payload: T): T {
    return JSON.parse(JSON.stringify(payload, (_key, value) => {
      if (typeof value !== "string") return value;
      if (value.length < 8) return value;
      if (/token|secret|password|api[_-]?key|bearer/i.test(value)) return this.encryption.maskSecret(value);
      return value;
    })) as T;
  }

  private assertServerOnly(keyName: string) {
    if (/^VITE_|^NEXT_PUBLIC_|^PUBLIC_/i.test(keyName)) {
      throw new Error(`Secret '${keyName}' is unsafe because public frontend prefixes are forbidden.`);
    }
  }
}
