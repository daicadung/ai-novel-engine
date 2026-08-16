import { z } from 'zod';

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(), // No longer strictly required for basic boot
  NINE_ROUTER_API_KEY: z.string().optional(),
});

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL"),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required"),
});

export function validateEnv() {
  const isServer = typeof window === 'undefined';

  // Read statically from process.env for the client
  const clientEnv = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  };

  const parsedClient = clientSchema.safeParse(clientEnv);
  
  if (!parsedClient.success) {
    throw new Error(`Invalid client environment variables: ${parsedClient.error.message}`);
  }

  let serverVars = {};
  if (isServer) {
    // We pass process.env here strictly because it's the server
    const parsedServer = serverSchema.safeParse(process.env);
    if (!parsedServer.success) {
      throw new Error(`Invalid server environment variables: ${parsedServer.error.message}`);
    }
    serverVars = parsedServer.data;
  }

  return {
    ...parsedClient.data,
    ...serverVars,
  } as z.infer<typeof clientSchema> & z.infer<typeof serverSchema>;
}

let _env: ReturnType<typeof validateEnv> | null = null;

export function getEnv() {
  if (!_env) {
    _env = validateEnv();
  }
  return _env;
}

export function resetEnv() {
  _env = null;
}
