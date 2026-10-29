import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import {
  MapsComponent, LayersDirective, LayerDirective,
  MarkersDirective, MarkerDirective,
  Zoom, Marker, MapsTooltip, Inject
} from '@syncfusion/ej2-react-maps';
import type { ClaimDisplay } from '../lib/data';
import { markerTones, onTileInk } from '../domain/palette';
import { money } from '../domain/format';

interface MapsSectionProps {
  claims: ClaimDisplay[];
}

// North America framing (syncfusion-component-patterns.md, "Maps: frame the data"). The dataset is
// US-only, so we pin the starting view to the continent's centre and lock zoom-out at the framing
// zoom so the map cannot pan to the world (the standard's "Never open on the world for one country's
// data"). maxZoom 14 separates markers at city scale (1 km ≈ 0.4 px at z14).
const NORTH_AMERICA_CENTER = { latitude: 39.8283, longitude: -98.5795 };
const NORTH_AMERICA_BOUNDS = { minLat: 14.0, maxLat: 71.5, minLong: -170.0, maxLong: -52.0 };

/**
 * Measures the container before the map mounts and renders the map at that width
 * (syncfusion-component-patterns.md, "Charts in a measured container" — the same rule for Maps).
 * The map reads its own box, so it still fits when the sidebar is docked or the layout reflows.
 */
function MeasuredMap({ children }: { children: (width: number) => ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const w = Math.floor(el.getBoundingClientRect().width);
      setWidth(prev => prev === w ? prev : w);
    };
    measure();
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return <div ref={ref} className="map-slot">{width > 0 ? children(width) : null}</div>;
}

