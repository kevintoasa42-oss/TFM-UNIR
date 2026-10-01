/** Application failures retain the API's established status and public message. */
export class ApplicationError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
