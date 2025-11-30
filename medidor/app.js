// ==========================
// MAPA
// ==========================
var map = L.map('map').setView([19.4326, -99.1332], 15);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 22
}).addTo(map);

// ==========================
// CAPAS
// ==========================
var drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);

// Herramientas de dibujo
var drawControl = new L.Control.Draw({
    draw: {
        polygon: true,
        rectangle: true,
        circle: false,
        marker: false,
        polyline: false,
    },
    edit: {
        featureGroup: drawnItems,
        remove: true
    }
});

map.addControl(drawControl);

// ==========================
// EVENTO CREAR FIGURA
// ==========================
map.on(L.Draw.Event.CREATED, function (event) {
    var layer = event.layer;

    enableDrag(layer);
    enableRotation(layer);

    drawnItems.addLayer(layer);
});

// ==========================
// FUNCIONES DE MOVIMIENTO
// ==========================
function enableDrag(layer) {
    layer.dragging = false;

    layer.on('mousedown touchstart', function (e) {
        layer.dragging = true;
        layer.startPoint = e.latlng;
    });

    map.on('mousemove touchmove', function (e) {
        if (layer.dragging) {
            let offset = [
                e.latlng.lat - layer.startPoint.lat,
                e.latlng.lng - layer.startPoint.lng
            ];

            layer.startPoint = e.latlng;

            layer.setLatLngs(
                layer.getLatLngs()[0].map(p => L.latLng(
                    p.lat + offset[0],
                    p.lng + offset[1]
                ))
            );
        }
    });

    map.on('mouseup touchend', function () {
        layer.dragging = false;
    });
}

// ==========================
// ROTACIÓN MULTITOUCH
// ==========================
function enableRotation(layer) {
    let startAngle = null;

    map.on('touchmove', function (e) {
        if (e.touches.length === 2) {

            let dx = e.touches[1].clientX - e.touches[0].clientX;
            let dy = e.touches[1].clientY - e.touches[0].clientY;
            let angle = Math.atan2(dy, dx);

            if (!startAngle) startAngle = angle;

            let delta = angle - startAngle;
            startAngle = angle;

            rotateShape(layer, delta);
        }
    });

    map.on('touchend', () => startAngle = null);
}

function rotateShape(layer, angle) {
    let latlngs = layer.getLatLngs()[0];

    let center = layer.getBounds().getCenter();

    let rotated = latlngs.map(p => {
        let lat = p.lat - center.lat;
        let lng = p.lng - center.lng;

        let newLat = lat * Math.cos(angle) - lng * Math.sin(angle);
        let newLng = lat * Math.sin(angle) + lng * Math.cos(angle);

        return L.latLng(newLat + center.lat, newLng + center.lng);
    });

    layer.setLatLngs([rotated]);
}

// ==========================
// GUARDAR
// ==========================
document.getElementById("btnGuardar").onclick = function () {
    let data = [];
    drawnItems.eachLayer(layer => {
        data.push(layer.getLatLngs());
    });

    localStorage.setItem("formas", JSON.stringify(data));
    alert("Formas guardadas");
};

// ==========================
// CARGAR
// ==========================
document.getElementById("btnCargar").onclick = function () {
    drawnItems.clearLayers();

    let saved = JSON.parse(localStorage.getItem("formas") || "[]");

    saved.forEach(shape => {
        let polygon = L.polygon(shape).addTo(drawnItems);

        enableDrag(polygon);
        enableRotation(polygon);
    });

    alert("Formas cargadas y movibles");
};

// ==========================
// MEDIR DISTANCIA
// ==========================
let measuring = false;
let polyline = null;

document.getElementById("btnDistancia").onclick = () => {
    measuring = !measuring;
    alert("Modo medir: " + (measuring ? "activo" : "apagado"));
};

map.on('click', function (e) {
    if (!measuring) return;

    if (!polyline) {
        polyline = L.polyline([e.latlng], { color: "red" }).addTo(map);
    } else {
        let pts = polyline.getLatLngs();
        pts.push(e.latlng);
        polyline.setLatLngs(pts);

        let total = 0;
        for (let i = 1; i < pts.length; i++) {
            total += pts[i - 1].distanceTo(pts[i]);
        }

        alert("Distancia: " + (total / 1000).toFixed(2) + " km");
    }
});

