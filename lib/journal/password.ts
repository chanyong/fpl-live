/** bcrypt (used by GoTrue) only reads the first 72 bytes, so the limit is bytes, not characters (Korean = 3 bytes each). */
export const PASSWORD_MAX_BYTES = 72;

export const passwordBytes = (value: string) => new TextEncoder().encode(value).length;

export const passwordTooLong = (value: string) => passwordBytes(value) > PASSWORD_MAX_BYTES;
