const overviewCamera = {
    center: [5.1, 60.55],
    zoom: 6.2,
    pitch: 34,
    bearing: -10
};

const bergenApproachCamera = {
    center: [5.15, 60.42],
    zoom: 9.6,
    pitch: 48,
    bearing: -18
};

const bergenLandingCamera = {
    center: [5.3318, 60.3898],
    zoom: 14.35,
    pitch: 58,
    bearing: -12
};

const lilleLungegardsvannCenter = [5.3318, 60.3898];

const lilleLungegardsvannOutline = {
    type: "Feature",
    properties: {
        name: "Lille Lungegardsvann"
    },
    geometry: {
        type: "Polygon",
        coordinates: [[
            [5.3297, 60.3894],
            [5.3302, 60.3910],
            [5.3318, 60.3918],
            [5.3341, 60.3914],
            [5.3354, 60.3900],
            [5.3350, 60.3882],
            [5.3334, 60.3872],
            [5.3312, 60.3875],
            [5.3299, 60.3886],
            [5.3297, 60.3894]
        ]]
    }
};

const flightPathFeature = {
    type: "Feature",
    properties: {},
    geometry: {
        type: "LineString",
        coordinates: [
            [4.42, 60.88],
            [4.82, 60.69],
            [5.12, 60.47],
            lilleLungegardsvannCenter
        ]
    }
};

