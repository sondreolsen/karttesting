const bergenCamera = {
    center: [5.3318, 60.3898],
    zoom: 12.4,
    pitch: 54,
    bearing: -14
};

const fixtures = [
    {
        id: "villa",
        round: "35. runde",
        matchLabel: "Aston Villa - Tottenham",
        stadium: "Villa Park",
        dateLabel: "S\u00f8ndag 3. mai 2026",
        timeLabel: "20:00",
        stadiumCopy: "Tottenhams tur til Birmingham avslutter den nest siste bortereisen i serien.",
        venue: [-1.8849, 52.5092],
        camera: {
            center: [-1.8849, 52.5092],
            zoom: 14.45,
            pitch: 57,
            bearing: -24
        }
    },
    {
        id: "leeds",
        round: "36. runde",
        matchLabel: "Tottenham - Leeds United",
        stadium: "Tottenham Hotspur Stadium",
        dateLabel: "Mandag 11. mai 2026",
        timeLabel: "21:00",
        stadiumCopy: "F\u00f8rste hjemmekamp i innspurten spilles i nordlige London.",
        venue: [-0.0664, 51.6042],
        camera: {
            center: [-0.0664, 51.6042],
            zoom: 15.1,
            pitch: 59,
            bearing: -34
        }
    },
    {
        id: "chelsea",
        round: "37. runde",
        matchLabel: "Chelsea - Tottenham",
        stadium: "Stamford Bridge",
        dateLabel: "S\u00f8ndag 17. mai 2026",
        timeLabel: "16:00",
        stadiumCopy: "Derbyet mot Chelsea betyr en kort, men tung tur tvers gjennom London.",
        venue: [-0.1909, 51.4817],
        camera: {
            center: [-0.1909, 51.4817],
            zoom: 15.05,
            pitch: 58,
            bearing: -18
        }
    },
    {
        id: "everton",
        round: "38. runde",
        matchLabel: "Tottenham - Everton",
        stadium: "Tottenham Hotspur Stadium",
        dateLabel: "S\u00f8ndag 24. mai 2026",
        timeLabel: "17:00",
        stadiumCopy: "Sesongen avsluttes hjemme i N17, p\u00e5 samme arena som Leeds-kampen uka f\u00f8r.",
        venue: [-0.0664, 51.6042],
        camera: {
            center: [-0.0664, 51.6042],
            zoom: 15.1,
            pitch: 59,
            bearing: -16
        }
    }
];

const emptyRoute = {
    type: "FeatureCollection",
    features: []
};

const satelliteBaseStyle = {
    version: 8,
    sources: {
        "satellite-tiles": {
            type: "raster",
            tiles: [
                "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg"
            ],
            tileSize: 256,
            minzoom: 0,
            maxzoom: 18,
            attribution: "Imagery: Sentinel-2 cloudless by EOX, Contains modified Copernicus Sentinel data 2020"
        }
    },
    layers: [
        {
            id: "satellite-base",
            type: "raster",
            source: "satellite-tiles"
        }
    ],
    id: "satellite-style"
};

const tileUrlTemplate = "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg";

const playRouteButton = document.getElementById("play-route");
const resetViewButton = document.getElementById("reset-view");
const statusElement = document.getElementById("flight-status");
const locationCardElement = document.getElementById("location-card");
const locationKickerElement = document.getElementById("location-kicker");
const locationTitleElement = document.getElementById("location-title");
const locationSubtitleElement = document.getElementById("location-subtitle");
const locationDetailElement = document.getElementById("location-detail");
const fixtureButtons = Array.from(document.querySelectorAll(".fixture-button"));
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const fixtureById = new Map(fixtures.map((fixture) => [fixture.id, fixture]));

const map = new maplibregl.Map({
    container: "map",
    style: satelliteBaseStyle,
    center: bergenCamera.center,
    zoom: bergenCamera.zoom,
    pitch: bergenCamera.pitch,
    bearing: bergenCamera.bearing,
    minZoom: 4,
    maxZoom: 17,
    dragRotate: true,
    attributionControl: true,
    renderWorldCopies: false
});

map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");

const startMarkerElement = document.createElement("div");
startMarkerElement.className = "start-marker";

const bergenMarker = new maplibregl.Marker({
    element: startMarkerElement,
    anchor: "center"
}).setLngLat(bergenCamera.center);

const activeMarkerElement = document.createElement("div");
activeMarkerElement.className = "pulse-marker";

const activeMarker = new maplibregl.Marker({
    element: activeMarkerElement,
    anchor: "center"
});

const stadiumPopup = new maplibregl.Popup({
    closeButton: false,
    closeOnClick: false,
    offset: 18,
    maxWidth: "280px"
});

let currentOrigin = [...bergenCamera.center];
let activeJourneyToken = 0;
let hasShownLoadError = false;
const tilePrefetchCache = new Set();

function setStatus(message) {
    statusElement.textContent = message;
}

function setActiveFixtureButton(activeId) {
    fixtureButtons.forEach((button) => {
        const isActive = button.dataset.fixtureId === activeId;
        button.classList.toggle("is-active", isActive);
        button.setAttribute("aria-pressed", String(isActive));
    });
}

