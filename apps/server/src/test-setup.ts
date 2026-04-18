// This runs before any test file is imported.
// Setting env vars here ensures config.ts sees them when modules are first loaded.
process.env['DATABASE_URL'] = 'postgres://test:test@localhost/test'
process.env['GOOGLE_CLIENT_ID'] = 'test-client-id'
process.env['GOOGLE_CLIENT_SECRET'] = 'test-client-secret'
process.env['JWT_SECRET'] = 'test-jwt-secret-that-is-long-enough-32chars'
process.env['JWT_REFRESH_SECRET'] = 'test-refresh-secret-that-is-long-32c'
