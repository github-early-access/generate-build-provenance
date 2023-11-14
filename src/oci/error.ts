import fetch from 'make-fetch-happen'

// Convoluted way of getting at the Response type used by make-fetch-happen
type Response = Awaited<ReturnType<typeof fetch>>

export class HTTPError extends Error {
  readonly statusCode: number

  constructor({ status, message }: { status: number; message: string }) {
    super(`(${status}) ${message}`)
    this.statusCode = status
  }
}

// Inspects the response status and throws an HTTPError if it is not 2xx
export const checkStatus = (response: Response): void => {
  if (response.ok) {
    return
  }

  throw new HTTPError({
    message: `OCI API: ${response.statusText}`,
    status: response.status
  })
}
