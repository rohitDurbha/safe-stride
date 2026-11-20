// Turn anything a catch block receives into text that is safe to show.
export function errorMessage(err: unknown, fallback = ""): string {
  if (err instanceof Error) return err.message || fallback;
  if (typeof err === "string") return err || fallback;
  if (
    err !== null &&
    typeof err === "object" &&
    "message" in err &&
    typeof (err as { message: unknown }).message === "string"
  ) {
    return (err as { message: string }).message || fallback;
  }
  return fallback;
}
