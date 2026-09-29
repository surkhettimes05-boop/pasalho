import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { ListStoreQueryDto } from './list-store-query.dto';

describe('ListStoreQueryDto', () => {
  const pipe = new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  });

  it('accepts the branch filter together with pagination', async () => {
    const branchId = 'dc352a29-1fd4-48e7-af09-d868eaa1bd79';
    const query = await pipe.transform(
      { branchId, page: '1', limit: '20' },
      { type: 'query', metatype: ListStoreQueryDto },
    );

    expect(query.branchId).toBe(branchId);
    expect(query.page).toBe(1);
    expect(query.limit).toBe(20);
  });

  it('continues rejecting unsupported query fields', async () => {
    await expect(
      pipe.transform(
        { branchId: 'dc352a29-1fd4-48e7-af09-d868eaa1bd79', unexpected: 'value' },
        { type: 'query', metatype: ListStoreQueryDto },
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
