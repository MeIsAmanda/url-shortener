# Recent snips in this browser

Sniply keeps the **latest 20 successful creations**, newest first. The collection sits beside the tool at viewport widths of 1,000px and above, and below it at smaller widths. Each entry offers its short link, original destination preview, saved date, Copy, and Remove. Clear history removes the collection from this browser.

The desktop history column is 340px wide to fit typical short links on one line, including localhost links with longer codes. Narrow screens and unusually long custom hostnames can still wrap links to prevent horizontal overflow.

At desktop sizes of at least 1,000×700px, the normal tool/result view fits the viewport and the history list owns the scrolling. The illustration scales to the available height while the editable field stays readable and aligned with the scissors. Smaller or zoomed windows use normal page scrolling with no nested history scrollbar, so content remains reachable.

## How it works

1. The existing POST creates a real mapping in the backend database.
2. After success, React displays the result and adds its original URL, short URL, and a browser-generated timestamp to recent snips. Invalid input and failed requests are not saved.
3. The collection is serialized with `JSON.stringify` into `localStorage` under `sniply.recent-snips.v1`.
4. On the next page load, React reads that key, parses the JSON, validates each record, and displays the collection without requesting a backend history endpoint.
5. New entries replace an existing entry with the same short URL, otherwise prepend a new item. The oldest entry is dropped beyond 20. Separate short codes for the same destination remain separate entries.

This is persistent browser history, not the backend's redirect lookup cache. Opening a short link still uses the backend mapping. Removing an entry or clearing this history never sends a delete request and never deletes a database row. Clearing the backend database can leave stale entries in browser history; no availability check or automatic link repair is performed.

## localStorage and cookies

The list uses localStorage, not cookies. localStorage is a browser key/value store; its string values survive normal reloads and browser sessions. Cookies are included in matching HTTP requests, whereas this collection is not automatically attached to requests. The original destination still goes to the backend when creating a short link as before. This implementation makes no claim about TinyURL's current internal storage mechanism.

The browser scopes the collection to the frontend's origin: scheme, hostname, and port. `localhost:5173`, `localhost:4173`, and `127.0.0.1:4173` have separate collections. It does not follow the user to another device or browser profile. Clearing site data removes it; private browsing normally removes it after the private session ends. This is not an account-based backup.

People using the same browser profile can see this collection, including saved destinations and query strings. Individual Remove and Clear history actions provide control over what remains locally. There is no automatic time-based expiry; the 20-entry cap, explicit removal, or browser/site-data cleanup removes entries.

See [MDN localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage) and [Using Web Storage](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API/Using_the_Web_Storage_API) for the browser API.

## Failure handling and rendering

- Broken JSON or invalid records are ignored. Restored short URLs must be HTTP(S), without embedded credentials. The UI renders stored destinations as plain text rather than HTML.
- If storage is blocked or a write fails, shortening still succeeds. React retains the collection in memory for the current page and explains that new entries may not survive a reload.
- A failed persistent clear gets its own message and retry action; the UI does not claim that old stored entries have disappeared permanently.
- Changes in another tab at the same origin update the collection through the storage event. This is a convenience list, with no transactional guarantee for simultaneous writes from multiple tabs.
- Storage writes occur only when the collection changes. The history component is memoized so typing in the main field does not rerender the whole collection. Desktop lists scroll when long; mobile uses the page's normal vertical flow. Each history card contains its own absolutely positioned screen-reader status text, preventing offscreen messages from extending the outer page height.

## Code and tests

Read `frontend/src/snipHistory.js` for parsing/bounds and the storage key, `useSnipHistory.js` for browser persistence and React state, `RecentSnips.jsx` for the collection UI, then `App.jsx` for the successful-creation integration. Responsive layout rules live in `styles.css`.

Tests cover restore-after-reload, newest-first ordering, deduplication/eviction, failed requests, blocked/full storage, malformed saved data, copying, removal/clear, cross-tab updates, and a clear while creation is in flight. Browser checks assert desktop-side/mobile-bottom geometry and no overflow. The live check verifies a cleared history entry still redirects through the real backend.

See [testing.md](testing.md) for commands and [verification.md](verification.md) for observed results. No backend schema or API changes are needed for this feature.
