import { Logger } from '@nestjs/common';

export const OTP_PROVIDER = Symbol('OTP_PROVIDER');

export interface OtpProvider {
  send(phone: string, code: string): Promise<void>;
}

export class ConsoleOtpProvider implements OtpProvider {
  private readonly logger = new Logger(ConsoleOtpProvider.name);
  async send(phone: string, code: string): Promise<void> {
    this.logger.warn(`Development OTP for ${phone}: ${code}`);
  }
}

export class HttpOtpProvider implements OtpProvider {
  constructor(private readonly url: string, private readonly token: string) {}
  async send(phone: string, code: string): Promise<void> {
    const response = await fetch(this.url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify({ phone, code }),
    });
    if (!response.ok) throw new Error(`OTP provider failed with HTTP ${response.status}`);
  }
}
