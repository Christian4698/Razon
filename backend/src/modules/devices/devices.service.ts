import crypto from "crypto";
import type { Device, RegisterDeviceInput } from "./device.types";
import { notifySaasMutation } from "../persistence/persistence-bus";

function now() {
  return new Date().toISOString();
}

function hash(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export class DevicesService {
  private readonly devices = new Map<string, Device>();

  register(input: RegisterDeviceInput): Device {
    const rawDeviceId = input.deviceId?.trim() || `${input.userId}:default-device`;
    const id = hash(`${input.userId}:${input.licenseId}:${rawDeviceId}`).slice(0, 24);
    const existing = this.devices.get(id);
    const timestamp = now();

    if (existing) {
      const updated: Device = { ...existing, lastSeenAt: timestamp };
      this.devices.set(id, updated);
      notifySaasMutation("devices:update");
      return updated;
    }

    const device: Device = {
      id,
      userId: input.userId,
      licenseId: input.licenseId,
      label: input.label?.trim() || "Current device",
      fingerprintHash: hash(rawDeviceId),
      firstSeenAt: timestamp,
      lastSeenAt: timestamp,
      revoked: false,
    };

    this.devices.set(id, device);
    notifySaasMutation("devices:register");
    return device;
  }

  listByLicense(licenseId: string): readonly Device[] {
    return Array.from(this.devices.values()).filter(device => device.licenseId === licenseId && !device.revoked);
  }

  reset() {
    this.devices.clear();
    notifySaasMutation("devices:reset");
  }

  exportPersistence(): readonly Device[] {
    return Array.from(this.devices.values());
  }

  importPersistence(devices: readonly Device[]) {
    this.devices.clear();
    for (const device of devices) this.devices.set(device.id, device);
  }
}

export function createDevicesService() {
  return new DevicesService();
}
