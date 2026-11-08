import type { User } from '../types';

export function getNameParts(user?: User | null) {
  if (user?.first_name != null || user?.last_name != null) {
    return { first_name: user.first_name ?? '', last_name: user.last_name ?? '' };
  }

  const fullName = user?.full_name?.trim() || '';
  const lastSpace = fullName.search(/\s+\S+$/);
  if (lastSpace === -1) {
    return { first_name: fullName, last_name: '' };
  }

  return {
    first_name: fullName.slice(0, lastSpace),
    last_name: fullName.slice(lastSpace).trim(),
  };
}
