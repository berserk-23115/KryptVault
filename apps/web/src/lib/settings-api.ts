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

export interface SecurityQuestion {
  id: string;
  question: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AddSecurityQuestionRequest {
  question: string;
  answer: string;
}

export interface VerifySecurityAnswerRequest {
  questionId: string;
  answer: string;
}

export interface RecoveryQuestionsResponse {
  questions: Array<{ id: string; question: string }>;
  userId?: string;
  message?: string;
}

export interface VerifyRecoveryAnswersRequest {
  email: string;
  answers: Array<{ questionId: string; answer: string }>;
}

export interface VerifyRecoveryAnswersResponse {
  verified: boolean;
  recoveryToken: string;
  expiresAt: Date;
}

export interface ResetPasswordRequest {
  email: string;
  newPassword: string;
  recoveryToken: string;
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

    // Try to get bearer token from localStorage first
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("bearer_token");
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
    }

    try {
      const url = `${this.baseUrl}/api/settings${endpoint}`;
      console.log("🔄 Settings API Request:", { 
        url, 
        method: options.method || "GET",
        headers: { ...headers, Authorization: headers.Authorization ? "Bearer ***" : undefined }
      });

      const response = await fetch(url, {
        ...options,
        headers,
        credentials: "include",
      });

      const data = await response.json().catch(() => ({ error: "Failed to parse response" }));

      if (!response.ok) {
        console.error("❌ Settings API Error:", { 
          status: response.status, 
          error: data 
        });
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      console.log("✅ Settings API Success:", data);
      return data;
    } catch (error) {
      console.error("❌ Settings API Request Error:", error);
      throw error;
    }
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

  /**
   * Get security questions
   */
  async getSecurityQuestions(): Promise<SecurityQuestion[]> {
    const response = await this.request<{ questions: SecurityQuestion[] }>(
      "/security-questions"
    );
    return response.questions;
  }

  /**
   * Add a security question
   */
  async addSecurityQuestion(
    data: AddSecurityQuestionRequest
  ): Promise<SecurityQuestion> {
    const response = await this.request<{ question: SecurityQuestion; success: boolean }>(
      "/security-questions",
      {
        method: "POST",
        body: JSON.stringify(data),
      }
    );
    return response.question;
  }

  /**
   * Verify a security answer
   */
  async verifySecurityAnswer(
    data: VerifySecurityAnswerRequest
  ): Promise<boolean> {
    const response = await this.request<{ verified: boolean }>(
      "/security-questions/verify",
      {
        method: "POST",
        body: JSON.stringify(data),
      }
    );
    return response.verified;
  }

  /**
   * Delete a security question
   */
  async deleteSecurityQuestion(questionId: string): Promise<void> {
    await this.request<{ success: boolean }>(
      `/security-questions/${questionId}`,
      {
        method: "DELETE",
      }
    );
  }

  /**
   * Get security questions for password recovery (no auth required)
   */
  async getRecoveryQuestions(email: string): Promise<RecoveryQuestionsResponse> {
    const response = await this.request<RecoveryQuestionsResponse>(
      "/recovery/questions",
      {
        method: "POST",
        body: JSON.stringify({ email }),
      }
    );
    return response;
  }

  /**
   * Verify recovery answers (no auth required)
   */
  async verifyRecoveryAnswers(
    data: VerifyRecoveryAnswersRequest
  ): Promise<VerifyRecoveryAnswersResponse> {
    const response = await this.request<VerifyRecoveryAnswersResponse>(
      "/recovery/verify",
      {
        method: "POST",
        body: JSON.stringify(data),
      }
    );
    return response;
  }

  /**
   * Reset password using recovery token (no auth required)
   */
  async resetPasswordWithToken(data: ResetPasswordRequest): Promise<void> {
    await this.request<{ success: boolean; message: string }>(
      "/recovery/reset-password",
      {
        method: "POST",
        body: JSON.stringify(data),
      }
    );
  }
}

export const settingsApi = new SettingsApiClient();
