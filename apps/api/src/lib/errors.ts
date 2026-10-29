/** One error shape for every API response: `{ error: { code, message, details? } }`. */
export type ErrorBody = {
  error: { code: string; message: string; details?: unknown };
};

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }

  toBody(): ErrorBody {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details === undefined ? {} : { details: this.details }),
      },
    };
  }
}
