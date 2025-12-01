// ===============================
// MAPA
// ===============================
const map = L.map("map").setView([19.4326, -99.1332], 14);

const street = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);
const satellite = L.tileLayer(
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
);

let satMode = false;

// ===============================
// DIBUJO
// ===============================
const drawnItems = new L.FeatureGroup().addTo(map);

const drawControl = new L.Control.Draw({
  draw: { polygon: true, polyline: false, rectangle: false, circle: false, marker: false },
  edit: { featureGroup: drawnItems }
});
map.addControl(drawControl);

let currentLayer = null;

// ===============================
// POLÍGONO NUEVO
// ===============================
map.on("draw:created", e => {
  const layer = e.layer;
  drawnItems.addLayer(layer);

  enableDrag(layer);

  currentLayer = layer;

  updateArea(layer);
});

// ===============================
// ÁREA
// ===============================
function updateArea(layer) {
  const geo = layer.toGeoJSON();
  const area = turf.area(geo);

  document.getElementById("area").innerText = area.toFixed(2);
  document.getElementById("ha").innerText = (area / 10000).toFixed(4);
}

// ===============================
// DRAG UNIVERSAL (PC, MAC, ANDROID)
// ===============================
function enableDrag(layer) {
  let dragging = false;
  let last = null;

  layer.on("mousedown touchstart", e => {
    dragging = true;
    last = e.latlng;
  });

  map.on("mousemove touchmove", e => {
    if (!dragging) return;

    const lat = e.latlng.lat - last.lat;
    const lng = e.latlng.lng - last.lng;

    const pts = layer.getLatLngs()[0].map(p => L.latLng(p.lat + lat, p.lng + lng));
    layer.setLatLngs([pts]);
    layer.redraw();

    last = e.latlng;
  });

  map.on("mouseup touchend", () => dragging = false);
}

// ===============================
// GUARDAR FORMAS
// ===============================
document.getElementById("guardar").onclick = () => {
  const shapes = drawnItems.toGeoJSON();
  localStorage.setItem("formas", JSON.stringify(shapes));
  alert("Formas guardadas.");
};

// ===============================
// CARGAR FORMAS
// ===============================
document.getElementById("cargar").onclick = () => {
  drawnItems.clearLayers();

  const data = localStorage.getItem("formas");
  if (!data) return alert("No hay formas guardadas.");

  const shapes = JSON.parse(data);

  L.geoJSON(shapes, {
    onEachFeature: (feature, layer) => enableDrag(layer)
  }).addTo(drawnItems);
};

// ===============================
// VISTA SATÉLITE
// ===============================
document.getElementById("vista").onclick = () => {
  if (satMode) {
    map.removeLayer(satellite);
    map.addLayer(street);
    satMode = false;
  } else {
    map.removeLayer(street);
    map.addLayer(satellite);
    satMode = true;
  }
};

// ===============================
// MEDIR DISTANCIA
// ===============================
document.getElementById("distancia").onclick = () => {
  alert("Modo distancia: toca dos puntos en el mapa.");

  let clicks = [];

  map.once("click", e1 => {
    clicks.push(e1.latlng);

    map.once("click", e2 => {
      clicks.push(e2.latlng);

      const dist = map.distance(clicks[0], clicks[1]) / 1000;
      alert(`Distancia: ${dist.toFixed(3)} km`);
    });
  });
};
