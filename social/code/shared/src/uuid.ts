
export type UUID = string & { readonly __brand: unique symbol };

export function isValidUuid(value: string): value is UUID {
  // Use a regex or a library function to perform actual validation
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

export function createUUID(id: string): UUID {
    if (!isValidUuid(id)) {
        throw new Error('Invalid UUID format');
    }
    return id as UUID;
}