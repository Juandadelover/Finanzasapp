const STORAGE_KEY = "finanzas:app-lock";

interface AppLockConfig {
  enabled: boolean;
  credentialId: string; // base64url-encoded rawId
}

function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBuffer(value: string): ArrayBuffer {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function randomBytes(length: number): BufferSource {
  return crypto.getRandomValues(new Uint8Array(length)) as unknown as BufferSource;
}

export function getAppLockConfig(): AppLockConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AppLockConfig) : null;
  } catch {
    return null;
  }
}

export function isAppLockSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.PublicKeyCredential !== "undefined" &&
    typeof navigator.credentials !== "undefined"
  );
}

export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (!isAppLockSupported()) return false;
  try {
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

export async function registerAppLock(userEmail: string): Promise<boolean> {
  if (!isAppLockSupported()) return false;

  try {
    const credential = (await navigator.credentials.create({
      publicKey: {
        challenge: randomBytes(32),
        rp: { name: "Finanzas" },
        user: {
          id: randomBytes(16),
          name: userEmail,
          displayName: userEmail,
        },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 },
          { type: "public-key", alg: -257 },
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required",
        },
        timeout: 60000,
        attestation: "none",
      },
    })) as PublicKeyCredential | null;

    if (!credential) return false;

    const config: AppLockConfig = {
      enabled: true,
      credentialId: bufferToBase64Url(credential.rawId),
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    return true;
  } catch {
    return false;
  }
}

export async function verifyAppLock(): Promise<boolean> {
  const config = getAppLockConfig();
  if (!config?.enabled) return true;
  if (!isAppLockSupported()) return true;

  try {
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: randomBytes(32),
        allowCredentials: [
          {
            id: base64UrlToBuffer(config.credentialId),
            type: "public-key",
            transports: ["internal"],
          },
        ],
        userVerification: "required",
        timeout: 60000,
      },
    });
    return Boolean(assertion);
  } catch {
    return false;
  }
}

export function disableAppLock(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}
