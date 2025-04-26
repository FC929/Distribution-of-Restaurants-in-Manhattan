mapboxgl.accessToken = 'pk.eyJ1IjoiY2hlbmZlbmc5MjkiLCJhIjoiY20yYXBld2FmMGl5ZDJzcHk3ZHF4bjQ2NiJ9.Gr_AF5ANKXy62O-h1iiNjg';

const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/light-v10',
    center: [-73.9882, 40.7531],
    zoom: 12
});

async function loadRestaurants() {
    try {
        const response = await fetch('Manhattan_Restaurants.csv');
        if (!response.ok) throw new Error("CSV file not found or inaccessible.");
        const text = await response.text();

        const rows = text.split('\n');

        const geojson = {
            type: 'FeatureCollection',
            features: []
        };

        rows.slice(1).forEach((row) => {
            if (!row.trim()) return;

            const cols = row.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g);
            if (!cols || cols.length < 7) return;

            const dba = cols[0]?.replace(/"/g, '').trim();
            const zipcode = cols[2]?.replace(/"/g, '').trim();
            const lat = parseFloat(cols[3]);
            const lon = parseFloat(cols[4]);
            const street = cols[5]?.replace(/"/g, '').trim();
            const cuisine = cols[6]?.replace(/"/g, '').trim();

            if (zipcode && !isNaN(lat) && !isNaN(lon) && lat !== 0 && lon !== 0) {
                geojson.features.push({
                    type: 'Feature',
                    geometry: {
                        type: 'Point',
                        coordinates: [lon, lat]
                    },
                    properties: {
                        title: dba,
                        zipcode: zipcode,
                        street: street,
                        cuisine: cuisine || 'Nah'
                    }
                });
            }
        });

        map.on('load', () => {
            map.addSource('restaurants', {
                type: 'geojson',
                data: geojson,
                cluster: true,
                clusterMaxZoom: 14,
                clusterRadius: 50
            });

            map.addLayer({
                id: 'clusters',
                type: 'circle',
                source: 'restaurants',
                filter: ['has', 'point_count'],
                paint: {
                    'circle-color': [
                        'step',
                        ['get', 'point_count'],
                        '#c8f0ea', 50, '#b4e3c0', 150, '#ffe2a0', 300, '#ffc07c', 550, '#ff8c7a', 850, '#ff4b9a'
                    ],
                    'circle-radius': [
                        'step',
                        ['get', 'point_count'],
                        15, 50, 20, 150, 25, 300, 30, 550, 35, 850, 40
                    ]
                }
            });

            map.addLayer({
                id: 'cluster-count',
                type: 'symbol',
                source: 'restaurants',
                filter: ['has', 'point_count'],
                layout: {
                    'text-field': '{point_count_abbreviated}',
                    'text-size': 12
                }
            });

            map.addLayer({
                id: 'unclustered-point',
                type: 'circle',
                source: 'restaurants',
                filter: ['!', ['has', 'point_count']],
                paint: {
                    'circle-color': 'rgba(173, 255, 47, 0.4)',
                    'circle-radius': 8,
                    'circle-stroke-width': 1,
                    'circle-stroke-color': '#fff'
                }
            });

            map.on('click', 'unclustered-point', (e) => {
                const coordinates = e.features[0].geometry.coordinates.slice();
                const title = e.features[0].properties.title;
                const street = e.features[0].properties.street;
                const zipcode = e.features[0].properties.zipcode;
                const cuisine = e.features[0].properties.cuisine || 'Nah';

                new mapboxgl.Popup()
                    .setLngLat(coordinates)
                    .setHTML(`<strong>${title}</strong><br/>Street: ${street}<br/>Zipcode: ${zipcode}<br/>Cuisine: ${cuisine}`)
                    .addTo(map);
            });

            map.on('mouseenter', 'unclustered-point', () => {
                map.getCanvas().style.cursor = 'pointer';
            });
            map.on('mouseleave', 'unclustered-point', () => {
                map.getCanvas().style.cursor = '';
            });
        });

        let restaurantFeatures = [];

        map.on('load', () => {
            const source = map.getSource('restaurants');
            if (source && source._data) {
                restaurantFeatures = source._data.features.filter(f => !f.properties.point_count);
            }
        });

        const searchInput = document.getElementById('searchBox');
        const suggestionBox = document.getElementById('suggestions');

        searchInput.addEventListener('input', function (e) {
            const query = e.target.value.toLowerCase();
            suggestionBox.innerHTML = '';

            if (query.length === 0) {
                suggestionBox.style.display = 'none';
                return;
            }

            const matches = restaurantFeatures.filter(f =>
                f.properties.title.toLowerCase().includes(query) ||
                f.properties.zipcode.toLowerCase().includes(query)
            ).slice(0, 10);

            if (matches.length === 0) {
                suggestionBox.style.display = 'none';
                return;
            }

            matches.forEach(match => {
                const div = document.createElement('div');
                div.textContent = `${match.properties.title} — ${match.properties.street} (${match.properties.zipcode})`;
                div.style.padding = '6px 10px';
                div.style.cursor = 'pointer';
                div.style.borderBottom = '1px solid #eee';

                div.addEventListener('click', () => {
                    const coords = match.geometry.coordinates;
                    const title = match.properties.title;
                    const street = match.properties.street;
                    const zipcode = match.properties.zipcode;
                    const cuisine = match.properties.cuisine || 'Nah';

                    map.flyTo({ center: coords, zoom: 15 });

                    new mapboxgl.Popup()
                        .setLngLat(coords)
                        .setHTML(`<strong>${title}</strong><br/>Street: ${street}<br/>Zipcode: ${zipcode}<br/>Cuisine: ${cuisine}`)
                        .addTo(map);

                    suggestionBox.style.display = 'none';
                    searchInput.value = title;
                });

                suggestionBox.appendChild(div);
            });

            suggestionBox.style.display = 'block';
        });
    } catch (error) {
        console.error("Error loading restaurants:", error);
    }
}

loadRestaurants();