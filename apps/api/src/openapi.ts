import { z } from 'zod';
import {
  AttemptRequestSchema,
  AttemptResponseSchema,
  LeaderboardSchema,
  LessonProgressDtoSchema,
  LoginRequestSchema,
  ProgressSyncRequestSchema,
  ProgressSyncResponseSchema,
  RegisterRequestSchema,
  StatsSchema,
  UserSchema,
} from '@tamreen/shared';

type Operation = {
  method: 'get' | 'post' | 'delete';
  path: string;
  summary: string;
  auth?: boolean;
  body?: z.ZodType;
  response?: z.ZodType;
  status?: number;
};

const ErrorSchema = z.object({
  error: z.object({ code: z.string(), message: z.string(), details: z.unknown().optional() }),
});

const operations: Operation[] = [
  { method: 'get', path: '/health', summary: 'Liveness and database check' },
  {
    method: 'post',
    path: '/auth/register',
    summary: 'Create an account and sign in',
    body: RegisterRequestSchema,
    response: UserSchema,
    status: 201,
  },
  {
    method: 'post',
    path: '/auth/login',
    summary: 'Sign in (sets httpOnly cookies)',
    body: LoginRequestSchema,
    response: UserSchema,
  },
  {
    method: 'post',
    path: '/auth/refresh',
    summary: 'Rotate the refresh token',
    response: UserSchema,
  },
  { method: 'post', path: '/auth/logout', summary: 'Sign out', status: 204 },
  { method: 'get', path: '/me', summary: 'The signed-in user', auth: true, response: UserSchema },
  {
    method: 'delete',
    path: '/me',
    summary: 'Delete the account and all its data',
    auth: true,
    status: 204,
  },
  {
    method: 'get',
    path: '/me/progress',
    summary: 'Progress per lesson',
    auth: true,
    response: z.array(LessonProgressDtoSchema),
  },
  {
    method: 'get',
    path: '/me/stats',
    summary: 'Points, streak and accuracy',
    auth: true,
    response: StatsSchema,
  },
  { method: 'get', path: '/tracks', summary: 'Tracks in curriculum order' },
  { method: 'get', path: '/lessons', summary: 'Lessons, optionally of one track (?track=)' },
  { method: 'get', path: '/lessons/{slug}', summary: 'A lesson with its steps' },
  {
    method: 'post',
    path: '/attempts',
    summary: 'Check an answer on the server and award points',
    auth: true,
    body: AttemptRequestSchema,
    response: AttemptResponseSchema,
  },
  {
    method: 'post',
    path: '/progress/sync',
    summary: 'Merge guest progress into the account',
    auth: true,
    body: ProgressSyncRequestSchema,
    response: ProgressSyncResponseSchema,
  },
  {
    method: 'get',
    path: '/leaderboard/daily',
    summary: "Today's top learners (?limit=1..50)",
    response: LeaderboardSchema,
  },
];

const schema = (s: z.ZodType, io: 'input' | 'output') =>
  z.toJSONSchema(s, { io, unrepresentable: 'any' }) as Record<string, unknown>;

/** OpenAPI 3.1 document generated from the same zod schemas the routes validate with. */
export function openApiDocument() {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const op of operations) {
    const status = String(op.status ?? 200);
    paths[`/api${op.path}`] ??= {};
    paths[`/api${op.path}`]![op.method] = {
      summary: op.summary,
      ...(op.auth ? { security: [{ cookieAuth: [] }] } : {}),
      ...(op.body
        ? {
            requestBody: {
              required: true,
              content: { 'application/json': { schema: schema(op.body, 'input') } },
            },
          }
        : {}),
      responses: {
        [status]: op.response
          ? {
              description: 'OK',
              content: { 'application/json': { schema: schema(op.response, 'output') } },
            }
          : { description: 'OK' },
        default: {
          description: 'Error',
          content: { 'application/json': { schema: schema(ErrorSchema, 'output') } },
        },
      },
    };
  }
  return {
    openapi: '3.1.0',
    info: { title: 'Tamreen API', version: '0.4.0' },
    components: {
      securitySchemes: { cookieAuth: { type: 'apiKey', in: 'cookie', name: 'tamreen_at' } },
    },
    paths,
  };
}
