const MAP_CENTER = [45.3733, -84.9553];
const MAP_ZOOM = 14;

const MARKER_COLORS = {
    place: '#2563eb',
    restaurant: '#2563eb',
    shop: '#2563eb',
    landmark: '#2563eb',
    event: '#16a34a',
    news: '#dc2626'
};

let map;
let allItems = [];
let markers = [];
let activeFilter = 'all';

function initMap() {
    map = L.map('map').setView(MAP_CENTER, MAP_ZOOM);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
}

async function fetchJSON(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) return [];
        return await response.json();
    } catch {
        return [];
    }
}

async function loadData() {
    const [places, events, news] = await Promise.all([
        fetchJSON('data/places.json'),
        fetchJSON('data/events.json'),
        fetchJSON('data/news.json')
    ]);

    allItems = [
        ...places.map(p => ({ ...p, type: 'place' })),
        ...events.map(e => ({ ...e, type: 'event' })),
        ...news.map(n => ({ ...n, type: 'news' }))
    ];

    allItems.sort((a, b) => {
        const dateA = a.date ? new Date(a.date) : new Date(0);
        const dateB = b.date ? new Date(b.date) : new Date(0);
        return dateB - dateA;
    });

    render();
}

function createMarkerIcon(type) {
    const color = MARKER_COLORS[type] || MARKER_COLORS.place;
    return L.divIcon({
        className: 'custom-marker',
        html: `<div style="background:${color};width:12px;height:12px;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.3);"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8]
    });
}

function addMarkers(items) {
    markers.forEach(m => map.removeLayer(m));
    markers = [];

    items.forEach(item => {
        const marker = L.marker([item.lat, item.lng], {
            icon: createMarkerIcon(item.type || item.category)
        }).addTo(map);

        const title = item.name || item.title;
        let popupHtml = `<div class="popup-title">${title}</div>`;
        popupHtml += `<div class="popup-desc">${item.description}</div>`;
        if (item.address) popupHtml += `<div class="popup-meta">${item.address}</div>`;
        if (item.date) popupHtml += `<div class="popup-meta">${item.date}</div>`;
        if (item.time) popupHtml += `<div class="popup-meta">${item.time}</div>`;

        marker.bindPopup(popupHtml);
        markers.push(marker);
    });
}

function render() {
    const filtered = activeFilter === 'all'
        ? allItems
        : allItems.filter(item => item.type === activeFilter);

    addMarkers(filtered);
    renderFeed(filtered);
}

function renderFeed(items) {
    const feed = document.getElementById('feed');
    feed.innerHTML = '';

    if (items.length === 0) {
        feed.innerHTML = '<div style="padding:20px;color:#888;text-align:center;">No items to show</div>';
        return;
    }

    items.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'feed-item';
        const title = item.name || item.title;
        const badgeClass = `badge-${item.type}`;

        let meta = '';
        if (item.date) meta += item.date;
        if (item.time) meta += ` · ${item.time}`;
        if (item.source) meta += ` · ${item.source}`;
        if (item.address) meta += item.address;

        div.innerHTML = `
            <span class="feed-item-badge ${badgeClass}">${item.type}</span>
            <div class="feed-item-title">${title}</div>
            ${meta ? `<div class="feed-item-meta">${meta}</div>` : ''}
            <div class="feed-item-desc">${item.description}</div>
        `;

        div.addEventListener('click', () => {
            map.flyTo([item.lat, item.lng], 16);
            markers[index]?.openPopup();
        });

        feed.appendChild(div);
    });
}

function initFilters() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelector('.filter-btn.active').classList.remove('active');
            btn.classList.add('active');
            activeFilter = btn.dataset.filter;
            render();
        });
    });
}

function initSidebarToggle() {
    document.getElementById('sidebar-toggle').addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('collapsed');
        document.getElementById('map').classList.toggle('expanded');
        setTimeout(() => map.invalidateSize(), 300);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    initMap();
    initFilters();
    initSidebarToggle();
    loadData();
});
