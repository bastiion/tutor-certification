/** Branded wrapper so encoded strings cannot be mistaken for opaque UTF-8. */
export type Base64Url = string & { readonly __brand: "base64url" };
