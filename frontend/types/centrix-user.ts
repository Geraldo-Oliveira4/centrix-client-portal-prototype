export interface CentrixUser {
  email: string;
  name: string;
  roles: string[];
  last_login?: string | null;
  created_at?: string | null;
}

export interface CentrixPreRegisteredUser {
  email: string;
  role: string;
}
