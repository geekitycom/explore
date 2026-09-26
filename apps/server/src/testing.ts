import { DEFAULT_AVATAR } from '@explore/core';
import type { User } from './users.ts';

/** An account as a world sees it: an id and a name, with no users table behind them. */
export const userNamed = (id: number, username: string): User => ({
  id,
  username,
  avatar: DEFAULT_AVATAR,
  avatarChosen: true,
});
