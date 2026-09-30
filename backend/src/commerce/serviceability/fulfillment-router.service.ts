import { Injectable } from '@nestjs/common';
import { GeoService } from './geo.service';

type Candidate = {
  priority: number;
  isEnabled: boolean;
  inventoryLocation: {
    id: string;
    name: string;
    type: string;
    status: string;
    latitude: unknown;
    longitude: unknown;
    branchId: string;
    branch: {
      id: string;
      name: string;
      status: string;
      deletedAt: Date | null;
    };
  };
};

@Injectable()
export class FulfillmentRouterService {
  constructor(private readonly geo: GeoService) {}

  select(candidates: Candidate[], latitude: number, longitude: number) {
    const eligible = candidates
      .filter(
        (candidate) =>
          candidate.isEnabled &&
          candidate.inventoryLocation.status === 'ACTIVE' &&
          candidate.inventoryLocation.type === 'STORE' &&
          candidate.inventoryLocation.branch.status === 'ACTIVE' &&
          !candidate.inventoryLocation.branch.deletedAt,
      )
      .map((candidate) => ({
        candidate,
        distanceMeters:
          candidate.inventoryLocation.latitude != null &&
          candidate.inventoryLocation.longitude != null
            ? this.geo.distanceMeters(
                latitude,
                longitude,
                Number(candidate.inventoryLocation.latitude),
                Number(candidate.inventoryLocation.longitude),
              )
            : Number.POSITIVE_INFINITY,
      }))
      .sort(
        (left, right) =>
          left.candidate.priority - right.candidate.priority ||
          left.distanceMeters - right.distanceMeters ||
          left.candidate.inventoryLocation.name.localeCompare(
            right.candidate.inventoryLocation.name,
          ),
      );

    return eligible[0]?.candidate.inventoryLocation ?? null;
  }
}
