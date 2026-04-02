import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../database/prisma.service';

export interface OrgInfo {
  orgId: string;
  orgName: string;
  orgRole: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService
  ) {}

  async register(username: string, password: string, name: string) {
    const existing = await this.prisma.user.findFirst({ where: { username } });
    if (existing) {
      throw new UnauthorizedException('用户名已存在');
    }

    const user = await this.prisma.user.create({
      data: { username, password, name, role: 'member' }
    });

    // New users join the default organization (created by seed/admin)
    const memberships = await this.prisma.orgMember.findMany({
      where: { userId: user.id },
      include: { organization: true }
    });
    const orgList: OrgInfo[] = memberships.map(m => ({
      orgId: m.organizationId,
      orgName: m.organization.name,
      orgRole: m.orgRole
    }));
    const defaultOrg = orgList[0] ?? { orgId: 'default', orgName: 'Default Organization', orgRole: 'member' as const };

    const payload = {
      sub: user.id,
      name: user.name,
      role: user.role,
      organizationId: defaultOrg.orgId,
      orgRole: defaultOrg.orgRole,
      orgList
    };
    const token = await this.jwtService.signAsync(payload);

    return {
      token,
      user: { id: user.id, name: user.name, role: user.role },
      organizationId: defaultOrg.orgId,
      orgList
    };
  }

  async login(username: string, password: string) {
    const user = await this.prisma.user.findFirst({
      where: { username }
    });
    if (!user || !user.password || user.password !== password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const memberships = await this.prisma.orgMember.findMany({
      where: { userId: user.id },
      include: { organization: true }
    });

    const orgList: OrgInfo[] = memberships.map(m => ({
      orgId: m.organizationId,
      orgName: m.organization.name,
      orgRole: m.orgRole
    }));

    const defaultOrg = orgList[0] ?? { orgId: 'default', orgName: 'Default Organization', orgRole: 'member' as const };

    const payload = {
      sub: user.id,
      name: user.name,
      role: user.role,
      organizationId: defaultOrg.orgId,
      orgRole: defaultOrg.orgRole,
      orgList
    };
    const token = await this.jwtService.signAsync(payload);

    return {
      token,
      user: { id: user.id, name: user.name, role: user.role },
      organizationId: defaultOrg.orgId,
      orgList
    };
  }
}
