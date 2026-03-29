import { Injectable, NotFoundException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';

const VALID_PERMISSIONS = ['read', 'write', 'admin'];

@Injectable()
export class ApiKeysService {
  constructor(private readonly prisma: PrismaService) {}

  async list(organizationId: string) {
    const rows = await this.prisma.orgApiKey.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' }
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      keyPrefix: row.keyPrefix,
      permissions: row.permissions,
      lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
      expiresAt: row.expiresAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString()
    }));
  }

  async generateKey(organizationId: string, name: string, permissions: string[]) {
    const invalid = permissions.filter((p) => !VALID_PERMISSIONS.includes(p));
    if (invalid.length > 0) {
      throw new BadRequestException(`Invalid permissions: ${invalid.join(', ')}. Valid: ${VALID_PERMISSIONS.join(', ')}`);
    }

    const rawKey = `pk_${crypto.randomBytes(24).toString('base64url')}`;
    const keyHash = await bcrypt.hash(rawKey, 10);
    const keyPrefix = rawKey.slice(0, 8);

    const row = await this.prisma.orgApiKey.create({
      data: {
        organizationId,
        name,
        keyPrefix,
        keyHash,
        permissions
      }
    });

    return {
      id: row.id,
      name: row.name,
      key: rawKey,
      keyPrefix: row.keyPrefix,
      permissions: row.permissions,
      createdAt: row.createdAt.toISOString()
    };
  }

  async revokeKey(id: string, organizationId: string) {
    const existing = await this.prisma.orgApiKey.findFirst({ where: { id, organizationId } });
    if (!existing) throw new NotFoundException('API Key not found');
    await this.prisma.orgApiKey.delete({ where: { id } });
    return { success: true };
  }

  async validateKey(rawKey: string) {
    if (!rawKey.startsWith('pk_')) {
      throw new UnauthorizedException('Invalid API key format');
    }

    const candidates = await this.prisma.orgApiKey.findMany({
      where: { keyPrefix: rawKey.slice(0, 8) }
    });

    for (const candidate of candidates) {
      const match = await bcrypt.compare(rawKey, candidate.keyHash);
      if (!match) continue;

      if (candidate.expiresAt && candidate.expiresAt < new Date()) {
        throw new UnauthorizedException('API key has expired');
      }

      await this.prisma.orgApiKey.update({
        where: { id: candidate.id },
        data: { lastUsedAt: new Date() }
      });

      return {
        organizationId: candidate.organizationId,
        permissions: candidate.permissions,
        name: candidate.name
      };
    }

    throw new UnauthorizedException('Invalid API key');
  }
}
