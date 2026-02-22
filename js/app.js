const MAP_CENTER = [45.3733, -84.9553];
const MAP_ZOOM = 16;

const MARKER_COLORS = {
    place: '#2d5a30',
    restaurant: '#2d5a30',
    shop: '#2d5a30',
    landmark: '#2d5a30',
    event: '#c07a3a',
    news: '#2e7f7c',
    spa: '#7b5ea7'
};

let map;
let allItems = [];
let markers = [];
let activeFilter = 'all';
let allPlaces = [];
let allQuestions = [];
let placeMarkers = {};

function formatPostedAt(isoStr) {
    if (!isoStr) return null;
    const date = new Date(isoStr);
    return date.toLocaleString(undefined, {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: 'numeric', minute: '2-digit'
    });
}

function formatEventDate(dateStr) {
    if (!dateStr) return null;
    const date = new Date(dateStr + 'T12:00:00');
    return date.toLocaleDateString(undefined, {
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
    });
}

function initMap() {
    map = L.map('map').setView(MAP_CENTER, MAP_ZOOM);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
        maxZoom: 20
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
    const [places, events, news, questions] = await Promise.all([
        fetchJSON('data/places.json'),
        fetchJSON('data/events.json'),
        fetchJSON('data/news.json'),
        fetchJSON('data/questions.json')
    ]);

    allPlaces = places;
    allQuestions = questions;

    allItems = [
        ...places.map(p => ({ ...p, type: 'place' })),
        ...events.map(e => ({ ...e, type: 'event' })),
        ...news.map(n => ({ ...n, type: 'news' }))
    ];

    allItems.sort((a, b) => {
        const dateA = a.postedAt ? new Date(a.postedAt) : new Date(0);
        const dateB = b.postedAt ? new Date(b.postedAt) : new Date(0);
        return dateB - dateA;
    });

    render();
}

const MARKER_ICONS = {
    place: { emoji: '🏪', label: 'Business' },
    restaurant: { emoji: '🍔', label: 'Restaurant' },
    shop: { emoji: '🛍️', label: 'Shop' },
    landmark: { emoji: '🏨', label: 'Landmark' },
    event: { emoji: '📅', label: 'Event' },
    news: { emoji: '📰', label: 'News' },
    spa: { emoji: '💆', label: 'Spa' }
};

function createMarkerIcon(type, category) {
    const icon = MARKER_ICONS[category] || MARKER_ICONS[type] || MARKER_ICONS.place;
    const color = MARKER_COLORS[category] || MARKER_COLORS[type] || MARKER_COLORS.place;
    return L.divIcon({
        className: 'custom-marker',
        html: `<div class="sim-marker" style="--marker-color:${color}"><span class="sim-marker-icon">${icon.emoji}</span></div>`,
        iconSize: [36, 44],
        iconAnchor: [18, 44],
        popupAnchor: [0, -44]
    });
}

function addMarkers(items) {
    markers.forEach(m => map.removeLayer(m));
    markers = [];
    placeMarkers = {};

    items.forEach(item => {
        const marker = L.marker([item.lat, item.lng], {
            icon: createMarkerIcon(item.type, item.category)
        }).addTo(map);

        const title = item.name || item.title;
        let popupHtml = `<div class="popup-title">${title}</div>`;
        popupHtml += `<div class="popup-desc">${item.description}</div>`;
        if (item.address) popupHtml += `<div class="popup-meta">${item.address}</div>`;
        if (item.eventDate) {
            let eventLine = formatEventDate(item.eventDate);
            if (item.eventTime) eventLine += ` · ${item.eventTime}`;
            popupHtml += `<div class="popup-meta">${eventLine}</div>`;
        }
        if (item.postedAt) popupHtml += `<div class="popup-meta popup-posted">Posted ${formatPostedAt(item.postedAt)}</div>`;
        if (item.source) popupHtml += `<div class="popup-meta">${item.source}</div>`;
        if (item.link) popupHtml += `<a class="popup-link" href="${item.link}" target="_blank" rel="noopener">Read more &rarr;</a>`;

        marker.bindPopup(popupHtml);
        markers.push(marker);

        if (item.id) {
            placeMarkers[item.id] = marker;
        }
    });
}

function render() {
    if (activeFilter === 'qa') {
        renderQA();
        addMarkers(allItems.filter(item => item.type === 'place'));
        return;
    }

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
        feed.innerHTML = '<div style="padding:32px 20px;color:#9a9889;text-align:center;font-size:14px;">Nothing here yet</div>';
        return;
    }

    items.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'feed-item';
        const title = item.name || item.title;
        const badgeClass = item.category ? `badge-${item.category}` : `badge-${item.type}`;

        let eventLine = '';
        if (item.eventDate) {
            eventLine = formatEventDate(item.eventDate);
            if (item.eventTime) eventLine += ` · ${item.eventTime}`;
        }

        const posted = item.postedAt ? formatPostedAt(item.postedAt) : '';

        div.innerHTML = `
            <span class="feed-item-badge ${badgeClass}">${item.category || item.type}</span>
            <div class="feed-item-title">${title}</div>
            ${eventLine ? `<div class="feed-item-event-date">${eventLine}</div>` : ''}
            ${item.address ? `<div class="feed-item-meta">${item.address}</div>` : ''}
            <div class="feed-item-desc">${item.description}</div>
            ${item.link ? `<a class="feed-item-link" href="${item.link}" target="_blank" rel="noopener">${item.source || 'Read more'} &rarr;</a>` : ''}
            ${posted ? `<div class="feed-item-posted">Posted ${posted}</div>` : ''}
        `;

        div.addEventListener('click', () => {
            map.flyTo([item.lat, item.lng], 16);
            markers[index]?.openPopup();
        });

        feed.appendChild(div);
    });
}

function renderQA() {
    const feed = document.getElementById('feed');
    feed.innerHTML = '';

    if (allQuestions.length === 0) {
        feed.innerHTML = '<div style="padding:32px 20px;color:#9a9889;text-align:center;font-size:14px;">No questions yet</div>';
        return;
    }

    allQuestions.forEach(q => {
        const card = document.createElement('div');
        card.className = 'qa-card';

        const answerPlaces = q.answerPlaceIds
            .map(id => allPlaces.find(p => p.id === id))
            .filter(Boolean);

        let answersHtml = '';
        answerPlaces.forEach(place => {
            answersHtml += `
                <div class="qa-answer-item" data-place-id="${place.id}">
                    <div class="qa-answer-name">${place.name}</div>
                    <div class="qa-answer-addr">${place.address}</div>
                    <div class="qa-answer-desc">${place.description}</div>
                </div>
            `;
        });

        card.innerHTML = `
            <div class="qa-question">${q.question}</div>
            <div class="qa-answers">${answersHtml}</div>
        `;

        card.querySelector('.qa-question').addEventListener('click', () => {
            card.classList.toggle('expanded');
        });

        card.querySelectorAll('.qa-answer-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const placeId = item.dataset.placeId;
                const place = allPlaces.find(p => p.id === placeId);
                if (place) {
                    map.flyTo([place.lat, place.lng], 16);
                    if (placeMarkers[placeId]) {
                        placeMarkers[placeId].openPopup();
                    }
                }
            });
        });

        feed.appendChild(card);
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
