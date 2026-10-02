import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config(); // fallback to cwd

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3001').transform(Number),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
  JWT_SECRET: z.string().default('serp-scout-secret-jwt-key-2026-production'),
  CLERK_SECRET_KEY: z.string().optional(),
  CLERK_PUBLISHABLE_KEY: z.string().optional(),
  CLERK_FRONTEND_API_URL: z.string().optional(),
  CLERK_API_URL: z.string().optional(),
  CLERK_JWKS_URL: z.string().optional(),
  CLERK_JWT_KEY: z.string().optional(),
  CLERK_WEBHOOK_SECRET: z.string().optional(),
  SERPAPI_KEY: z.string().min(1, 'SERPAPI_KEY is required'),
  TAVILY_API_KEY: z.string().optional(),
  GROQ_API_KEY: z.string().min(1, 'GROQ_API_KEY is required'),
  // Must stay in sync with DEFAULT_GROQ_MODEL in @serp-scout/agents, which reads
  // process.env.GROQ_MODEL directly. Agents cannot import this module (it lives
  // in the app layer), so the two defaults are kept identical by convention.
  GROQ_MODEL: z.string().default('openai/gpt-oss-120b'),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default('noreply@serp-scout.app'),
  FRONTEND_URL: z.string().default('http://localhost:3000'),
  DEFAULT_MONTHLY_QUOTA: z.string().default('500').transform(Number),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.format());
  throw new Error('Environment variable validation failed');
}

export const env = parsed.data;
