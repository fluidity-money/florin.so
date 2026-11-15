# Market pause periods

`market-pause-periods.json` is a portable array of `{ "start", "end", "reason" }`.
It is also served at `/market-pause-periods.json`. Timestamps are ISO 8601 with
explicit New York UTC offsets, inclusive start and exclusive end. Reasons are
plain text. Entries are sorted and non-overlapping.

Coverage: 2026 and 2027, sourced from `packUSMarketHours2026` and
`packUSMarketHours2027` in the sibling florin-contracts repository's
`contracts/script/EncodeMarketHours.s.sol`. This is the stock-token schedule:
Friday 20:00 to Sunday 20:00 New York weekend closure, full local-day holidays,
and 13:00-to-midnight early closes. It is NOT the NYSE core-session schedule.
Holiday explanations take precedence over weekend explanations. Weekend
periods are split where necessary. DST is reflected in each timestamp offset.

This data explains a pause only after the price feed reports one. It is not
proof of the deployed calendar and does not control transaction eligibility.
Unknown pauses and dates outside coverage use a generic pause message; no
reopening time is promised. Update the data when the protocol calendar changes
or coverage needs extending; importing JSON into the app requires a rebuild.
Do not roll dates forward automatically: observed holidays move between years.
