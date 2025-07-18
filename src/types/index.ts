export interface Message {
  id: string;
  user_id: string;
  source: string;
  sender: string;
  content: string;
  timestamp: string;
  tags: string[];
  channel: string | null;
  is_thread: boolean;
  thread_parent_preview: string | null;
  is_dm: boolean;
  participants: string[] | null;
  subject: string;
  gmail_id?: string;
  created_at?: string;
  // Add camelCase versions for compatibility
  isThread?: boolean;
  isDM?: boolean;
  threadParentPreview?: string | null;
}

export interface List {
  id: string;
  name: string;
  user_id: string;
  created_at: string;
}

export interface User {
  id: string;
  email: string;
  gmail_refresh_token?: string;
}

export interface Filter {
  source: string;
  tag: string;
}

export interface ActionStepIndex {
  [key: string]: number;
}

export interface MockActionItems {
  [key: string]: string[];
} 