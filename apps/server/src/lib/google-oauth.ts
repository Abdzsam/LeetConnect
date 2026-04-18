import { Google } from 'arctic'
import { config } from '../config.js'

// The redirect URI is the backend's callback endpoint.
// The extension sends its own chromiumapp.org redirect as a state parameter.
export const google = new Google(
  config.googleClientId,
  config.googleClientSecret,
  `http://localhost:${config.port}/auth/google/callback`,
)
