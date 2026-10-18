/** USD per million UTF-8 bytes on Fish Audio paid TTS models. */
export const PAID_TTS_USD_PER_MILLION_BYTES = 15;

/** The credit budget this demo was designed around. */
export const CREDIT_BUDGET_USD = 20;

export function utf8Bytes(text: string): number {
  return new TextEncoder().encode(text).length;
}

export function estimateUsd(model: string, bytes: number): number {
  if (model === "s2.1-pro-free") return 0;
  if (!Number.isFinite(bytes) || bytes <= 0) return 0;
  return (bytes / 1_000_000) * PAID_TTS_USD_PER_MILLION_BYTES;
}

export function formatUsd(amount: number): string {
  if (amount === 0) return "$0.00";
  if (amount < 0.01) return `$${amount.toFixed(4)}`;
  return `$${amount.toFixed(2)}`;
}
