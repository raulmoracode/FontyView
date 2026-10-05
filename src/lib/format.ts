const NUMBER_FORMAT = new Intl.NumberFormat("en-US");

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "Not available";
  }
  return NUMBER_FORMAT.format(value);
}

export function formatMetric(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "Not available";
  }
  return NUMBER_FORMAT.format(value);
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) {
    return "Not available";
  }
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatFixed(
  value: number | null | undefined,
  decimals = 4,
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "Not available";
  }
  return value.toFixed(decimals);
}

export function orUnavailable(value: string | null | undefined): string {
  if (value === null || value === undefined) return "Not available";
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : "Not available";
}
