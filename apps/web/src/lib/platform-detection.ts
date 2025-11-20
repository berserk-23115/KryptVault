/**
 * Platform detection utilities for handling differences between web and Tauri
 */

export const isTauriContext = (): boolean => {
  if (typeof window === "undefined") {
    return false;
  }
  
  // Check for Tauri-specific globals
  return "__TAURI__" in window || "__TAURI_INTERNALS__" in window;
};

export const supportsPasskeys = async (): Promise<boolean> => {
  // Passkeys don't work in Tauri's webview
  if (isTauriContext()) {
    return false;
  }

  // Check browser support
  if (typeof window === "undefined" || !window.PublicKeyCredential) {
    return false;
  }

  try {
    // Check if the browser supports the PublicKeyCredential API
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
};

export const getPlatformName = (): string => {
  if (isTauriContext()) {
    return "desktop";
  }
  return "web";
};
