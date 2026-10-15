import { neon } from '@neondatabase/serverless';

/**
 * Vercel/Neon can expose the connection string under different names
 * depending on how the integration was connected. Prefer DATABASE_URL,
 * then fall back through the common Neon/Vercel names.
 */
const DATABASE_ENV_NAMES = [
  'DATABASE_URL',
  'POSTGRES_URL_NO_SSL',
  'POSTGRES_URL',
  'POSTGRES_PRISMA_URL',
  'POSTGRES_URL_NON_POOLING',
  'DATABASE_URL_UNPOOLED',
  'NEON_DATABASE_URL',
] as const;

export function getDatabaseUrl() {
  for (const name of DATABASE_ENV_NAMES) {
    const value = process.env[name];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

export function getDatabaseEnvStatus() {
  return DATABASE_ENV_NAMES.reduce<Record<string, boolean>>((result, name) => {
    result[name] = Boolean(process.env[name]?.trim());
    return result;
  }, {});
}

export function sqlClient() {
  const url = getDatabaseUrl();
  if (!url) {
    const status = getDatabaseEnvStatus();
    const detected = Object.entries(status).filter(([, present]) => present).map(([name]) => name);
    throw new Error(
      detected.length
        ? `A database variable was detected (${detected.join(', ')}), but its value could not be read.`
        : 'No Neon/Postgres connection variable is available to this Vercel server function. Redeploy the Production environment after connecting Neon to this project.'
    );
  }
  return neon(url);
}
