// useOnlineStatus.ts — REMOVED.
//
// Previously this hook fired a `fetch(url, { mode: 'no-cors' })` HEAD
// probe for *every* LinkCard on page load, with a 3-second timeout.
// That translated into N concurrent network requests (one per link)
// that blocked page interactivity until every reachable service answered
// and every unreachable one timed out. It was the single largest
// contributor to slow page load.
//
// Replaced with a fire-and-forget click-through: the user opens the
// link directly and we record the click via POST /api/links/:id/click.
// The red/green status dot has been removed from LinkCard.