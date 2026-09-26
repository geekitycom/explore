import type { Avatar } from '@explore/core';

export type User = { id: number; username: string; avatar: Avatar };

export class ApiError extends Error {
  readonly code: string;
  readonly field: string | undefined;

  constructor(code: string, message: string, field?: string) {
    super(message);
    this.code = code;
    this.field = field;
  }
}

type ErrorBody = { error?: { code?: string; message?: string; field?: string } };

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    body: body === undefined ? null : JSON.stringify(body),
    credentials: 'same-origin',
  });
  if (response.status === 204) return undefined as T;
  const json = (await response.json().catch(() => ({}))) as T & ErrorBody;
  if (!response.ok) {
    const { code = 'error', message = 'Something went wrong', field } = json.error ?? {};
    throw new ApiError(code, message, field);
  }
  return json;
}

export async function fetchMe(): Promise<User | undefined> {
  try {
    return (await request<{ user: User }>('GET', '/api/me')).user;
  } catch (error) {
    if (error instanceof ApiError && error.code === 'unauthenticated') return undefined;
    throw error;
  }
}

export async function signup(username: string, password: string, avatar: Avatar): Promise<User> {
  return (await request<{ user: User }>('POST', '/api/signup', { username, password, avatar }))
    .user;
}

export async function login(username: string, password: string): Promise<User> {
  return (await request<{ user: User }>('POST', '/api/login', { username, password })).user;
}

export async function logout(): Promise<void> {
  await request<undefined>('POST', '/api/logout');
}

export async function updateAvatar(avatar: Avatar): Promise<User> {
  return (await request<{ user: User }>('PUT', '/api/me/avatar', { avatar })).user;
}

export type WorldMap = {
  layer: string;
  you: { layer: string; sx: number; sy: number };
  garden: { layer: string; sx: number; sy: number } | null;
  /** Named landmarks, at their signposts, in world tiles. */
  names: { x: number; y: number; name: string }[];
  screens: unknown[];
};

export async function fetchMap(): Promise<WorldMap> {
  return request<WorldMap>('GET', '/api/map');
}
