import { NextResponse } from "next/server";
import type { ZodError, ZodSchema } from "zod";

/**
 * Parse and validate request body
 * @throws {NextResponse} Returns a NextResponse with 400 status if validation fails
 */
export function parseInput<T>(schema: ZodSchema<T>, body: unknown): T {
  const result = schema.safeParse(body);

  if (!result.success) {
    throw new ValidationError(result.error);
  }

  return result.data;
}

/**
 * Format Zod errors into user-friendly API error response
 */
export function formatZodError(error: ZodError): {
  error: string;
  details?: Array<{ field: string; message: string }>;
} {
  const details = error.issues.map((err) => ({
    field: err.path.join(".") || "root",
    message: err.message,
  }));

  return {
    error: "Validation failed",
    details,
  };
}

/**
 * Custom error class for validation errors
 * Can be caught and converted to NextResponse
 */
export class ValidationError extends Error {
  zodError: ZodError;

  constructor(zodError: ZodError) {
    super("Validation failed");
    this.name = "ValidationError";
    this.zodError = zodError;
  }

  toResponse(): NextResponse {
    const formatted = formatZodError(this.zodError);
    return NextResponse.json(formatted, { status: 400 });
  }
}

/**
 * Wrapper for API route handlers to catch validation errors
 * Usage: wrapHandler(async (req) => { ... })
 */
export function wrapHandler(
  handler: (request: Request, context?: unknown) => Promise<NextResponse>
) {
  return async (request: Request, context?: unknown): Promise<NextResponse> => {
    try {
      return await handler(request, context);
    } catch (error) {
      if (error instanceof ValidationError) {
        return error.toResponse();
      }
      throw error;
    }
  };
}
