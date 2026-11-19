# Roadtower — shared instructions for Gemini CLI and AI reviewers

Roadtower is a browser-based, offline-first map/radio companion deployed from this GitHub repository to Cloudflare Pages, currently at https://roadtower.pages.dev/roadtower.html .

## Collaboration workflow
- This repository is the shared source of truth for Gemini CLI, ChatGPT and the owner. Neither model automatically reads the other model's chat.
- Read the **current** files before proposing changes. In particular, check `roadtower.html`, `repeaters.js`, `panel-layout.js`, `gmrs-directory.json`, and `sw.js`.
- **Do not push directly onto the production branch** when working as a second reviewer. Prefer a new branch and a PR for user review. Do not overwrite changes another contributor just made.
- Review and test JavaScript syntax, runtime events, map markers, and mobile/touch behavior. Explain observable behavior, possible risks and test steps. Never claim a real phone or antenna site was verified unless evidence exists.
- Never put API keys, GPS coordinates from a person's real current location, tokens, or other sensitive data in issues, code, or logs.
- Preserve accessible, touch-friendly controls for a phone or foldable device. Offline data must remain available when the network drops.
- The local map tiles require internet unless separately available; the repeater data cache and map road-data packs are separate features.

## Highest-priority requirements
1. **At each launch**, display BOTH amateur/ham and GMRS repeater listings on one Leaflet map, without requiring a manual radio-mode choice. HAM dots green, KC Wide markers gold, GMRS dots purple. Avoid a saved HAM-only selection hiding GMRS at startup.
2. Start a live geolocation watch automatically on launch when the browser permits it. If permission is denied or GPS is unavailable, give a clear status and allow retry; never fake a GPS fix.
3. Display the user's marker only at actual browser GPS coordinates with a bright multicolor **visual** SOS rhythm (••• ——— •••). This animation does **not** broadcast SOS or call responders. Keep the marker visible above the repeater dots.
4. When GPS tracking begins, use a location-centered zoom that makes nearby HAM and GMRS dots visible with the YOU marker where possible. The closest-service calculation uses straight-line distance; approximate tower pins are not surveyed antennas.
5. Show the nearest HAM stations and nearest GMRS stations as **separate sorted groups** in a legible dock. Tapping any station reveals RX frequency, TX frequency, offset/tone, location, access notes, and service.
6. On every launch, **start all information panels minimized** into distinctive, tappable colored-dot shortcuts, while GPS, HAM/GMRS, airplanes, and weather radar data layers remain ON and visible on the map. Provide **Minimize All**, **Show All**, and individual open, full-screen, drag and hide. Minimized and hidden panels must always be recoverable.
7. Keep the Johnson County library W0ERH 145.290 marker as an **ordinary small green ham dot** with full programming details, not a building icon.
8. Include K0HAM 146.910 near the Santa Fe Water Tower (Overland Park), while making clear the exact individual antenna identity has not been independently confirmed. Repeater reference coordinates and the physical tower's address are separate pieces of evidence.

## Known code locations
- `roadtower.html`: Leaflet map, GPS watchPosition, SOS pin animation, toolbar and CSS.
- `repeaters.js`: HAM and GMRS bundled data and IndexedDB, both-mode filter, nearest list, dot styling, radio programming popups.
- `gmrs-directory.json`: limited, sourced GMRS starter dataset (not a comprehensive nationwide directory).
- `panel-layout.js`: move/size/minimize/fullscreen/hide state and colored shortcut dock.
- `sw.js`: service-worker cache version; bump on UI-script releases so offline phones can receive changes.
- Cloudflare Pages deployment availability and device location permission require real-device verification.

## Test checklist for every change
- Syntax-check the modified JavaScript.
- Cold-load without saved radio preference: HAM + GMRS visible simultaneously.
- Cold-load with old HAM-only preference: HAM + GMRS still visible.
- GPS granted: colored YOU SOS pin, recenters with both service markers visible where available.
- GPS denied or timed out: clear error/retry; never show a fake location.
- Test a 2m HAM site and a 462/467-MHz GMRS site via tooltip and popup.
- Test Minimize All, reopen one colored shortcut, full-screen that panel, then restore.
- Keep separate repeater service colors and license warnings.
- Test offline restart with already-saved data and test the folded/narrow mobile viewport.