function updateLocationCard({ kicker, title, subtitle, detail }) {
    locationKickerElement.textContent = kicker;
    locationTitleElement.textContent = title;
    locationSubtitleElement.textContent = subtitle;
    locationDetailElement.textContent = detail;
    locationCardElement.classList.add("is-visible");
}

function hideActiveVenue() {
    activeMarkerElement.classList.remove("is-visible");
    stadiumPopup.remove();
    activeMarker.remove();
}

function showActiveVenue(fixture) {
    activeMarker.setLngLat(fixture.venue).addTo(map);
    activeMarkerElement.classList.add("is-visible");
    stadiumPopup
        .setLngLat(fixture.venue)
        .setHTML(
            "<strong>" + fixture.stadium + "</strong>" +
            "<p>" + fixture.matchLabel + "<br>" + fixture.dateLabel + " kl. " + fixture.timeLabel + "</p>"
        )
        .addTo(map);
}

function sameCoordinate(a, b) {
    return Math.abs(a[0] - b[0]) < 0.00001 && Math.abs(a[1] - b[1]) < 0.00001;
}

function setRoute(fromCoordinate, toCoordinate) {
    const routeSource = map.getSource("active-route");
    if (!routeSource) {
        return;
    }

    if (sameCoordinate(fromCoordinate, toCoordinate)) {
        routeSource.setData(emptyRoute);
        return;
    }

    routeSource.setData({
        type: "FeatureCollection",
        features: [
            {
                type: "Feature",
                properties: {},
                geometry: {
                    type: "LineString",
                    coordinates: [fromCoordinate, toCoordinate]
                }
            }
        ]
    });
}

function clearRoute() {
    const routeSource = map.getSource("active-route");
    if (!routeSource) {
        return;
    }

    routeSource.setData(emptyRoute);
}

function addRouteLayers() {
    if (map.getSource("active-route")) {
        return;
    }

    map.addSource("active-route", {
        type: "geojson",
        data: emptyRoute
    });

    map.addLayer({
        id: "active-route-glow",
        type: "line",
        source: "active-route",
        layout: {
            "line-cap": "round",
            "line-join": "round"
        },
        paint: {
            "line-color": "#90e5ff",
            "line-width": [
                "interpolate",
                ["linear"],
                ["zoom"],
                4, 2.5,
                12, 7
            ],
            "line-blur": 1.4,
            "line-opacity": 0.22
        }
    });

    map.addLayer({
        id: "active-route-line",
        type: "line",
        source: "active-route",
        layout: {
            "line-cap": "round",
            "line-join": "round"
        },
        paint: {
            "line-color": "#f4fbff",
            "line-width": [
                "interpolate",
                ["linear"],
                ["zoom"],
                4, 1.2,
                12, 3.1
            ],
            "line-dasharray": [2.1, 1.7],
            "line-opacity": 0.7
        }
    });
}

function moveCamera(camera, options = {}) {
    const duration = reduceMotion ? 0 : (options.duration ?? 4200);

    return new Promise((resolve) => {
        if (duration === 0) {
            map.jumpTo(camera);
            resolve();
            return;
        }

        map.once("moveend", resolve);
        map.flyTo({
            ...camera,
            duration,
            curve: options.curve ?? 1.35,
            speed: options.speed ?? 0.48,
            essential: true
        });
    });
}

function lngLatToTile(lng, lat, zoom) {
    const scale = Math.pow(2, zoom);
    const x = Math.floor(((lng + 180) / 360) * scale);
    const latRad = (lat * Math.PI) / 180;
    const y = Math.floor(
        ((1 - Math.log(Math.tan(latRad) + (1 / Math.cos(latRad))) / Math.PI) / 2) * scale
    );

    return { x, y };
}

function buildTileUrl(z, x, y) {
    return tileUrlTemplate
        .replace("{z}", String(z))
        .replace("{x}", String(x))
        .replace("{y}", String(y));
}

function prefetchTilesAround(coordinate, zoomLevels, radius = 1) {
    zoomLevels.forEach((zoom) => {
        const roundedZoom = Math.round(zoom);
        const centerTile = lngLatToTile(coordinate[0], coordinate[1], roundedZoom);

        for (let dx = -radius; dx <= radius; dx += 1) {
            for (let dy = -radius; dy <= radius; dy += 1) {
                const x = centerTile.x + dx;
                const y = centerTile.y + dy;
                const cacheKey = roundedZoom + ":" + x + ":" + y;

                if (tilePrefetchCache.has(cacheKey)) {
                    continue;
                }

                tilePrefetchCache.add(cacheKey);
                const image = new Image();
                image.decoding = "async";
                image.loading = "eager";
                image.src = buildTileUrl(roundedZoom, x, y);
            }
        }
    });
}

function buildApproachCamera(targetCamera, origin) {
    return {
        center: [
            (origin[0] + targetCamera.center[0]) / 2,
            (origin[1] + targetCamera.center[1]) / 2
        ],
        zoom: Math.min(6.8, targetCamera.zoom - 6.2),
        pitch: 32,
        bearing: targetCamera.bearing * 0.35
    };
}

