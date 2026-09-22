import 'server-only';
import { z } from 'zod';

const envSchema = z.object({
  /** mysql://user:password@host:3306/database. Use a read-only user (see db/readonly-user.sql). */
  DATABASE_URL: z.url({ protocol: /^mysql$/ }),
  DATABASE_POOL_SIZE: z.coerce.number().int().min(1).max(50).default(5),
  DATABASE_QUERY_TIMEOUT_MS: z.coerce.number().int().min(500).max(60_000).default(8_000),
  /**
   * The CMS marks each train RUN (`IsOperation = 1`) or CANCELED (`2`). Public search shows RUN
   * trains only; set to `true` to include CANCELED ones as well (for checking data).
   */
  INCLUDE_CANCELED_TRAINS: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

/** Validated server configuration. Throws a clear error if the deployment is misconfigured. */
export function getEnv(): Env {
  if (!cached) {
    const parsed = envSchema.safeParse(process.env);
    if (!parsed.success) {
      // Report which variables are wrong, never their values (DATABASE_URL holds a password).
      const fields = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ');
      throw new Error(`Invalid server configuration (${fields}). See .env.example.`);
    }
    cached = parsed.data;
  }
  return cached;
}
