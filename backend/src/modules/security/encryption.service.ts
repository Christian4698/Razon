import type { EncryptedSecret } from "./security.types";

type SubtleLike = {
  importKey: (
    format: string,
    keyData: Uint8Array,
    algorithm: { readonly name: string },
    extractable: boolean,
    keyUsages: readonly string[],
  ) => Promise<unknown>;
  encrypt: (
    algorithm: { readonly name: string; readonly iv: Uint8Array },
    key: unknown,
    data: Uint8Array,
  ) => Promise<ArrayBuffer>;
  decrypt: (
    algorithm: { readonly name: string; readonly iv: Uint8Array },
    key: unknown,
    data: Uint8Array,
  ) => Promise<ArrayBuffer>;
  digest: (algorithm: string, data: Uint8Array) => Promise<ArrayBuffer>;
};

type CryptoLike = {
  readonly subtle?: SubtleLike;
  getRandomValues?: (array: Uint8Array) => Uint8Array;
};

function runtimeCrypto(): CryptoLike | undefined {
  return (globalThis as typeof globalThis & { crypto?: CryptoLike }).crypto;
}

function isProductionRuntime() {
  const runtime = globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } };
  return runtime.process?.env?.NODE_ENV === "production";
}

function bytesFromString(value: string) {
  return Uint8Array.from([...value].map(char => char.charCodeAt(0) & 255));
}

function stringFromBytes(bytes: Uint8Array) {
  return [...bytes].map(byte => String.fromCharCode(byte)).join("");
}

function toBase64(bytes: Uint8Array) {
  const runtime = globalThis as typeof globalThis & { btoa?: (input: string) => string };
  const binary = stringFromBytes(bytes);
  if (runtime.btoa) return runtime.btoa(binary);
  return `hex:${[...bytes].map(byte => byte.toString(16).padStart(2, "0")).join("")}`;
}

function fromBase64(value: string) {
  if (value.startsWith("hex:")) {
    const hex = value.slice(4);
    return Uint8Array.from(hex.match(/.{1,2}/g)?.map(chunk => Number.parseInt(chunk, 16)) ?? []);
  }

  const runtime = globalThis as typeof globalThis & { atob?: (input: string) => string };
  if (!runtime.atob) throw new Error("Base64 decoder is not available.");
  return bytesFromString(runtime.atob(value));
}

function maskSecret(value: string) {
  if (!value) return "";
  if (value.length <= 4) return "****";
  return `${value.slice(0, 2)}****${value.slice(-2)}`;
}

function xorBytes(data: Uint8Array, key: Uint8Array, iv: Uint8Array) {
  return data.map((byte, index) => byte ^ key[index % key.length] ^ iv[index % iv.length]);
}

export interface EncryptSecretInput {
  readonly id: string;
  readonly provider: string;
  readonly keyName: string;
  readonly purpose: string;
  readonly plaintext: string;
  readonly masterKey: string;
}

export class EncryptionService {
  async encryptSecret(input: EncryptSecretInput): Promise<EncryptedSecret> {
    if (!input.plaintext) throw new Error("Cannot encrypt an empty secret.");
    if (!input.masterKey || input.masterKey.length < 16) {
      throw new Error("Encryption master key must be at least 16 characters.");
    }

    const crypto = runtimeCrypto();
    const iv = this.randomBytes(12);
    const data = bytesFromString(input.plaintext);
    const keyBytes = await this.deriveKeyBytes(input.masterKey);

    if (crypto?.subtle) {
      const key = await crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
      const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data);

      return {
        id: input.id,
        provider: input.provider,
        keyName: input.keyName,
        purpose: input.purpose,
        algorithm: "AES-GCM",
        ciphertext: toBase64(new Uint8Array(encrypted)),
        iv: toBase64(iv),
        maskedValue: maskSecret(input.plaintext),
        createdAt: new Date().toISOString(),
      };
    }

    if (isProductionRuntime()) {
      throw new Error("AES-GCM encryption is required in production.");
    }

    return {
      id: input.id,
      provider: input.provider,
      keyName: input.keyName,
      purpose: input.purpose,
      algorithm: "RAZON-LOCAL-XOR-FALLBACK",
      ciphertext: toBase64(xorBytes(data, keyBytes, iv)),
      iv: toBase64(iv),
      maskedValue: maskSecret(input.plaintext),
      createdAt: new Date().toISOString(),
    };
  }

  async decryptSecret(secret: EncryptedSecret, masterKey: string): Promise<string> {
    if (!masterKey || masterKey.length < 16) {
      throw new Error("Encryption master key must be at least 16 characters.");
    }

    const keyBytes = await this.deriveKeyBytes(masterKey);
    const iv = fromBase64(secret.iv);
    const encrypted = fromBase64(secret.ciphertext);

    if (secret.algorithm === "AES-GCM") {
      const crypto = runtimeCrypto();
      if (!crypto?.subtle) throw new Error("AES-GCM decryption is not available in this runtime.");
      const key = await crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["decrypt"]);
      const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, encrypted);
      return stringFromBytes(new Uint8Array(decrypted));
    }

    if (isProductionRuntime()) {
      throw new Error("AES-GCM decryption is required in production.");
    }

    return stringFromBytes(xorBytes(encrypted, keyBytes, iv));
  }

  maskSecret(value: string): string {
    return maskSecret(value);
  }

  private randomBytes(length: number) {
    const bytes = new Uint8Array(length);
    const crypto = runtimeCrypto();
    if (crypto?.getRandomValues) return crypto.getRandomValues(bytes);
    if (isProductionRuntime()) {
      throw new Error("Secure random generation is required in production.");
    }
    return bytes.map(() => Math.floor(Math.random() * 256));
  }

  private async deriveKeyBytes(masterKey: string) {
    const source = bytesFromString(masterKey);
    const crypto = runtimeCrypto();
    if (crypto?.subtle) return new Uint8Array(await crypto.subtle.digest("SHA-256", source));

    const output = new Uint8Array(32);
    source.forEach((byte, index) => {
      output[index % output.length] = (output[index % output.length] + byte + index) % 256;
    });
    return output;
  }
}
