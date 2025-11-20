const API_BASE_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:3000";

export interface UserSettings {
  id: string;
  userId: string;
  trashRetentionDays: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpdateSettingsRequest {
  trashRetentionDays: number;
}

class SettingsApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    // Add bearer token for authentication
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("bearer_token");
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
    }

    const response = await fetch(`${this.baseUrl}/api/settings${endpoint}`, {
      ...options,
      headers,
      credentials: "include",
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  /**
   * Get user settings
   */
  async getSettings(): Promise<UserSettings> {
    const response = await this.request<{ settings: UserSettings }>("/");
    return response.settings;
  }

  /**
   * Update user settings
   */
  async updateSettings(
    data: UpdateSettingsRequest
  ): Promise<UserSettings> {
    const response = await this.request<{ settings: UserSettings; success: boolean }>(
      "/",
      {
        method: "PATCH",
        body: JSON.stringify(data),
      }
    );
    return response.settings;
  }
}

export const settingsApi = new SettingsApiClient();
