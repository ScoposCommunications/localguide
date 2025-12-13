import { useEffect, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet.markercluster';
import type { Contribution, Category } from '../types';

interface ContributionMapProps {
  contributions: Contribution[];
  isLoading: boolean;
}

const categoryColors: Record<Category | 'Other', string> = {
  Food: '#f97316',
  Hotels: '#8b5cf6',
  Attractions: '#ec4899',
  Outdoors: '#22c55e',
  Shopping: '#3b82f6',
  Landmarks: '#eab308',
  Other: '#94a3b8',
};

function createCustomIcon(category: Category | 'Other') {
  const color = categoryColors[category] || categoryColors.Other;

  return L.divIcon({
    html: `
      <div style="
        width: 32px;
        height: 32px;
        background: ${color};
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="
          width: 8px;
          height: 8px;
          background: white;
          border-radius: 50%;
        "></div>
      </div>
    `,
    className: 'custom-marker',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });
}

function createPopupContent(contribution: Contribution): string {
  const viewCountFormatted = contribution.viewCount.toLocaleString();
  const ratingStars = contribution.rating
    ? '★'.repeat(Math.floor(contribution.rating)) + '☆'.repeat(5 - Math.floor(contribution.rating))
    : '';

  return `
    <div style="width: 280px; padding: 0;">
      <div style="
        width: 100%;
        height: 160px;
        background-image: url('${contribution.thumbnailUrl || contribution.photoUrl}');
        background-size: cover;
        background-position: center;
        border-radius: 8px 8px 0 0;
      "></div>
      <div style="padding: 16px;">
        <h3 style="
          font-size: 16px;
          font-weight: 600;
          color: white;
          margin: 0 0 8px 0;
          line-height: 1.3;
        ">${contribution.placeName}</h3>
        ${contribution.rating ? `
          <div style="color: #fbbf24; margin-bottom: 8px; font-size: 14px;">
            ${ratingStars}
          </div>
        ` : ''}
        <div style="
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;
        ">
          <span style="
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 4px 8px;
            background: rgba(52, 168, 83, 0.2);
            border-radius: 9999px;
            font-size: 12px;
            color: #34a853;
          ">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
            </svg>
            ${viewCountFormatted} views
          </span>
          <span style="
            display: inline-flex;
            padding: 4px 8px;
            background: ${categoryColors[contribution.category] || categoryColors.Other}33;
            border-radius: 9999px;
            font-size: 12px;
            color: ${categoryColors[contribution.category] || categoryColors.Other};
          ">
            ${contribution.category}
          </span>
        </div>
        <a
          href="${contribution.placeUrl}"
          target="_blank"
          rel="noopener noreferrer"
          style="
            display: inline-flex;
            align-items: center;
            gap: 4px;
            color: #3b82f6;
            font-size: 14px;
            text-decoration: none;
          "
        >
          View on Google Maps
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/>
          </svg>
        </a>
      </div>
    </div>
  `;
}

export function ContributionMap({ contributions, isLoading }: ContributionMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const clusterGroupRef = useRef<L.MarkerClusterGroup | null>(null);

  const contributionsWithCoords = useMemo(
    () => contributions.filter((c) => c.coordinates?.lat && c.coordinates?.lng),
    [contributions]
  );

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Initialize map with CartoDB Dark Matter tiles
    const map = L.map(mapRef.current, {
      center: [39.8283, -98.5795], // Center of USA
      zoom: 4,
      zoomControl: true,
      scrollWheelZoom: true,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || contributionsWithCoords.length === 0) return;

    // Remove existing cluster group
    if (clusterGroupRef.current) {
      map.removeLayer(clusterGroupRef.current);
    }

    // Create marker cluster group
    const clusterGroup = L.markerClusterGroup({
      chunkedLoading: true,
      maxClusterRadius: 50,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      iconCreateFunction: (cluster) => {
        const count = cluster.getChildCount();
        let size = 'small';
        if (count >= 10) size = 'medium';
        if (count >= 50) size = 'large';

        return L.divIcon({
          html: `<div><span>${count}</span></div>`,
          className: `marker-cluster marker-cluster-${size}`,
          iconSize: L.point(40, 40),
        });
      },
    });

    // Add markers
    contributionsWithCoords.forEach((contribution) => {
      if (!contribution.coordinates) return;

      const marker = L.marker(
        [contribution.coordinates.lat, contribution.coordinates.lng],
        { icon: createCustomIcon(contribution.category) }
      );

      marker.bindPopup(createPopupContent(contribution), {
        maxWidth: 300,
        className: 'custom-popup',
      });

      clusterGroup.addLayer(marker);
    });

    map.addLayer(clusterGroup);
    clusterGroupRef.current = clusterGroup;

    // Fit bounds to markers
    if (contributionsWithCoords.length > 0) {
      const bounds = L.latLngBounds(
        contributionsWithCoords.map((c) => [c.coordinates!.lat, c.coordinates!.lng])
      );
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
    }
  }, [contributionsWithCoords]);

  if (isLoading) {
    return (
      <div className="w-full h-[600px] md:h-[700px] bg-[#111111] rounded-xl flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#34a853] border-t-transparent rounded-full animate-spin" />
          <p className="text-[#94a3b8]">Loading map...</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="relative"
    >
      <div
        ref={mapRef}
        className="w-full h-[600px] md:h-[700px] rounded-xl overflow-hidden border border-[#1f1f1f]"
      />

      {/* Map legend */}
      <div className="absolute bottom-4 left-4 glass rounded-lg p-4 z-[1000]">
        <h4 className="text-sm font-semibold text-white mb-2">Categories</h4>
        <div className="grid grid-cols-2 gap-2">
          {(Object.entries(categoryColors) as [Category | 'Other', string][]).map(
            ([category, color]) => (
              <div key={category} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span className="text-xs text-[#94a3b8]">{category}</span>
              </div>
            )
          )}
        </div>
      </div>

      {/* Stats overlay */}
      <div className="absolute top-4 right-4 glass rounded-lg px-4 py-2 z-[1000]">
        <span className="text-sm text-[#94a3b8]">
          Showing{' '}
          <span className="text-white font-semibold">
            {contributionsWithCoords.length}
          </span>{' '}
          locations
        </span>
      </div>
    </motion.div>
  );
}
