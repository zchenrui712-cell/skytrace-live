# SkyTrace Live

2026 Australia Hackathon · Team web prototype for aircraft identification.

[Open SkyTrace Live](https://zchenrui712-cell.github.io/skytrace-live/) · [Project page](https://zchenrui712-cell.github.io/skytrace.html)

## Try the public demo

Use **Try demo** to load a labelled Boeing 787-9 sample flight. Use **Upload image** to compare a photo against the included Airbus reference. The hosted version processes photos in the browser and uses sample flight data. The server edition below supports live camera observations and ADS-B queries.

## Project design

- **Live camera** uses device location and orientation to rank nearby ADS-B flight candidates. The live result depends on sensor quality and the provider's coverage.
- **Photo upload** uses exact and perceptual fingerprints to compare an image with the reference catalogue. The included catalogue covers one aircraft photograph and can leave an unfamiliar image unidentified.

| Part | Responsibility |
| --- | --- |
| [`app/page.tsx`](app/page.tsx) | Camera and upload interface, permission handling and presentation of candidates |
| [`app/api/aircraft`](app/api/aircraft) | Live aircraft queries with ADS-B Exchange and OpenSky fallback |
| [`app/api/catalog`](app/api/catalog) | Photo-reference matching and optional aircraft specification lookup |
| [`app/lib/photo-references.ts`](app/lib/photo-references.ts) | Reference image metadata and fingerprint comparison |
| [`app/api/model`](app/api/model) | Machine-readable description of the prototype's methods and sources |
| [`tests`](tests) | Photo matching, rendered HTML and component checks |

## Contribution

Chenrui (Zach) Zhang contributed to the concept, code and debugging. The prototype was developed as a team.

## Run locally

Use Node.js 22.13 or later and npm.

1. Run `npm ci` from this folder.
2. Run `npm run dev` and open the URL printed in the terminal. Use a secure origin or localhost for live camera and location permissions.
3. For the photo example, upload `public/sample-aircraft/airbus-a320-sharklets.jpg`. The API returns a reference match. An unrelated photo should return no match.
4. Run `npm test` to build the production app and verify the photo matcher, rendered page and UI components.

The built-in demo and sample photo match need no API key. Set `ADSBX_API_KEY` in a local environment file for the preferred live data provider. OpenSky is the fallback subject to service availability. `API_NINJAS_KEY` is optional and enriches type specifications. Keep local environment files and credentials outside Git.

## Source and assets

This portfolio release is based on SkyTrace Live source revision `fe3b0c3`. The included Airbus photo carries a CC BY-SA 3.0 licence covering the attributed image.

See [third-party notices](public/data-licenses.txt) for photo attribution and [the dataset registry](app/lib/aircraft-datasets.ts) for upstream links.
