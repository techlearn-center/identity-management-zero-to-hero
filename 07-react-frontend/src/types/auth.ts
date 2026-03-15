export interface Auth0User {
  sub: string;
  name: string;
  email: string;
  email_verified: boolean;
  picture: string;
  updated_at: string;
  [key: string]: unknown;
}

export interface TokenClaims {
  iss: string;
  sub: string;
  aud: string | string[];
  exp: number;
  iat: number;
  permissions?: string[];
  scope?: string;
}
