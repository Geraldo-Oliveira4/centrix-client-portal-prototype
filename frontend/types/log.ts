export type LogStatus = 'SUCCESS' | 'ERROR';

export type LogActionType =
  // User Management
  | 'USER_CREATED'
  | 'USER_DELETED'
  | 'USER_ROLE_CHANGED'
  | 'USER_PASSWORD_RESET'
  | 'PRE_REGISTER_ADDED'
  | 'PRE_REGISTER_REMOVED'

  // Authentication
  | 'USER_LOGIN'
  | 'USER_LOGOUT'

  // Extraction Lifecycle
  | 'EXTRACTION_CREATED'
  | 'EXTRACTION_UPDATED'
  | 'EXTRACTION_APPROVED'
  | 'EXTRACTION_REJECTED'
  | 'EXTRACTION_DELETED'

  // Extraction Details
  | 'FIELD_UPDATED'
  | 'COMMENT_ADDED'
  | 'DOCUMENT_UPLOADED'
  | 'DOCUMENT_DELETED'

  // Integrations
  | 'AIRTABLE_SYNC_SUCCESS'
  | 'AIRTABLE_SYNC_FAILED'

  // System
  | 'SETTINGS_UPDATED';

export interface LogEntry {
  logId: string; // UUID
  timestamp: string; // ISO8601
  actionType: LogActionType; // Action enum
  status: LogStatus; // SUCCESS | ERROR
  userId: string; // User email (ID)
  userEmail: string; // User email (explicit)
  userName: string; // User display name
  message: string; // Always present description
  details: Record<string, any>; // Action-specific data
}

export interface LogFilters {
  actionType?: LogActionType;
  status?: LogStatus;
  userId?: string;
  startDate?: string;
  endDate?: string;
  lastDays?: number;
  limit?: number;
  lastEvaluatedKey?: string;
}

export interface LogsResponse {
  items: LogEntry[];
  lastEvaluatedKey?: string;
  total: number;
}
