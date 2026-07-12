/** A compact chip denomination readout used for bets and the pot. */
export function Chips({ amount, tone = "default" }: { amount: number; tone?: "default" | "gold" }) {
  if (amount <= 0) return null;
  return (
    <span className={`chips chips--${tone}`}>
      <span className="chips-coin" aria-hidden="true" />
      <span className="num">{amount.toLocaleString("en-US")}</span>
    </span>
  );
}
