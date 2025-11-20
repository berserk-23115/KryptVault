import { createFileRoute, redirect } from '@tanstack/react-router';
import { authClient } from "@/lib/auth-client";
import React from "react";
import { filesApi, type FileMetadata } from "@/lib/files-api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { 
  Trash2, 
  RotateCcw, 
  AlertTriangle, 
  FileText, 
  Clock,
  RefreshCw 
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute('/dashboard/trash-bin')({
  component: RouteComponent,
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session.data) {
      redirect({ to: "/login", throw: true });
    }
    return { session };
  },
});

function RouteComponent() {
  const [files, setFiles] = React.useState<FileMetadata[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [selectedFile, setSelectedFile] = React.useState<FileMetadata | null>(null);

  const loadTrash = async () => {
    try {
      setLoading(true);
      setError(null);
      const trashedFiles = await filesApi.listTrash();
      
      // Normalize the files - ensure id is set from fileId
      const normalizedFiles = trashedFiles.map((file) => ({
        ...file,
        id: file.fileId || file.id,
      }));
      
      setFiles(normalizedFiles);
    } catch (err) {
      console.error("Failed to load trash:", err);
      setError(err instanceof Error ? err.message : "Failed to load trash");
      toast.error("Failed to load trash");
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    loadTrash();
  }, []);

  const handleRestore = async (file: FileMetadata) => {
    try {
      await filesApi.restoreFile(file.id);
      toast.success(`"${file.originalFilename}" restored successfully`);
      loadTrash(); // Reload trash
    } catch (err) {
      console.error("Failed to restore file:", err);
      toast.error("Failed to restore file");
    }
  };

  const handlePermanentDelete = async (file: FileMetadata) => {
    try {
      await filesApi.permanentlyDeleteFile(file.id);
      toast.success(`"${file.originalFilename}" permanently deleted`);
      setDeleteDialogOpen(false);
      setSelectedFile(null);
      loadTrash(); // Reload trash
    } catch (err) {
      console.error("Failed to delete file:", err);
      toast.error("Failed to delete file");
    }
  };

  const formatDate = (date?: Date) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  };

  const getDaysUntilDeletion = (scheduledDate?: Date) => {
    if (!scheduledDate) return null;
    const now = new Date();
    const scheduled = new Date(scheduledDate);
    const diff = scheduled.getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days > 0 ? days : 0;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertTriangle className="h-12 w-12 text-destructive" />
        <p className="text-muted-foreground">{error}</p>
        <Button onClick={loadTrash}>Try Again</Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Trash Bin</h1>
          <p className="text-muted-foreground mt-1">
            Files will be automatically deleted after the retention period
          </p>
        </div>
        <Button onClick={loadTrash} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {files.length === 0 ? (
        <Card className="p-12">
          <div className="flex flex-col items-center justify-center text-center gap-4">
            <Trash2 className="h-16 w-16 text-muted-foreground/50" />
            <div>
              <h3 className="text-lg font-semibold">Trash is empty</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Deleted files will appear here
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4">
          {files.map((file) => {
            const daysUntilDeletion = getDaysUntilDeletion(file.scheduledDeletionAt);
            
            return (
              <Card key={file.id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="mt-1">
                      <FileText className="h-10 w-10 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate">
                        {file.originalFilename}
                      </h3>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
                        <span>{formatFileSize(file.fileSize)}</span>
                        <span>•</span>
                        <span>Deleted: {formatDate(file.deletedAt)}</span>
                        {daysUntilDeletion !== null && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {daysUntilDeletion === 0 
                                ? "Deleting soon" 
                                : `${daysUntilDeletion} day${daysUntilDeletion !== 1 ? 's' : ''} until deletion`}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleRestore(file)}
                      variant="outline"
                      size="sm"
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Restore
                    </Button>
                    <Button
                      onClick={() => {
                        setSelectedFile(file);
                        setDeleteDialogOpen(true);
                      }}
                      variant="destructive"
                      size="sm"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Forever
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Permanently Delete File?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete "{selectedFile?.originalFilename}"? 
              This action cannot be undone and the file will be lost forever.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedFile && handlePermanentDelete(selectedFile)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Forever
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

