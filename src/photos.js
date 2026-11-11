// Invoice photos. Each photo is saved apart from the accounts, under "photo:<entry id>",
// so the accounts stay small and fast. d.photos lists which entries have one.

export const photoKey = (entryId) => `photo:${entryId}`;

export function markPhoto(d, entryId) {
  d.photos = { ...(d.photos ?? {}), [entryId]: true };
}

export const hasPhoto = (d, entryId) => Boolean(d.photos?.[entryId]);
