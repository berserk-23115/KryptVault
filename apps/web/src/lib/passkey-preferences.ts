const PASSKEY_AUTOFILL_STORAGE_KEY = "kv-passkey-autofill";

export const getPasskeyAutofillPreference = () => {
  if (typeof window === "undefined") {
    return true;
  }

  const stored = window.localStorage.getItem(PASSKEY_AUTOFILL_STORAGE_KEY);
  if (stored === null) {
    return true;
  }

  return stored !== "false";
};

export const setPasskeyAutofillPreference = (enabled: boolean) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    PASSKEY_AUTOFILL_STORAGE_KEY,
    enabled ? "true" : "false",
  );
};

export { PASSKEY_AUTOFILL_STORAGE_KEY };
