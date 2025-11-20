# Passkey Support in KryptVault

## Overview

KryptVault supports WebAuthn passkey authentication for passwordless sign-in using biometrics (Touch ID, Face ID, Windows Hello) or hardware security keys (YubiKey, etc.).

## Platform Support

### ✅ Web Browser (Full Support)
- Chrome/Edge 109+
- Safari 16+
- Firefox 122+

**Features Available:**
- Register passkeys with biometric or security keys
- Sign in with passkeys
- Conditional UI (autofill passkey prompts)
- Manage multiple passkeys
- Browser passkey autofill settings

### ❌ Desktop App (Not Supported)
Passkey authentication is **not available** in the Tauri desktop application due to WebAuthn platform limitations.

**Reason:** 
Tauri's webview does not have access to the operating system's WebAuthn/FIDO2 APIs required for passkey operations. This is a fundamental limitation of embedded webviews across all platforms (macOS, Windows, Linux).

**Alternative:**
Use email and password authentication in the desktop app. If you need passkey authentication, use the web version at your deployment URL.

## Technical Details

### Why Passkeys Don't Work in Tauri

1. **WebView Limitations**: Tauri uses platform webviews (WKWebView on macOS, WebView2 on Windows) which don't expose the `PublicKeyCredential` API
2. **Security Context**: WebAuthn requires a secure browsing context with proper origin validation that desktop apps cannot provide
3. **Platform Integration**: Native passkey support requires deep OS integration that webviews intentionally restrict

### Workarounds Considered

- ✗ Native implementation: Would require platform-specific code for macOS/Windows/Linux
- ✗ Plugin development: WebAuthn requires OS-level permissions not available to Tauri plugins
- ✓ **Current solution**: Gracefully disable passkeys in desktop app, full support in web

## User Experience

### Web Version
1. Navigate to Settings → Passkeys
2. Click "Add passkey"
3. Choose authenticator type (platform/roaming)
4. Complete biometric/security key verification
5. Use passkey to sign in from login page

### Desktop Version
- Passkey options are hidden
- Settings page shows informational notice
- Users redirected to use email/password authentication
- Clear messaging about web version availability

## Development

### Detection Code
```typescript
import { isTauriContext } from "@/lib/platform-detection";

if (isTauriContext()) {
  // Hide passkey features
}
```

### Feature Flags
The app automatically detects the runtime environment and adjusts UI accordingly:
- Sign-in form hides passkey button in Tauri
- Settings page shows platform notice in Tauri
- Conditional UI disabled in Tauri

## Future Considerations

If Tauri adds WebAuthn support or platform-specific plugins become available, we can:
1. Implement native passkey handlers per platform
2. Bridge to OS-level credential managers
3. Enable feature parity across web and desktop

## References

- [WebAuthn Specification](https://www.w3.org/TR/webauthn-2/)
- [Tauri Security Documentation](https://tauri.app/v1/guides/features/security/)
- [Better-Auth Passkey Plugin](https://www.better-auth.com/docs/plugins/passkey)