const replayButton = document.getElementById("replay-flight");
const statusElement = document.getElementById("flight-status");
const storyCaptionElement = document.getElementById("story-caption");
const locationCardElement = document.getElementById("location-card");
const chapterElements = Array.from(document.querySelectorAll(".chapter-step"));
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const narrativePhases = {
    overview: {
        status: "Viser Vestlandet ...",
        caption: "Kameraet aapner bredt over Vestlandet for innflygingen starter.",
        chapter: "overview",
        locationVisible: false,
        pathOpacity: 0.68
    },
    bergen: {
        status: "Flyr inn mot Bergen ...",
        caption: "Fortellingen smalner inn og leder blikket mot Bergen.",
        chapter: "bergen",
        locationVisible: false,
        pathOpacity: 0.62
    },
    focus: {
        status: "Lander ved Lille Lungegaardsvann ...",
        caption: "Den siste bevegelsen snevrer inn mot vannspeilet midt i sentrum.",
        chapter: "focus",
        locationVisible: false,
        pathOpacity: 0.36
    },
    landed: {
        status: "Lille Lungegaardsvann markert",
        caption: "Landingspunktet er vannspeilet i hjertet av Bergen sentrum.",
        chapter: "focus",
        locationVisible: true,
        pathOpacity: 0.18
    }
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

const map = new maplibregl.Map({
    container: "map",
    style: satelliteBaseStyle,
    center: overviewCamera.center,
    zoom: overviewCamera.zoom,
    pitch: overviewCamera.pitch,
    bearing: overviewCamera.bearing,
    minZoom: 5.5,
    maxZoom: 17,
    dragRotate: true,
    attributionControl: true,
    renderWorldCopies: false
});

map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");

const markerElement = document.createElement("div");
markerElement.className = "pulse-marker";

const lilleLungegardsvannMarker = new maplibregl.Marker({
    element: markerElement,
    anchor: "center"
}).setLngLat(lilleLungegardsvannCenter);

const lakePopup = new maplibregl.Popup({
    closeButton: false,
    closeOnClick: false,
    offset: 16,
    maxWidth: "260px"
}).setLngLat(lilleLungegardsvannCenter)
    .setHTML(
        "<strong>Lille Lungeg\u00e5rdsvann</strong><p>Her kan historien eller grafikken din lande etter innflygingen.</p>"
    );

let activeFlightId = 0;
let preFlightTimeoutId = 0;
let hasShownLoadError = false;

function setStatus(message) {
    statusElement.textContent = message;
}

function setNarrativePhase(phaseKey) {
    const phase = narrativePhases[phaseKey];
    if (!phase) {
        return;
    }

    setStatus(phase.status);
    storyCaptionElement.textContent = phase.caption;

    chapterElements.forEach((element) => {
        element.classList.toggle("is-active", element.dataset.phase === phase.chapter);
    });

    locationCardElement.classList.toggle("is-visible", phase.locationVisible);
    setFlightPathOpacity(phase.pathOpacity);
}

function hideHighlight() {
    markerElement.classList.remove("is-visible");
    lakePopup.remove();
    locationCardElement.classList.remove("is-visible");
}

function showHighlight() {
    if (!markerElement.parentElement) {
        lilleLungegardsvannMarker.addTo(map);
    }

    markerElement.classList.add("is-visible");
    lakePopup.addTo(map);
}

function addFlightLayers() {
    if (map.getSource("story-flight-path")) {
        return;
    }

    map.addSource("story-flight-path", {
        type: "geojson",
        data: flightPathFeature
    });

    map.addLayer({
        id: "story-flight-path-glow",
        type: "line",
        source: "story-flight-path",
        layout: {
            "line-cap": "round",
            "line-join": "round"
        },
        paint: {
            "line-color": "#8fe1ff",
            "line-width": [
                "interpolate",
                ["linear"],
                ["zoom"],
                6, 3,
                12, 8
            ],
            "line-blur": 1.2,
            "line-opacity": 0.2
        }
    });

    map.addLayer({
        id: "story-flight-path-line",
        type: "line",
        source: "story-flight-path",
        layout: {
            "line-cap": "round",
            "line-join": "round"
        },
        paint: {
            "line-color": "#f2fbff",
            "line-width": [
                "interpolate",
                ["linear"],
                ["zoom"],
                6, 1.6,
                12, 3.1
            ],
            "line-dasharray": [2, 1.8],
            "line-opacity": 0.54
        }
    });
}

function setFlightPathOpacity(opacity) {
    if (!map.getLayer("story-flight-path-line")) {
        return;
    }

    map.setPaintProperty("story-flight-path-line", "line-opacity", opacity);
    map.setPaintProperty("story-flight-path-glow", "line-opacity", Math.min(opacity * 0.45, 0.24));
}

function addLakeLayers() {
    if (map.getSource("lille-lungegardsvann")) {
        return;
    }

    map.addSource("lille-lungegardsvann", {
        type: "geojson",
        data: lilleLungegardsvannOutline
    });

    map.addLayer({
        id: "lille-lungegardsvann-fill",
        type: "fill",
        source: "lille-lungegardsvann",
        paint: {
            "fill-color": "#4cb3e2",
            "fill-opacity": [
                "interpolate",
                ["linear"],
                ["zoom"],
                8, 0.08,
                12, 0.2,
                15, 0.3
            ]
        }
    });

    map.addLayer({
        id: "lille-lungegardsvann-line",
        type: "line",
        source: "lille-lungegardsvann",
        paint: {
            "line-color": "#0778b4",
            "line-width": [
                "interpolate",
                ["linear"],
                ["zoom"],
                8, 1.2,
                14, 3.2
            ],
            "line-opacity": [
                "interpolate",
                ["linear"],
                ["zoom"],
                8, 0.28,
                12, 0.7,
                15, 0.95
            ]
        }
    });
}

function runFlightSequence() {
    const thisFlightId = ++activeFlightId;
    const pauseBeforeTakeoff = reduceMotion ? 0 : 1200;
    const approachDuration = reduceMotion ? 0 : 6200;
    const landingDuration = reduceMotion ? 0 : 3600;

    window.clearTimeout(preFlightTimeoutId);
    map.stop();
    hideHighlight();
    setNarrativePhase("overview");
    map.jumpTo(overviewCamera);

    preFlightTimeoutId = window.setTimeout(() => {
        if (thisFlightId !== activeFlightId) {
            return;
        }

        setNarrativePhase("bergen");
        map.flyTo({
            ...bergenApproachCamera,
            duration: approachDuration,
            curve: 1.4,
            speed: 0.46,
            essential: true
        });

        map.once("moveend", () => {
            if (thisFlightId !== activeFlightId) {
                return;
            }

            setNarrativePhase("focus");
            map.easeTo({
                ...bergenLandingCamera,
                duration: landingDuration,
                easing: (value) => 1 - Math.pow(1 - value, 3),
                essential: true
            });

            map.once("moveend", () => {
                if (thisFlightId !== activeFlightId) {
                    return;
                }

                showHighlight();
                setNarrativePhase("landed");
            });
        });
    }, pauseBeforeTakeoff);
}

map.on("load", () => {
    addFlightLayers();
    addLakeLayers();
    setNarrativePhase("overview");
    runFlightSequence();
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
        setStatus("Kartdata blir ofte blokkert i file://. Aapne via localhost.");
        return;
    }

    if (errorMessage) {
        hasShownLoadError = true;
        setStatus("Kartdata kunne ikke lastes.");
    }
});

replayButton.addEventListener("click", () => {
    runFlightSequence();
});
