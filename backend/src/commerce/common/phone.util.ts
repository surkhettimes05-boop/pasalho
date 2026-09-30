import { AppError } from '../../common/errors/app-error';
import { ErrorCodes } from '../../common/errors/error-codes';

export function normalizeNepalPhone(input: string): string {
  const compact = input.replace(/[\s()-]/g, '');
  if (/^\+9779\d{9}$/.test(compact)) return compact;
  if (/^9779\d{9}$/.test(compact)) return `+${compact}`;
  if (/^9\d{9}$/.test(compact)) return `+977${compact}`;
  throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Enter a valid Nepal mobile number.', 422);
}
