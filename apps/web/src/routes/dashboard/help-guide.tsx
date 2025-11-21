import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/dashboard/help-guide')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div className="p-6 text-slate-800 dark:text-slate-200 leading-relaxed text-sm sm:text-base">
      <h1 className="text-2xl font-semibold mb-4">User Guide</h1>

      <p className="mb-6">
        KryptVault is designed to offer a private, secure, and attractively organized. workspace for all your encrypted files. Everything you upload whether a.
        single file or an full folder is encrypted locally on your device using. advanced end to end encryption. entirely you (and the people you choose to share with)
        can always decrypt and view the content. This guide covers every. substantial feature and workflow so you can make the most out of your vault. </p>

        <h2 className="text-xl font-semibold mb-2">1. Uploading Files & Folder</h2>
        <ul className="list-disc pl-5 space y-2 mb-6">
        <li>
          Click the <strong>Upload</strong> button in the sidebar to reveal. options for <strong>File Upload</strong> and <strong>Folder Upload</strong>.
        </li>
        <li>
          When uploading directories, KryptVault mechanically creates a new. encrypted folder and ass Each file is encrypted locally with its own Data Encryption Key (DEK) before being sent to cloud storage.
        </li>
        <li>
          Upload progress and statuses appear through a clean toast notification system.
        </li>
        <li>
          Even metadata is protected—only minimal necessary information is stored.
        </li>
        </ul>

        <h2 className="text-xl font-semibold mb-2">2. End-to-End Encryption</h2>
        <ul className="list-disc pl-5 space-y-2 mb-6">
        <li>
          All encryption happens <strong>client-side</strong>; nothing ever leaves
          your device unencrypted.
        </li>
        <li>
          KryptVault uses a secure key pair (X25519) generated during onboarding.
        </li>
        <li>
          Each file has its own DEK, which is wrapped (encrypted) using your
          public key or a folder key.
        </li>
        <li>
          When you open a file, the DEK is unwrapped using your private key and
          decrypted securely in your environment.
        </li>
        <li>
          Sharing re-wraps the DEK with the recipient's public key—meaning only
          they can decrypt it.
        </li>
      </ul>

      <h2 className="text-xl font-semibold mb-2">3. Organizing Your Vault</h2>
      <ul className="list-disc pl-5 space-y-2 mb-6">
        <li>Your main dashboard lets you view recent uploads and quick actions.</li>
        <li>
          The <strong>My Files</strong> section shows all uploaded files, grouped
          by folders or sorted by name, size, or date.
        </li>
        <li>
          Rename folders, inspect file details, or move items with smooth UI transitions.
        </li>
        <li>
          Folder cards include size, file count, and quick actions.
        </li>
      </ul>

      <h2 className="text-xl font-semibold mb-2">4. Sharing Securely</h2>
      <ul className="list-disc pl-5 space-y-2 mb-6">
        <li>
          You can share files or folders with other KryptVault users by wrapping
          the DEK with their public key.
        </li>
        <li>
          Shared content appears in the <strong>Shared</strong> section of the sidebar.
        </li>
        <li>
          Permissions are enforced cryptographically—not by relying on the server.
        </li>
        <li>
          You can revoke access any time; the system rewraps DEKs accordingly.
        </li>
      </ul>

      <h2 className="text-xl font-semibold mb-2">5. Managing Deleted Items</h2>
      <ul className="list-disc pl-5 space-y-2 mb-6">
        <li>
          Deleted files move to the <strong>Trash Bin</strong> instead of being
          immediately erased.
        </li>
        <li>Items can be restored if deleted accidentally.</li>
        <li>
          Permanently deleting a file removes its DEK and metadata—making the
          encrypted file blob useless forever.
        </li>
      </ul>

      <h2 className="text-xl font-semibold mb-2">6. Searching Inside KryptVault</h2>
      <ul className="list-disc pl-5 space-y-2 mb-6">
        <li>
          The global search bar in the header lets you search across file names,
          folder names, and shared items.
        </li>
        <li>Search results appear instantly through the dynamic search page.</li>
        <li>Search is privacy-preserving—no file content is ever indexed.</li>
      </ul>

      <h2 className="text-xl font-semibold mb-2">7. Settings & Account Controls</h2>
      <ul className="list-disc pl-5 space-y-2 mb-6">
        <li>Manage your account details and update personal info.</li>
        <li>Regenerate encryption keys if needed (careful: this affects old files).</li>
        <li>
          Configure security questions, session behavior, appearance settings,
          and vault preferences.
        </li>
      </ul>

      <h2 className="text-xl font-semibold mb-2">8. Light & Dark Mode</h2>
      <ul className="list-disc pl-5 space-y-2 mb-6">
        <li>
          KryptVault includes a beautifully crafted dark mode and light mode.
        </li>
        <li>ModeToggle saves your theme preference automatically.</li>
        <li>
          Animations, gradients, and UI transitions adapt smoothly across both themes.
        </li>
      </ul>

      <h2 className="text-xl font-semibold mb-2">9. Need Help?</h2>
      <ul className="list-disc pl-5 space-y-2">
        <li>
          Visit the <strong>Help & Guide</strong> section from the sidebar anytime.
        </li>
        <li>
          For account issues or encryption problems, check app notifications for
          warnings or required actions.
        </li>
        <li>More support & documentation coming soon.</li>
      </ul>
    </div>
  );
}
