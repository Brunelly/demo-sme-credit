// The API's contract: what each endpoint accepts and returns. apps/api validates requests with these schemas;
// apps/web imports the types, so both sides change together. Add a file per feature and export it here.
export * from "./errors.ts";
export * from "./health.ts";
export * from "./assistant.ts";
export * from "./applications.ts";
