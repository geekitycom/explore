import { DEFAULT_AVATAR } from '@explore/core';
import type { User } from './users.ts';

/**
 * An account as a world sees it, with no users table behind it. The username differs from the
 * display name so a test notices if the username reaches what other players see.
 */
export const userNamed = (id: number, displayName: string): User => ({
  id,
  username: `login${id}`,
  displayName,
  avatar: DEFAULT_AVATAR,
  avatarChosen: true,
});
