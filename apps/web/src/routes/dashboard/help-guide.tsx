import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/dashboard/help-guide')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div className="p-6 text-slate-800 dark:text-slate-200 leading-relaxed text-sm sm:text-base">
      <h1 className="text-2xl font-semibold mb-4">User Guide</h1>

      <p className="whitespace-pre-line">
        KryptVault is built to give you a secure, intuitive, and privacy-focused space 
        to store, encrypt, organize, and manage all your important files. The app uses 
        complete end-to-end encryption, meaning every file is encrypted locally on 
        your device before it ever leaves your system, ensuring only you—and the 
        people you explicitly share access with—can open it. Your dashboard offers a 
        clean overview of your recent uploads, actions, and storage activity, while 
        the sidebar lets you seamlessly move between your files, shared items, 
        incoming requests, settings, and the trash bin. Uploading files or folders is 
        effortless: simply click the “Upload” button and choose whether you want to 
        add single files or entire directories. KryptVault automatically assigns 
        encryption keys, organizes uploads, and ensures everything remains securely 
        structured. You can rename folders, inspect file details, restore items from 
        trash, permanently delete data, or manage sharing permissions—all with a 
        polished and responsive interface that adapts smoothly to both light and 
        dark mode. The integrated search bar helps you find anything instantly across 
        your vault. Whether you're safeguarding sensitive documents, collaborating 
        privately with others, or storing large encrypted collections, KryptVault 
        takes care of the heavy lifting so you can focus on your work while knowing 
        your data remains safe, encrypted, and beautifully organized.
      </p>
    </div>
  );
}
