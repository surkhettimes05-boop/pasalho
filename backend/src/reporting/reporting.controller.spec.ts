import { ReportingController } from './reporting.controller';

describe('ReportingController authentication', () => {
  const previous = process.env.PASALO_REPORTING_API_TOKEN;

  afterEach(() => {
    if (previous === undefined) delete process.env.PASALO_REPORTING_API_TOKEN;
    else process.env.PASALO_REPORTING_API_TOKEN = previous;
  });

  it('requires the machine reporting token and returns the stable summary', async () => {
    process.env.PASALO_REPORTING_API_TOKEN = 'reporting-secret';
    const reporting = { getDailySummary: jest.fn().mockResolvedValue({ sales: {}, inventory: {} }) };
    const controller = new ReportingController(reporting as any);

    await expect(controller.dailySummary('2026-09-30T00:00:00Z', '2026-10-01T00:00:00Z', 'Bearer reporting-secret'))
      .resolves.toEqual({ sales: {}, inventory: {} });
    expect(reporting.getDailySummary).toHaveBeenCalledWith(
      new Date('2026-09-30T00:00:00Z'),
      new Date('2026-10-01T00:00:00Z'),
    );
    await expect(controller.dailySummary(undefined, undefined, 'Bearer wrong')).rejects.toThrow('Invalid PASALO reporting token.');
  });
});
