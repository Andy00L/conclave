// Shared display formatting. Kept here so Header, ballot cards, and the
// treasury panel render addresses and times the same way.

export function shortenAddress(address: `0x${string}`): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// Seconds per unit, used to phrase how long until a ballot closes.
const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;
const SECONDS_PER_DAY = 86400;

/// Human phrasing for the time left until `endTimeSeconds` (unix seconds).
/// Returns undefined once the deadline has passed.
export function describeTimeLeft(endTimeSeconds: bigint, nowMilliseconds: number): string | undefined {
  const secondsLeft = Number(endTimeSeconds) - Math.floor(nowMilliseconds / 1000);
  if (secondsLeft <= 0) return undefined;
  if (secondsLeft < SECONDS_PER_MINUTE) return "less than a minute left";
  if (secondsLeft < SECONDS_PER_HOUR) {
    const minutes = Math.ceil(secondsLeft / SECONDS_PER_MINUTE);
    return `${minutes} min left`;
  }
  if (secondsLeft < SECONDS_PER_DAY) {
    const hours = Math.ceil(secondsLeft / SECONDS_PER_HOUR);
    return `${hours} h left`;
  }
  const days = Math.ceil(secondsLeft / SECONDS_PER_DAY);
  return `${days} d left`;
}

/// Absolute close time, shown next to the relative label. Short styles keep
/// the clock line one glance long (no seconds).
export function formatUnixTime(unixSeconds: bigint): string {
  return new Date(Number(unixSeconds) * 1000).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
}
