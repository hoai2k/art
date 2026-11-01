# Data sources for `game/data/` (Stratford Squirrel)

Retrieved 2026-11-01 by `tools/town/build_town.py`.

| Source | Exact access | Used for | Licence |
| --- | --- | --- | --- |
| OpenStreetMap | `https://api.openstreetmap.org/api/0.6/map?bbox=...` (five tiles covering lon -80.9950..-80.9580, lat 43.3620..43.3790) | buildings, roads, areas, water, railways, trees, landmark positions | ODbL 1.0. Attribution: "© OpenStreetMap contributors" (https://www.openstreetmap.org/copyright). |
| NRCan HRDEM, 1 m DTM and DSM, collection `hrdem-lidar`, dataset `ON-Upper_Thames_Grand_River_2025-1m` (LiDAR flown for Ontario, published 2025-11-14). STAC: `https://datacube.services.geo.ca/stac/api/` ; files `https://canelevation-dem.s3.ca-central-1.amazonaws.com/hrdem-lidar/ON-Upper_Thames_Grand_River_2025-1m-{dtm,dsm}.tif` (EPSG:3979) | window read only | terrain, water surface levels, building heights, tree positions and heights | Open Government Licence – Canada 2.0. "Contains information licensed under the Open Government Licence – Canada." |
| Ontario lidar-derived DTM/DSM (geohub.lio.gov.on.ca) | not needed: the HRDEM above covers the whole extent | none | OGL – Ontario ("Contains information licensed under the Open Government Licence – Ontario") |

Nothing was blocked: the OSM API, the STAC API and the S3 bucket were all reachable; Overpass was
not tried (known unreachable).

Landmark blurbs were read from Wikipedia (Stratford, Ontario; Stratford Festival; Avon Theatre;
Avon River (Ontario); Gallery Stratford), Doors Open Ontario, the Ontario Heritage Trust / Historic
Places entries for St. James and Knox, the Stratford Public Library and City pages, and the
"Streets of Stratford" site (Market Place, the registry office). Where sources disagree (the date of
Knox's present building) the blurb says nothing about it. Material, use and roof shape of
buildings without tags are guesses.

The in-game attribution string is `town.json: attribution`.