export function MapsSection({ claims }: MapsSectionProps) {
  const ton = markerTones;

  if (claims.length === 0) {
    return (
      <div className="e-card">
        <div className="e-card-header"><div className="e-card-header-caption"><div className="e-card-header-title">Claim Locations</div></div></div>
        <div className="e-card-content"><p style={{ color: 'var(--color-sf-fg-secondary)', margin: 0 }}>No claims with location data in this period.</p></div>
      </div>
    );
  }

  // Filter out markers that fall outside North America (syncfusion-component-patterns.md,
  // "Maps: frame the data"): a stray claim outside the continent pulls the framing to a world
  // view. Keep every claim whose coordinates sit inside the bounding box used to frame the map.
  const inBounds = claims.filter(c =>
    c.latitude >= NORTH_AMERICA_BOUNDS.minLat &&
    c.latitude <= NORTH_AMERICA_BOUNDS.maxLat &&
    c.longitude >= NORTH_AMERICA_BOUNDS.minLong &&
    c.longitude <= NORTH_AMERICA_BOUNDS.maxLong
  );
  const scopedClaims = inBounds.length > 0 ? inBounds : claims;

  // Marker data with fill + shape per record. Native shapes only (syncfusion-component-patterns.md,
  // "Maps markers: native shapes, not React templates"): a React template vanishes after Maps redraws
  // markers on every zoom or pan. The shape and fill come from each record's status.
  const markerData = scopedClaims.map(c => ({
    latitude: c.latitude,
    longitude: c.longitude,
    name: c.claimantName,
    id: c.id,
    amount: money(c.amount),
    status: c.status,
    city: c.city,
    state: c.state,
    markerShape: c.markerShape,
    fill: markerTones[c.statusTone],
  }));

  // City concentration, aggregated for the card's legend. The bubbles Syncfusion Maps offers need a
  // GeoJSON shape layer, which a pure OpenStreetMap tile layer does not have, so the concentration is
  // drawn as a legend line beside the map instead of as an empty bubble layer.
  const cityAgg = new Map<string, { count: number; amount: number; state: string }>();
  for (const c of scopedClaims) {
    const key = c.city;
    const existing = cityAgg.get(key);
    if (existing) {
      existing.count++;
      existing.amount += c.amount;
    } else {
      cityAgg.set(key, { count: 1, amount: c.amount, state: c.state });
    }
  }
  const topCities = [...cityAgg.entries()]
    .sort((a, b) => b[1].count - a[1].count || b[1].amount - a[1].amount)
    .slice(0, 5);

  return (
    <div className="e-card">
      <div className="e-card-header"><div className="e-card-header-caption"><div className="e-card-header-title">Claim Locations — North America</div></div></div>
      <div className="e-card-content">
        <div className="map-layout">
          <MeasuredMap>
            {mapWidth => (
              <MapsComponent
                width={`${mapWidth}px`}
                height="460px"
                background="transparent"
                zoomSettings={{
                  enable: true,
                  mouseWheelZoom: true,
                  pinchZooming: true,
                  doubleClickZoom: true,
                  shouldZoomInitially: true,
                  minZoom: 2,
                  maxZoom: 14
                }}
                centerPosition={NORTH_AMERICA_CENTER}
                // Lock zoom-out at the framing level once the map has drawn (syncfusion-component-patterns.md,
                // "Maps: frame the data", workflow 2.18.0). `tileZoomLevel` is the level the tile layer
                // started at; using it as minZoom prevents the user from zooming out until the data
                // shrinks to a corner. `loaded` exposes the Maps instance through `maps`.
                loaded={(args: { maps: { tileZoomLevel: number; zoomSettings: { minZoom?: number } } }) => {
                  const tile = args.maps.tileZoomLevel ?? 2;
                  args.maps.zoomSettings.minZoom = Math.max(2, Math.floor(tile));
                }}
              >
                <Inject services={[Zoom, Marker, MapsTooltip]} />
                <LayersDirective>
                  <LayerDirective
                    urlTemplate="https://tile.openstreetmap.org/level/tileX/tileY.png"
                  >
                    <MarkersDirective>
                      <MarkerDirective
                        visible={true}
                        dataSource={markerData}
                        shapeValuePath="markerShape"
                        colorValuePath="fill"
                        fill={ton.series[0]}
                        width={14}
                        height={14}
                        border={{ width: 1.5, color: onTileInk }}
                        // Cluster the markers that overlap at the framing zoom (syncfusion-component-patterns.md,
                        // "Maps: frame the data"). The theme's default cluster fill is orange, which reads
                        // as a "watch" status tone, so the cluster takes the slate neutral tone with a
                        // white count.
                        clusterSettings={{
                          allowClustering: true,
                          allowClusterExpand: true,
                          fill: ton.neutral,
                          border: { width: 1.5, color: onTileInk },
                          labelStyle: { color: onTileInk, size: '11px', fontWeight: '600' }
                        }}
                        tooltipSettings={{
                          visible: true,
                          valuePath: 'name',
                          format: '<strong>${name}</strong><br/>${status}<br/>${city}, ${state}<br/>${amount}'
                        }}
                      />
                    </MarkersDirective>
                  </LayerDirective>
                </LayersDirective>
              </MapsComponent>
            )}
          </MeasuredMap>
          <aside className="map-legend" aria-label="Map legend">
            <div className="map-legend__title">Marker shapes</div>
            <ul className="map-legend__list">
              <li><span className="map-legend__shape map-legend__shape--circle" aria-hidden="true" />Open claim</li>
              <li><span className="map-legend__shape map-legend__shape--diamond" aria-hidden="true" />Settlement</li>
              <li><span className="map-legend__shape map-legend__shape--triangle" aria-hidden="true" />Closed</li>
              <li><span className="map-legend__shape map-legend__shape--cluster" aria-hidden="true" />Clustered claims</li>
            </ul>
            <div className="map-legend__title">Highest claim counts</div>
            <ul className="map-legend__list map-legend__list--cities">
              {topCities.map(([city, data]) => (
                <li key={city}>
                  <span className="map-legend__city">{city}, {data.state}</span>
                  <span className="map-legend__value">{data.count} · {money(data.amount)}</span>
                </li>
              ))}
            </ul>
            <p className="map-legend__note">
              Clustered numbers group claims that overlap at this zoom level; zoom in to separate them.
            </p>
          </aside>
        </div>
      </div>
    </div>
  );
}

// Wrapper that measures container width
export function MapSectionWrapper({ claims }: { claims: ClaimDisplay[] }) {
  return <MapsSection claims={claims} />;
}