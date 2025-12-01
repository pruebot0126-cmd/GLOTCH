// medidor/app.js
// Requiere: Leaflet, Leaflet.draw, turf. (Path Drag plugin es opcional)

// ------------------------
// Configuración inicial
// ------------------------
const map = L.map('map', { zoomControl: true }).setView([19.4326, -99.1332], 13);

// Capas base
const streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '© OpenStreetMap'
}).addTo(map);

const satelliteLayer = L.tileLayer(
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  { maxZoom: 19, attribution: 'Tiles © Esri' }
);

// Control capas (se ve en esquina por defecto)
const baseMaps = { 'Mapa': streetLayer, 'Satélite': satelliteLayer };
L.control.layers(baseMaps).addTo(map);

// ------------------------
// FeatureGroup y Draw
// ------------------------
const drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);

const drawControl = new L.Control.Draw({
  draw: {
    polygon: true,
    polyline: false,
    rectangle: false,
    circle: false,
    marker: false,
    circlemarker: false
  },
  edit: {
    featureGroup: drawnItems,
    remove: true
  }
});
map.addControl(drawControl);

// ------------------------
// Estado y variables
// ------------------------
let savedShapes = [];       // arreglo con GeoJSON de formas guardadas
let currentLayer = null;    // referencia al layer creado/activo (L.Layer)
let draggingLayer = null;   // layer que se está arrastrando (si hay)
let dragStartLatLng = null; // latlng de inicio del arrastre
let satelliteMode = false;

// Medición de distancia (modo continuo)
let measureMode = false;
let measurePoints = [];
let measureLine = null;

// ------------------------
// UTIL: actualizar área en UI
// ------------------------
function actualizarAreaDesdeLayer(layer) {
  try {
    const geojson = layer.toGeoJSON();
    const area = turf.area(geojson); // en m²
    const hectareas = area / 10000;
    document.getElementById('area').textContent = area.toFixed(2);
    document.getElementById('hectareas').textContent = hectareas.toFixed(4);
  } catch (e) {
    console.warn('No se pudo calcular área:', e);
  }
}

// ------------------------
// ENABLE DRAGGING (robusto)
// - Intenta usar plugin Path.Drag si existe.
// - Si no, usa fallback manual sobre mousedown/mousemove/mouseup.
// ------------------------
function enableDragging(layer) {
  // si layer es un FeatureGroup (por L.geoJSON), buscar sublayers
  if (layer instanceof L.FeatureGroup || (layer.getLayers && layer.getLayers().length > 0)) {
    layer.eachLayer(l => enableDragging(l));
    return;
  }

  // si plugin Path.Drag está disponible, usarlo
  if (typeof L.Path && typeof L.Path.Drag !== 'undefined') {
    try {
      // algunos builds exponen Path.Drag como L.Path.Drag o L.Handler.PathDrag; intentamos ambos
      if (layer.dragging && typeof layer.dragging.enable === 'function') {
        // ya tiene dragging habilitado
      } else if (L.Path.Drag) {
        layer.dragging = new L.Path.Drag(layer);
        if (layer.dragging && layer.dragging.enable) layer.dragging.enable();
      } else if (L.Handler && L.Handler.PathDrag) {
        layer.dragging = new L.Handler.PathDrag(layer);
        if (layer.dragging && layer.dragging.enable) layer.dragging.enable();
      }
      // actualizar área al terminar arrastre (algunos plugins disparan eventos)
      layer.on && layer.on('dragend', () => actualizarAreaDesdeLayer(layer));
      return;
    } catch (err) {
      console.warn('Path.Drag intento falló, usando fallback manual', err);
    }
  }

  // Fallback manual (funciona con mouse y touch porque Leaflet mapea eventos)
  layer.on('mousedown touchstart', function (e) {
    draggingLayer = layer;
    dragStartLatLng = e.latlng || (e.touches && e.touches[0] && L.latLng(e.touches[0].lat, e.touches[0].lng));
    // desactivar pan del mapa mientras arrastramos para evitar conflicto
    try { map.dragging.disable(); } catch (e) {}
  });

  // Listeners globales de mapa (solo para el fallback)
  map.on('mousemove touchmove', function (e) {
    if (!draggingLayer) return;
    const latlng = e.latlng;
    if (!latlng || !dragStartLatLng) return;

    const dLat = latlng.lat - dragStartLatLng.lat;
    const dLng = latlng.lng - dragStartLatLng.lng;

    // obtener lista de anillos (para polígonos) y mover cada punto
    const latlngs = draggingLayer.getLatLngs && draggingLayer.getLatLngs();
    if (!latlngs) return;

    // Soportar polígonos simples (array[0]) y multipolígonos
    const newLatLngs = latlngs.map(ring => {
      return ring.map(pt => L.latLng(pt.lat + dLat, pt.lng + dLng));
    });

    // algunos layers devuelven nested arrays, intentamos setLatLngs directamente
    draggingLayer.setLatLngs(newLatLngs);
    draggingLayer.redraw();

    // actualizar UI de área mientras se arrastra
    actualizarAreaDesdeLayer(draggingLayer);

    // mover inicio al punto actual para deltas relativos
    dragStartLatLng = latlng;
  });

  map.on('mouseup touchend', function () {
    if (!draggingLayer) return;
    // confirmar nuevo estado
    actualizarAreaDesdeLayer(draggingLayer);
    // actualizar currentLayer si corresponde
    if (currentLayer === null) currentLayer = draggingLayer;
    draggingLayer = null;
    dragStartLatLng = null;
    try { map.dragging.enable(); } catch (e) {}
  });
}

