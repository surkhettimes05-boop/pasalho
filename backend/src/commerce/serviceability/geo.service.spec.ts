import { GeoService } from './geo.service';

describe('GeoService', () => {
  const geo = new GeoService();

  it('resolves a point inside a radius', () => {
    expect(
      geo.containsPoint(
        { centerLat: 28.6, centerLng: 81.63, radiusMeters: 3000 },
        28.61,
        81.63,
      ),
    ).toBe(true);
  });

  it('rejects a point outside a radius', () => {
    expect(
      geo.containsPoint(
        { centerLat: 28.6, centerLng: 81.63, radiusMeters: 1000 },
        28.7,
        81.63,
      ),
    ).toBe(false);
  });

  it('supports GeoJSON polygons with longitude-latitude coordinate order', () => {
    const polygon = {
      type: 'Polygon',
      coordinates: [[
        [81.60, 28.58],
        [81.66, 28.58],
        [81.66, 28.64],
        [81.60, 28.64],
        [81.60, 28.58],
      ]],
    };
    expect(geo.containsPoint({ polygon }, 28.60, 81.63)).toBe(true);
    expect(geo.containsPoint({ polygon }, 28.70, 81.63)).toBe(false);
  });
});
