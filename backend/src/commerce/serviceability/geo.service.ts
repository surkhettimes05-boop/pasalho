import { Injectable } from '@nestjs/common';

interface ZoneGeometry {
  polygon?: unknown;
  centerLat?: unknown;
  centerLng?: unknown;
  radiusMeters?: number | null;
}

@Injectable()
export class GeoService {
  containsPoint(zone: ZoneGeometry, latitude: number, longitude: number): boolean {
    if (zone.polygon && this.pointInGeoJsonPolygon(zone.polygon, latitude, longitude)) {
      return true;
    }

    if (zone.centerLat != null && zone.centerLng != null && zone.radiusMeters != null) {
      return (
        this.distanceMeters(
          Number(zone.centerLat),
          Number(zone.centerLng),
          latitude,
          longitude,
        ) <= zone.radiusMeters
      );
    }

    return false;
  }

  distanceMeters(
    latA: number,
    lngA: number,
    latB: number,
    lngB: number,
  ): number {
    const earthRadius = 6371000;
    const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
    const dLat = toRadians(latB - latA);
    const dLng = toRadians(lngB - lngA);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRadians(latA)) *
        Math.cos(toRadians(latB)) *
        Math.sin(dLng / 2) ** 2;
    return 2 * earthRadius * Math.asin(Math.sqrt(a));
  }

  private pointInGeoJsonPolygon(
    polygon: unknown,
    latitude: number,
    longitude: number,
  ): boolean {
    if (!polygon || typeof polygon !== 'object') return false;
    const value = polygon as { type?: unknown; coordinates?: unknown };
    if (value.type !== 'Polygon' || !Array.isArray(value.coordinates)) return false;

    const rings = value.coordinates as unknown[];
    if (rings.length === 0 || !this.pointInRing(rings[0], latitude, longitude)) {
      return false;
    }

    for (let index = 1; index < rings.length; index += 1) {
      if (this.pointInRing(rings[index], latitude, longitude)) return false;
    }
    return true;
  }

  private pointInRing(
    rawRing: unknown,
    latitude: number,
    longitude: number,
  ): boolean {
    if (!Array.isArray(rawRing) || rawRing.length < 3) return false;
    const ring = rawRing.filter(
      (point): point is [number, number] =>
        Array.isArray(point) &&
        point.length >= 2 &&
        Number.isFinite(Number(point[0])) &&
        Number.isFinite(Number(point[1])),
    );
    if (ring.length < 3) return false;

    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = Number(ring[i][0]);
      const yi = Number(ring[i][1]);
      const xj = Number(ring[j][0]);
      const yj = Number(ring[j][1]);

      const intersects =
        yi > latitude !== yj > latitude &&
        longitude < ((xj - xi) * (latitude - yi)) / (yj - yi) + xi;
      if (intersects) inside = !inside;
    }
    return inside;
  }
}