async function transitionToFixtureCamera(fixture, origin, duration) {
    const approachCamera = buildApproachCamera(fixture.camera, origin);

    prefetchTilesAround(fixture.venue, [8, 10, 12, 13], 1);
    await moveCamera(approachCamera, {
        duration: Math.max(1600, Math.round(duration * 0.52)),
        curve: 1.2,
        speed: 0.56
    });

    prefetchTilesAround(fixture.venue, [13, 14], 1);
    await moveCamera(fixture.camera, {
        duration: Math.max(1600, Math.round(duration * 0.48)),
        curve: 1.18,
        speed: 0.52
    });
}

function updateStartState() {
    setActiveFixtureButton(null);
    updateLocationCard({
        kicker: "Startpunkt",
        title: "Bergen",
        subtitle: "Lille Lungeg\u00e5rdsvann og sentrum er utgangspunktet for ruta.",
        detail: "Velg en kamp for \u00e5 f\u00e5 opp stadionnavnet Tottenham skal spille p\u00e5."
    });
    setStatus("Klar i Bergen ...");
}

async function focusFixture(fixture, token, options = {}) {
    if (token !== activeJourneyToken) {
        return false;
    }

    const origin = options.origin ?? currentOrigin;
    setActiveFixtureButton(fixture.id);
    setRoute(origin, fixture.venue);
    hideActiveVenue();
    setStatus("Flyr til " + fixture.stadium + " ...");
    await transitionToFixtureCamera(fixture, origin, options.duration ?? 4700);

    if (token !== activeJourneyToken) {
        return false;
    }

    showActiveVenue(fixture);
    updateLocationCard({
        kicker: "Stadion",
        title: fixture.stadium,
        subtitle: fixture.matchLabel + " \u00b7 " + fixture.round,
        detail: fixture.dateLabel + " kl. " + fixture.timeLabel + ". " + fixture.stadiumCopy
    });
    setStatus(fixture.stadium + " markert");
    currentOrigin = [...fixture.venue];
    return true;
}

async function playRouteSequence() {
    activeJourneyToken += 1;
    const token = activeJourneyToken;

    hideActiveVenue();
    clearRoute();
    setActiveFixtureButton(null);
    setStatus("Starter ruta fra Bergen ...");
    await moveCamera(bergenCamera, {
        duration: 2000,
        curve: 1.2,
        speed: 0.62
    });

    if (token !== activeJourneyToken) {
        return;
    }

    currentOrigin = [...bergenCamera.center];
    updateLocationCard({
        kicker: "Startpunkt",
        title: "Bergen",
        subtitle: "Ruta starter ved Bergen sentrum for sesongens siste flyturer.",
        detail: "F\u00f8rste stopp blir Villa Park i Birmingham."
    });

    for (const fixture of fixtures) {
        const completed = await focusFixture(fixture, token, {
            origin: currentOrigin,
            duration: 4300
        });

        if (!completed) {
            return;
        }

        if (!reduceMotion) {
            await new Promise((resolve) => window.setTimeout(resolve, 950));
        }

        if (token !== activeJourneyToken) {
            return;
        }
    }

    setStatus("Alle stadionene er markert");
}

async function goToBergen() {
    activeJourneyToken += 1;
    const token = activeJourneyToken;

    setStatus("Flyr tilbake til Bergen ...");
    hideActiveVenue();
    clearRoute();
    setActiveFixtureButton(null);

    await moveCamera(bergenCamera, {
        duration: 2400,
        curve: 1.18,
        speed: 0.58
    });

    if (token !== activeJourneyToken) {
        return;
    }

    currentOrigin = [...bergenCamera.center];
    updateStartState();
}

map.on("load", () => {
    addRouteLayers();
    bergenMarker.addTo(map);
    prefetchTilesAround(bergenCamera.center, [9, 11, 12], 1);
    fixtures.forEach((fixture) => {
        prefetchTilesAround(fixture.venue, [8, 10, 12], 1);
    });
    updateStartState();
});

map.on("error", (event) => {
    if (hasShownLoadError) {
        return;
    }

    const errorMessage = typeof event?.error?.message === "string"
        ? event.error.message
        : "";

    if (window.location.protocol === "file:") {
        hasShownLoadError = true;
        setStatus("Kartdata blir ofte blokkert i file://. Aapne via localhost eller GitHub Pages.");
        return;
    }

    if (errorMessage) {
        hasShownLoadError = true;
        setStatus("Kartdata kunne ikke lastes.");
    }
});

fixtureButtons.forEach((button) => {
    button.addEventListener("click", async () => {
        const fixture = fixtureById.get(button.dataset.fixtureId);
        if (!fixture) {
            return;
        }

        activeJourneyToken += 1;
        const token = activeJourneyToken;
        await focusFixture(fixture, token);
    });
});

playRouteButton.addEventListener("click", () => {
    playRouteSequence();
});

resetViewButton.addEventListener("click", () => {
    goToBergen();
});
