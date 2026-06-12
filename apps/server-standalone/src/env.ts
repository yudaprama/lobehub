import { z } from 'zod';

const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3210),

  // CORS
  CORS_ORIGIN: z.string().default('*'),

  // Database
  DATABASE_URL: z.string().url(),
  DATABASE_DRIVER: z.enum(['postgresql', 'mysql']).default('postgresql'),

  // Redis (optional)
  REDIS_URL: z.string().url().optional(),

  // Authentication
  KEY_VAULTS_SECRET: z.string().min(32),
  JWT_SECRET: z.string().min(32).optional(),

  // S3 / File Storage (optional)
  S3_ENDPOINT: z.string().url().optional(),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_PUBLIC_DOMAIN: z.string().optional(),

  // OpenAI (optional)
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_PROXY_URL: z.string().url().optional(),

  // Anthropic (optional)
  ANTHROPIC_API_KEY: z.string().optional(),

  // Google (optional)
  GOOGLE_API_KEY: z.string().optional(),

  // Proxy (optional)
  PROXY_URL: z.string().url().optional(),
  ENABLE_PROXY_DNS: z.coerce.number().min(0).max(1).default(0),

  // QStash (optional)
  QSTASH_URL: z.string().url().optional(),
  QSTASH_TOKEN: z.string().optional(),
  APP_URL: z.string().url().optional(),

  // Debug
  DEBUG: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

let env: Env | null = null;

export const getEnv = (): Env => {
  if (!env) {
    try {
      env = envSchema.parse(process.env);
      console.info('✅ Environment variables validated');
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error('❌ Environment validation failed:');
        console.error(error.errors.map((e) => `  - ${e.path.join('.')}: ${e.message}`).join('\n'));
        process.exit(1);
      }
      throw error;
    }
  }
  return env;
};
