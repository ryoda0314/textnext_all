import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Generated RPC arg types are non-null even where SQL accepts null; mark intent explicitly. */
export function orNull<T>(value: T | null | undefined): T {
  return (value ?? null) as T;
}
