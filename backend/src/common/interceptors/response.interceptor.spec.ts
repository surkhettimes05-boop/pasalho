import { of } from 'rxjs';
import { ResponseInterceptor } from './response.interceptor';

describe('ResponseInterceptor', () => {
  it('wraps handler data in the standard API response shape', (done) => {
    const interceptor = new ResponseInterceptor();
    const context = {} as never;
    const next = { handle: () => of({ ok: true }) };

    interceptor.intercept(context, next).subscribe((response) => {
      expect(response).toEqual({ success: true, data: { ok: true } });
      done();
    });
  });
});