// ------------------------
// EVENTOS: al crear una figura
// ------------------------
map.on('draw:created', function (e) {
  const layer = e.layer;
  drawnItems.addLayer(layer);
  currentLayer = layer;

  // habilitar drag y actualizar medidas
  enableDragging(layer);
  actualizarAreaDesdeLayer(layer);
});

// ------------------------
// EVENTO: al editar (guardar cambios del editor de Leaflet Draw)
// ------------------------
map.on('draw:edited', function (e) {
  e.layers.eachLayer(layer => {
    // actualizar medidas de cada layer editado
    actualizarAreaDesdeLayer(layer);
  });
});

// ------------------------
// GUARDAR / CARGAR a localStorage (GeoJSON)
// ------------------------
document.getElementById('saveShapeBtn').onclick = function () {
  if (!currentLayer) return alert('Dibuja una forma primero.');
  try {
    const geo = currentLayer.toGeoJSON();
    savedShapes = JSON.parse(localStorage.getItem('glotch_shapes') || '[]');
    savedShapes.push(geo);
    localStorage.setItem('glotch_shapes', JSON.stringify(savedShapes));
    alert('Forma guardada en localStorage.');
  } catch (err) {
    console.error(err);
    alert('Error al guardar la forma.');
  }
};

document.getElementById('loadShapeBtn').onclick = function () {
  const data = localStorage.getItem('glotch_shapes');
  if (!data) return alert('No hay formas guardadas.');
  savedShapes = JSON.parse(data);

  drawnItems.clearLayers();

  savedShapes.forEach((feature) => {
    // Convertir GeoJSON coords [lng,lat] a [lat,lng] y crear L.polygon para permitir setLatLngs
    if (!feature || !feature.geometry) return;
    const coords = feature.geometry.coordinates; // normalmente [ [ [lng,lat], ... ] ]
    // manejar Polígono simple (tipo 'Polygon')
    if (feature.geometry.type === 'Polygon') {
      const rings = coords.map(ring => ring.map(pt => [pt[1], pt[0]]));
      const poly = L.polygon(rings, { color: '#3388ff' }).addTo(drawnItems);
      enableDragging(poly);
    } else if (feature.geometry.type === 'MultiPolygon') {
      // crear multipolygon como FeatureGroup de polígonos
      const fg = L.featureGroup();
      coords.forEach(ringSet => {
        const rings = ringSet.map(ring => ring.map(pt => [pt[1], pt[0]]));
        const poly = L.polygon(rings).addTo(fg);
        enableDragging(poly);
      });
      drawnItems.addLayer(fg);
    } else {
      // si no es polígono, intentar L.geoJSON (menos garantizado para arrastre)
      const gj = L.geoJSON(feature).addTo(drawnItems);
      enableDragging(gj);
    }
  });

  alert('Formas cargadas.');
};

