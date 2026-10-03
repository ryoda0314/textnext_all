/** Native share sheet when available, otherwise copy to clipboard. Returns "copied" | "shared" | "cancelled". */
export async function shareOrCopy(data: { title: string; text: string; url: string }) {
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share(data);
      return "shared" as const;
    } catch (error) {
      if ((error as Error).name === "AbortError") return "cancelled" as const;
    }
  }
  await navigator.clipboard.writeText(`${data.text}\n${data.url}`);
  return "copied" as const;
}
