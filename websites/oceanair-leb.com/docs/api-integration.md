# OCEANAIR WWA APIs — audit (2026-11-15)

Checked against the legacy site dump in `docs/oceanair-leb.com/`, the two Excel workbooks in `docs/`, and live HTTP calls from this machine.

## Verdict

| Feature | Real and usable? | Notes |
| --- | --- | --- |
| WWA Tracking (login + search + detail) | **Yes** | Staging and production login succeed. Search/detail endpoints accept the auth token and return JSON. |
| WWA Sailing Schedule (login + origins + search) | **Yes** | Same login. Origins list returns a large CFS catalogue. Search returns structured schedule JSON (or `"No data found"` when the lane/date has nothing). |
| Old `sailingschedule.com` iframe/link | **No** | `https://www.sailingschedule.com/shared/schedule-search?link=T2NlYW5BaXJfT0NDTzFfMTE%3D` returns **403**. Do not rebuild on this embed. |
| Intro YouTube video `ioJ2m-B_T3s` | **Yes** | Title: "Oceanair Consolidators SARL BEIRUT Lebanon". Use this on the home (and About) pages. |

The Excel files and the ASP.NET code describe the **same WorldWide Alliance** APIs. They are not placeholders.

## Tracking — `API Tracking.xlsx` + legacy `WWATracking.cs`

**Host**

- Staging: `https://apistaging.wwalliance.com/`
- Production: `https://api.wwalliance.com/`

**Auth**

- `POST /auth/login` with JSON `{ "username", "password" }`
- Response includes `data.result.auth_token` (idle lifetime ~30 minutes)
- Pass that value as the `Authorization` header on later calls

**Endpoints used by the old site**

| Action | Path |
| --- | --- |
| Shipment search | `/tracking/webservice/track_ShipmentSearch` |
| Shipment detail | `/tracking/webservice/track_ShipmentdetailSearch` |
| Shipment watch / events | `/tracking/webservice/track_ShipmentWatch` |

**SearchBy values** (from the live tracking form): `WWAReferenceNumber`, `BookingNumber`, `LotNumber`, `BillofLadingNumber`, `ArrivalNoticeNumber`, `ContainerNumber`, `CustomerReferenceNumber`.

**Proxy rule for the CMS:** the browser must never hold WWA credentials. The Node site should own login + token cache and expose a small `/api/tracking` route that validates input with Zod and calls WWA server-side.

Legacy credentials are hardcoded in `docs/oceanair-leb.com/App_Code/WWATracking.cs` (staging user `oceanair_webservice_staging`, production user `oceanair_webservice`). They still work today; move them into `.env` / `.env.production` and rotate with WWA if possible. Never put them in the static HTML designs.

## Sailing schedule — `API Sailing Schedule.xlsx`

The live site today only iframes / links to sailingschedule.com (broken). The Excel workbook is the real WWA schedule API that should replace it.

| Action | Path |
| --- | --- |
| Login | `/auth/login` (same as tracking) |
| Origin CFS list | `/sailing/SailingScheduleGetOriginWebservice` |
| Destination CFS list | `/sailing/SailingScheduleGetDestinationWebservice` |
| Schedule search | `/sailing/getScheduleSearch` (version `4.0.0`) |

Search body fields that matter for the UI: `cfsOrigin`, `cfsDestination`, `cutOffDateFrom`, `cutOffDateTo`, `limit`, `offset`. Response includes vessel, voyage, carrier SCAC, ETD/ETA, cut-off, transit times and route legs.

Same proxy rule: Node backend only; public page posts origin/destination/dates to our own `/api/sailing` route.

## Video

- YouTube id: `ioJ2m-B_T3s`
- Channel: `https://www.youtube.com/channel/UC9auQ7sB9_lsgWw4AfL2Uyg`
- Legacy placement: home button “Get to know us…”, plus embeds on About and Sea Freight Import Sailing Schedule

## Content gaps vs the old site (for CMS / Option 3 polish)

Still missing or only summarised in the designs:

- Dedicated **About WWA** page (`about-wwa.htm`)
- Separate **Import / Export sailing schedule** pages with regional copy (USA & Canada, Europe, Asia, Turkey, Mediterranean)
- Live schedule results table (vessel / voyage / cut-off / ETD / ETA) instead of the illustrative lane list
- Live tracking results panel (shipment list → detail → events)

Partner tracking links, team contacts, warehouse facts and service copy are already covered in Option 3.
