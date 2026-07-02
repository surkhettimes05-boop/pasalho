import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { RetailerRecommendationService } from './retailer-recommendation.service';
import { RetailerJwtAuthGuard } from './retailer-jwt-auth.guard';
import { CurrentRetailer } from './current-retailer.decorator';

@ApiTags('retailer-portal/recommendations')
@ApiBearerAuth()
@UseGuards(RetailerJwtAuthGuard)
@Controller('retailer-portal/recommendations')
export class RetailerRecommendationController {
  constructor(private readonly recommendationService: RetailerRecommendationService) {}

  @Get('quick-reorder')
  @ApiOperation({ summary: 'Get quick reorder suggestions' })
  @ApiQuery({ name: 'limit', required: false })
  getQuickReorder(@CurrentRetailer() retailerId: string, @Query('limit') limit?: string) {
    return this.recommendationService.getQuickReorder(retailerId, limit ? parseInt(limit, 10) : 10);
  }

  @Get('suggestions')
  @ApiOperation({ summary: 'Get reorder suggestions' })
  getReorderSuggestions(@CurrentRetailer() retailerId: string) {
    return this.recommendationService.getReorderSuggestions(retailerId);
  }
}
