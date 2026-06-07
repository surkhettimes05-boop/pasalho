import 'reflect-metadata';
import { PaginationDto } from './pagination.dto';

describe('PaginationDto', () => {
  it('uses phase 1 pagination defaults', () => {
    const dto = new PaginationDto();

    expect(dto.page).toBe(1);
    expect(dto.limit).toBe(50);
  });
});