// ------------------------
// COMPARAR (visual simple: mostrar últimas 2 guardadas con distinto estilo)
// ------------------------
document.getElementById('compareShapesBtn').onclick = function () {
  const data = localStorage.getItem('glotch_shapes');
  if (!data) return alert('No hay formas guardadas.');
  const shapes = JSON.parse(data);
  if (shapes.length < 2) return alert('Necesitas al menos 2 formas guardadas.');

  // limpiar capas de comparación previas
  const lastA = shapes[shapes.length - 2];
  const lastB = shapes[shapes.length - 1];

  // quitar capas previas temporalmente
  drawnItems.clearLayers();

  // agregar A (azul) y B (verde traslúcido)
  function addFeatureWithStyle(feature, style) {
    if (!feature.geometry) return;
    if (feature.geometry.type === 'Polygon') {
      const rings = feature.geometry.coordinates.map(ring => ring.map(pt => [pt[1], pt[0]]));
      return L.polygon(rings, style).addTo(drawnItems);
    } else {
      return L.geoJSON(feature, { style }).addTo(drawnItems);
    }
  }

  const layerA = addFeatureWithStyle(lastA, { color: '#1f77b4', weight: 2 });
  const layerB = addFeatureWithStyle(lastB, { color: '#2ca02c', weight: 2, fillOpacity: 0.2 });

  if (layerA) enableDragging(layerA);
  if (layerB) enableDragging(layerB);

  // ajustar vista para ver ambas
  try {
    const group = L.featureGroup([layerA, layerB].filter(Boolean));
    map.fitBounds(group.getBounds().pad(0.2));
  } catch (e) {}
};

// ------------------------
// ALTERNAR VISTA SATÉLITE (botón)
// ------------------------
document.getElementById('toggleMapBtn').onclick = function () {
  if (satelliteMode) {
    map.removeLayer(satelliteLayer);
    map.addLayer(streetLayer);
    this.textContent = 'Vista Satélite';
  } else {
    map.removeLayer(streetLayer);
    map.addLayer(satelliteLayer);
    this.textContent = 'Vista Mapa';
  }
  satelliteMode = !satelliteMode;
};

// ------------------------
// MODO MEDIR DISTANCIA (continuo: click points -> mostrar distancia total)
// ------------------------
const measureBtn = document.getElementById('measureDistBtn');
measureBtn.onclick = () => {
  measureMode = !measureMode;
  measurePoints = [];
  if (measureLine) {
    map.removeLayer(measureLine);
    measureLine = null;
  }
  measureBtn.textContent = measureMode ? 'Medir: ON' : 'Medir distancia';
  if (!measureMode) alert('Modo medir desactivado.');
};

map.on('click', function (e) {
  if (!measureMode) return;
  measurePoints.push([e.latlng.lng, e.latlng.lat]); // turf usa [lng,lat]

  if (measureLine) map.removeLayer(measureLine);

  // crear polyline visual (lat,lng)
  const latlngs = measurePoints.map(p => [p[1], p[0]]);
  measureLine = L.polyline(latlngs, { color: 'orange' }).addTo(map);

  if (measurePoints.length > 1) {
    const line = turf.lineString(measurePoints);
    const distKm = turf.length(line, { units: 'kilometers' });
    // mostrar distancia total en UI (puedes cambiar por un panel)
    measureLine.bindPopup(`Distancia: ${ (distKm*1000).toFixed(1) } m (${distKm.toFixed(3)} km)`).openPopup();
  }
});

// ------------------------
// MANTENER currentLayer actualizado al editar/arrastrar
// ------------------------
map.on('draw:edited', function (e) {
  e.layers.eachLayer(layer => {
    currentLayer = layer;
    actualizarAreaDesdeLayer(layer);
  });
});

// ------------------------
// FIN de app.js
// ------------------------
