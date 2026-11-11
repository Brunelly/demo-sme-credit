import type { z } from "zod";
import { ValidationError } from "../errors.ts";

/**
 * Checks a request's body, query or params against a schema from @app/contracts and returns the typed, cleaned
 * value (trimmed, defaults filled in). Throws a ValidationError (400) that lists each problem.
 *
 *   const input = parse(createOrderSchema, req.body);
 */
export function parse<Schema extends z.ZodType>(schema: Schema, value: unknown): z.output<Schema> {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  const details = result.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }));
  throw new ValidationError(details[0]?.message ?? "The request is not valid.", details);
}
