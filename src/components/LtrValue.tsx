/**
 * Wraps LTR content (times, emails, codes, dates) inside RTL pages.
 * Prevents visual reversal of technical values in Arabic UI.
 */
export function LtrValue({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <bdi dir="ltr" className={className}>
      {children}
    </bdi>
  );
}

/**
 * Displays a time range in LTR order (e.g. "08:00 – 16:00").
 */
export function TimeRange({
  start,
  end,
  className,
}: {
  start: string;
  end: string;
  className?: string;
}) {
  return (
    <bdi dir="ltr" className={className}>
      {start} – {end}
    </bdi>
  );
}

/**
 * Displays a duration in locale-aware format.
 */
export function Duration({
  minutes,
  locale,
  className,
}: {
  minutes: number;
  locale?: string;
  className?: string;
}) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (locale === "ar") {
    return (
      <bdi dir="ltr" className={className}>
        {h > 0 ? `${h} ساعة` : ""}
        {h > 0 && m > 0 ? " " : ""}
        {m > 0 ? `${m} دقيقة` : ""}
      </bdi>
    );
  }
  return (
    <bdi dir="ltr" className={className}>
      {h > 0 ? `${h}h` : ""}
      {h > 0 && m > 0 ? " " : ""}
      {m > 0 ? `${m}m` : ""}
    </bdi>
  );
}
