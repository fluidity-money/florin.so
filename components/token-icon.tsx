// Round token marks.
//
// SPY uses Robinhood's own token image, the same one the asset carries on
// CoinGecko, so it reads as the thing people already hold rather than as our
// rendering of it. It ships from /public instead of hotlinking, which keeps
// the icon alive if CoinGecko reorganises its asset paths.
//
// FUSD is the Florin mark, black on white, matching the header logo. It reuses
// the existing SVG as a CSS mask rather than being a second copy of the logo
// baked to a fixed hue.

export type TokenSymbol = 'SPY' | 'FUSD';

export function TokenIcon({
  symbol,
  size = 20,
}: {
  symbol: TokenSymbol;
  size?: number;
}) {
  const px = `${size}px`;

  if (symbol === 'SPY') {
    return (
      <img
        className="tok-icon"
        src="/spy-token.png"
        alt=""
        aria-hidden="true"
        width={size}
        height={size}
        style={{ width: px, height: px }}
      />
    );
  }

  return (
    <span
      className="tok-icon tok-icon--fusd"
      aria-hidden="true"
      style={{ width: px, height: px }}
    >
      <i style={{ width: `${Math.round(size * 0.52)}px`, height: `${Math.round(size * 0.6)}px` }} />
    </span>
  );
}

// Symbol with its mark, for pills, table cells and headings.
export function Token({
  symbol,
  size = 20,
  className = '',
}: {
  symbol: TokenSymbol;
  size?: number;
  className?: string;
}) {
  return (
    <span className={`tok ${className}`.trim()}>
      <TokenIcon symbol={symbol} size={size} />
      {symbol}
    </span>
  );
}
