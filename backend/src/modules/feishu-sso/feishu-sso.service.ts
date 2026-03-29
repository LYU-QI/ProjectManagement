import { Injectable, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../database/prisma.service';
import { ConfigService } from '../config/config.service';

interface FeishuUserInfo {
  sub?: string;
  open_id?: string;
  union_id?: string;
  name?: string;
  avatar_url?: string;
  email?: string;
}

interface OrgInfo {
  orgId: string;
  orgName: string;
  orgRole: string;
}

@Injectable()
export class FeishuSsoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService
  ) {}

  private get appId(): string {
    return this.configService.getRawValue('FEISHU_APP_ID') || '';
  }

  private get appSecret(): string {
    return this.configService.getRawValue('FEISHU_APP_SECRET') || '';
  }

  private get redirectUri(): string {
    return `${this.configService.getRawValue('APP_URL') || 'http://localhost:3000'}/api/v1/auth/feishu/callback`;
  }

  buildAuthorizeUrl(state?: string): string {
    const params = new URLSearchParams({
      app_id: this.appId,
      redirect_uri: this.redirectUri,
      state: state || this.generateState(),
      response_type: 'code'
    });
    return `https://open.feishu.cn/open-apis/authen/v1/authorize?${params.toString()}`;
  }

  async exchangeCodeForToken(code: string): Promise<{ accessToken: string; expiresIn: number }> {
    const url = 'https://open.feishu.cn/open-apis/authen/v1/oidc/access_token';
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        app_id: this.appId,
        app_secret: this.appSecret
      })
    });

    if (!res.ok) {
      const text = await res.text();
      throw new BadRequestException(`Feishu token exchange failed: HTTP ${res.status} ${text}`);
    }

    const data = (await res.json()) as { code?: number; msg?: string; data?: { access_token: string; expires_in: number } };
    if (data.code !== 0 || !data.data) {
      throw new BadRequestException(`Feishu token exchange failed: ${data.code} ${data.msg}`);
    }

    return { accessToken: data.data.access_token, expiresIn: data.data.expires_in };
  }

  async getUserInfoByToken(accessToken: string): Promise<FeishuUserInfo> {
    const url = 'https://open.feishu.cn/open-apis/authen/v1/user_info';
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!res.ok) {
      const text = await res.text();
      throw new BadRequestException(`Feishu user info failed: HTTP ${res.status} ${text}`);
    }

    const data = (await res.json()) as { code?: number; msg?: string; data?: FeishuUserInfo };
    if (data.code !== 0 || !data.data) {
      throw new BadRequestException(`Feishu user info failed: ${data.code} ${data.msg}`);
    }

    return data.data;
  }

  async authenticate(code: string): Promise<{ token: string; user: { id: number; name: string; role: string }; organizationId: string; orgList: OrgInfo[] }> {
    // Step 1: exchange code for token
    const { accessToken } = await this.exchangeCodeForToken(code);

    // Step 2: get user info
    const feishuUser = await this.getUserInfoByToken(accessToken);
    const openId = feishuUser.open_id || feishuUser.sub || '';
    const unionId = feishuUser.union_id || '';

    if (!openId) {
      throw new BadRequestException('Failed to get Feishu open_id');
    }

    // Step 3: find or create user by feishuOpenId
    let user = await this.prisma.user.findFirst({
      where: { feishuOpenId: openId }
    });

    if (!user) {
      // Auto-register new user
      const defaultOrg = await this.prisma.organization.findFirst({
        orderBy: { createdAt: 'asc' }
      });

      if (!defaultOrg) {
        throw new BadRequestException('No default organization found. Please contact administrator.');
      }

      // Create user
      user = await this.prisma.user.create({
        data: {
          name: feishuUser.name || `Feishu-${openId.slice(0, 8)}`,
          feishuOpenId: openId,
          feishuUnionId: unionId || undefined,
          role: 'member',
          username: `feishu_${openId.slice(0, 16)}`
        }
      });

      // Create OrgMember
      await this.prisma.orgMember.create({
        data: {
          id: `${defaultOrg.id}-${user.id}`,
          userId: user.id,
          organizationId: defaultOrg.id,
          orgRole: 'member'
        }
      });
    }

    // Step 4: fetch user's org memberships
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

    // Step 5: sign JWT
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
      user: {
        id: user.id,
        name: user.name,
        role: user.role
      },
      organizationId: defaultOrg.orgId,
      orgList
    };
  }

  private generateState(): string {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
}
