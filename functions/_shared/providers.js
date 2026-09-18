export const PROVIDERS = {
  google: {
    authEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenEndpoint: "https://oauth2.googleapis.com/token",
    discoveryUrl: "https://accounts.google.com/.well-known/openid-configuration",
    issuer: "https://accounts.google.com",
    scope: "openid email profile",
  },
  github: {
    authEndpoint: "https://github.com/login/oauth/authorize",
    tokenEndpoint: "https://github.com/login/oauth/access_token",
    userEndpoint: "https://api.github.com/user",
  },
};