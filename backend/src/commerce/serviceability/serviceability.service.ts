import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { GeoService } from './geo.service';
import { FulfillmentRouterService } from './fulfillment-router.service';
import { ResolveServiceabilityDto } from './dto/resolve-serviceability.dto';

@Injectable()
export class ServiceabilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly geo: GeoService,
    private readonly router: FulfillmentRouterService,
  ) {}

  async resolveCandidates(dto: ResolveServiceabilityDto) {
    const zones = await this.prisma.serviceZone.findMany({
      where: { status: 'ACTIVE' },
      orderBy: [{ priority: 'asc' }, { name: 'asc' }],
      include: {
        locations: {
          where: { isEnabled: true },
          include: {
            inventoryLocation: {
              include: {
                branch: {
                  select: {
                    id: true,
                    name: true,
                    status: true,
                    deletedAt: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const zone = zones.find((candidate) =>
      this.geo.containsPoint(candidate, dto.latitude, dto.longitude),
    );

    if (!zone) {
      return { serviceable: false as const, reason: 'OUTSIDE_SERVICE_ZONE' as const };
    }

    const locations = this.router.rank(
      zone.locations,
      dto.latitude,
      dto.longitude,
    );

    if (locations.length === 0) {
      return {
        serviceable: false as const,
        reason: 'FULFILLMENT_LOCATION_UNAVAILABLE' as const,
        serviceZone: { id: zone.id, code: zone.code, name: zone.name },
      };
    }

    return {
      serviceable: true as const,
      serviceZone: { id: zone.id, code: zone.code, name: zone.name },
      fulfillments: locations.map((location) => ({
        locationId: location.id,
        branchId: location.branchId,
        storeName: location.name,
        branchName: location.branch.name,
      })),
      delivery: {
        etaMinMinutes: zone.etaMinMinutes,
        etaMaxMinutes: zone.etaMaxMinutes,
        deliveryFee: Number(zone.deliveryFee),
        freeDeliveryThreshold:
          zone.freeDeliveryThreshold == null
            ? null
            : Number(zone.freeDeliveryThreshold),
        minOrder: Number(zone.minOrder),
      },
    };
  }

  async resolve(dto: ResolveServiceabilityDto) {
    const resolved = await this.resolveCandidates(dto);

    if (!resolved.serviceable) {
      return resolved;
    }

    return {
      serviceable: true as const,
      serviceZone: resolved.serviceZone,
      fulfillment: resolved.fulfillments[0],
      delivery: resolved.delivery,
    };
  }
}
