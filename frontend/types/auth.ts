export interface UserSession {
  accessToken: string;
  refreshToken: string;
  accessTokenExpires: number;
  user: {
    email: string;
    name: string;
    roles: string[];
  };
}
