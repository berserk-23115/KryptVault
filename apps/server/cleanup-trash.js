#!/usr/bin/env node
/**
 * Trash Cleanup Script
 * 
 * This script can be run as a cron job to automatically delete expired files from trash.
 * 
 * Usage:
 *   node cleanup-trash.js
 * 
 * Environment variables:
 *   SERVER_URL - The base URL of the server (default: http://localhost:3000)
 *   CLEANUP_API_KEY - Optional API key for authentication
 * 
 * Example cron job (runs daily at 2 AM):
 *   0 2 * * * cd /path/to/server && node cleanup-trash.js >> /var/log/trash-cleanup.log 2>&1
 */

const SERVER_URL = process.env.SERVER_URL || "http://localhost:3000";
const CLEANUP_API_KEY = process.env.CLEANUP_API_KEY;

async function cleanupTrash() {
  console.log(`[${new Date().toISOString()}] Starting trash cleanup...`);
  
  try {
    const headers = {
      "Content-Type": "application/json",
    };
    
    if (CLEANUP_API_KEY) {
      headers["x-api-key"] = CLEANUP_API_KEY;
    }
    
    const response = await fetch(`${SERVER_URL}/api/files/cleanup`, {
      method: "POST",
      headers,
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `HTTP ${response.status}`);
    }
    
    const result = await response.json();
    
    console.log(`[${new Date().toISOString()}] Cleanup completed:`);
    console.log(`  - Total files found: ${result.total}`);
    console.log(`  - Successfully deleted: ${result.deleted}`);
    console.log(`  - Errors: ${result.errors}`);
    
    if (result.errors > 0) {
      process.exit(1); // Exit with error code if there were failures
    }
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Cleanup failed:`, error.message);
    process.exit(1);
  }
}

// Run the cleanup
cleanupTrash().catch((error) => {
  console.error(`[${new Date().toISOString()}] Unexpected error:`, error);
  process.exit(1);
});
