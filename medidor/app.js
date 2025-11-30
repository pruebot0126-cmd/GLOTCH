// ===============================
// MAPA
// ===============================
const map = L.map("map").setView([19.4326, -99.1332], 14);

// Capas
const street = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);
const sat = L.tileLayer(
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
);

let satelliteMode = false;

// ===============================
// GRUPOS
// ===============================
const drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);

// ===============================
// CONTROLES DE DIBUJO
// ===============================
const drawControl = new L.Control.Draw({
  draw: {
    polygon: true,
    polyline: false,
    rectangle: false,
    marker: false,
    circle: false,
    circlemarker: false,
  },
  edit: { featureGroup: drawnItems }
});
map.addControl(drawControl);

let currentShape = null;
let savedShapes = [];

// ===============================
// CUANDO SE CREA UNA FORMA
// ===============================
map.on("draw:created", function (event) {
  const layer = event.layer;

  enableDragging(layer);
  drawnItems.addLayer(layer);

  currentShape = layer.toGeoJSON();

  updateArea(layer);
});

// ===============================
// CALCULAR ÁREA
// ===============================
function updateArea(layer) {
  const area = turf.area(layer.toGeoJSON());
  document.getElementById("area").textContent = area.toFixed(2);
  document.getElementById("hectareas").textContent = (area / 10000).toFixed(4);
}

// ===============================
// GUARDAR
// ===============================
document.getElementById("saveShapeBtn").onclick = () => {
  if (!currentShape) return alert("Dibuja una forma primero.");

  savedShapes.push(currentShape);
  localStorage.setItem("glotch_shapes", JSON.stringify(savedShapes));
  alert("Guardado.");
};

// ===============================
// CARGAR
// ===============================
document.getElementById("loadShapeBtn").onclick = () => {
  const data = localStorage.getItem("glotch_shapes");
  if (!data) return alert("Sin formas guardadas.");

  savedShapes = JSON.parse(data);
  drawnItems.clearLayers();

  savedShapes.forEach(shape => {
    const layer = L.geoJSON(shape).getLayers()[0];
    enableDragging(layer);
    drawnItems.addLayer(layer);
  });

  alert("Cargadas.");
};

// ===============================
// COMPARAR
// ===============================
document.getElementById("compareShapesBtn").onclick = () => {
  if (savedShapes.length < 2)
    return alert("Se necesitan 2 formas.");

  const A = savedShapes[savedShapes.length - 2];
  const B = savedShapes[savedShapes.length - 1];

  const areaA = turf.area(A);
  const areaB = turf.area(B);

  alert(`
A: ${(areaA/10000).toFixed(2)} ha
B: ${(areaB/10000).toFixed(2)} ha
Dif: ${((areaB-areaA)/10000).toFixed(2)} ha
  `);
};

// ===============================
// ARRÁSTRAR POLÍGONOS (ANDROID + iOS + PC)
// ===============================
function enableDragging(layer) {
  if (layer.dragging) {
    layer.dragging.enable();
  } else if (layer._path) {
    L.Path.Drag(layer);
  }
}

// ===============================
// VISTA SATELITAL
// ===============================
document.getElementById("toggleMapBtn").onclick = () => {
  if (satelliteMode) {
    map.removeLayer(sat);
    map.addLayer(street);
    toggleMapBtn.textContent = "Vista Satélite";
  } else {
    map.removeLayer(street);
    map.addLayer(sat);
    toggleMapBtn.textContent = "Vista Mapa";
  }
  satelliteMode = !satelliteMode;
};
