import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import * as crypto from 'crypto';

// Simple TOTP implementation without external dependencies
@Injectable()
export class TotpService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

  private toBase32(buffer: Buffer): string {
    let bits = '';
    for (const byte of buffer) {
      bits += byte.toString(2).padStart(8, '0');
    }
    // Pad to multiple of 5
    while (bits.length % 5 !== 0) bits += '0';
    let result = '';
    for (let i = 0; i < bits.length; i += 5) {
      result += this.BASE32_ALPHABET[parseInt(bits.slice(i, i + 5), 2)];
    }
    return result;
  }

  generateSecret(userId: number): { secret: string; uri: string } {
    const secret = this.toBase32(crypto.randomBytes(20)).slice(0, 32);

    // The secret stored in DB is the raw base32 string
    // We generate the provisioning URI for QR code
    const issuer = 'ProjectLVQI';
    const label = `user${userId}`;
    const uri = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(label)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;

    return { secret, uri };
  }

  async setupTotp(userId: number): Promise<{ secret: string; uri: string }> {
    const { secret, uri } = this.generateSecret(userId);

    // Encrypt secret before storing
    const encrypted = this.encryptSecret(secret);

    await this.prisma.user.update({
      where: { id: userId },
      data: { totpSecret: encrypted }
    });

    return { secret, uri };
  }

  async verifyCode(userId: number, code: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.totpSecret) {
      throw new BadRequestException('TOTP not configured');
    }

    const secret = this.decryptSecret(user.totpSecret);
    const window = 1; // Allow 1 step before/after for clock drift

    for (let i = -window; i <= window; i++) {
      const expected = this.generateTOTP(secret, i);
      if (expected === code) {
        return true;
      }
    }

    return false;
  }

  async enableTotp(userId: number, code: string): Promise<void> {
    const isValid = await this.verifyCode(userId, code);
    if (!isValid) {
      throw new BadRequestException('Invalid TOTP code');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { totpEnabled: true }
    });
  }

  async disableTotp(userId: number, code: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.totpSecret) {
      throw new BadRequestException('TOTP not configured');
    }

    const isValid = await this.verifyCode(userId, code);
    if (!isValid) {
      throw new BadRequestException('Invalid TOTP code');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { totpEnabled: false, totpSecret: null }
    });
  }

  async getTotpStatus(userId: number): Promise<{ enabled: boolean }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    return { enabled: user?.totpEnabled ?? false };
  }

  private generateTOTP(secret: string, offset: number = 0): string {
    // Decode base32 secret
    const key = this.base32ToBytes(secret);

    // Time counter (30-second windows)
    const timeStep = Math.floor(Date.now() / 30000) + offset;
    const counter = Buffer.alloc(8);
    counter.writeBigInt64BE(BigInt(timeStep), 0);

    // HMAC-SHA1
    const hmac = crypto.createHmac('sha1', key);
    hmac.update(counter);
    const hash = hmac.digest();

    // Dynamic truncation
    const offsetBits = hash[hash.length - 1] & 0x0f;
    const code =
      ((hash[offsetBits] & 0x7f) << 24) |
      ((hash[offsetBits + 1] & 0xff) << 16) |
      ((hash[offsetBits + 2] & 0xff) << 8) |
      (hash[offsetBits + 3] & 0xff);

    const otp = (code % 1000000).toString().padStart(6, '0');
    return otp;
  }

  private base32ToBytes(base32: string): Buffer {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const cleanBase32 = base32.toUpperCase().replace(/[^A-Z2-7]/g, '');
    const bits = cleanBase32.split('').flatMap(c => {
      const v = alphabet.indexOf(c);
      return [(v >> 4) & 1, (v >> 3) & 1, (v >> 2) & 1, (v >> 1) & 1, v & 1];
    });
    const bytes: number[] = [];
    for (let i = 0; i + 8 <= bits.length; i += 8) {
      bytes.push((bits[i] << 7) | (bits[i + 1] << 6) | (bits[i + 2] << 5) | (bits[i + 3] << 4) |
        (bits[i + 4] << 3) | (bits[i + 5] << 2) | (bits[i + 6] << 1) | bits[i + 7]);
    }
    return Buffer.from(bytes);
  }

  private encryptSecret(secret: string): string {
    const rawKey = process.env.TOTP_SECRET_KEY || 'projectlvqi-totp-dev-key-32';
    const key = crypto.createHash('sha256').update(rawKey).digest();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, encrypted]).toString('base64');
  }

  private decryptSecret(encrypted: string): string {
    const rawKey = process.env.TOTP_SECRET_KEY || 'projectlvqi-totp-dev-key-32';
    const key = crypto.createHash('sha256').update(rawKey).digest();
    const data = Buffer.from(encrypted, 'base64');
    const iv = data.slice(0, 16);
    const tag = data.slice(16, 32);
    const encryptedText = data.slice(32);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return decipher.update(encryptedText) + decipher.final('utf8');
  }
}
