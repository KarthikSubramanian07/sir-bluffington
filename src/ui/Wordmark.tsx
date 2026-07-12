/** The brand lockup: a Victorian serif name over a spaced mono label. */
export function Wordmark({ size = "md" }: { size?: "sm" | "md" }) {
  return (
    <span className={`wordmark wordmark--${size}`}>
      <span className="wordmark-name serif">Sir Bluffington's</span>
      <span className="wordmark-sub num">POKER</span>
    </span>
  );
}
