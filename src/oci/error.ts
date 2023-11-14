import fetch from 'make-fetch-happen'

// Convoluted way of getting at the Response type used by make-fetch-happen
type Response = Awaited<ReturnType<typeof fetch>>

export class HTTPError extends Error {
  readonly statusCode: number

  constructor({ status, message }: { status: number; message: string }) {
    super(message)
    this.statusCode = status
  }
}

// Inspects the response status and throws an HTTPError if it does not match the
// expected status code
export const ensureStatus = (
  expectedStatus: number
): ((response: Response) => Response) => {
  return (response: Response): Response => {
    if (response.status !== expectedStatus) {
      throw new HTTPError({
        message: `Error fetching ${response.url} - expected ${expectedStatus}, received ${response.status}`,
        status: response.status
      })
    }
    return response
  }
}
