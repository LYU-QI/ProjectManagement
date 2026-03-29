import { Controller, Get, Query, Res, BadRequestException } from '@nestjs/common';
import { Response } from 'express';
import { FeishuSsoService } from './feishu-sso.service';
import { Public } from '../auth/public.decorator';

@Controller('api/v1/auth/feishu')
export class FeishuSsoController {
  constructor(private readonly feishuSsoService: FeishuSsoService) {}

  @Get('authorize')
  @Public()
  authorize(@Res() res: Response, @Query('redirect_uri') redirectUri?: string) {
    // If a redirect_uri is provided, pass it as state
    const state = redirectUri || '';
    const url = this.feishuSsoService.buildAuthorizeUrl(state);
    return res.redirect(url);
  }

  @Get('callback')
  @Public()
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response
  ) {
    if (!code) {
      return res.status(400).send('Missing code parameter');
    }

    try {
      const result = await this.feishuSsoService.authenticate(code);

      // Store token in localStorage by redirecting with token in URL fragment
      // Use redirect_uri from state if provided
      if (state && state.startsWith('http')) {
        // Redirect to frontend with token
        const redirectUrl = new URL(state);
        redirectUrl.hash = '';
        // Pass token via postMessage pattern - redirect to a simple landing page
        const landingUrl = `${state}?sso_token=${encodeURIComponent(result.token)}&sso_user=${encodeURIComponent(JSON.stringify(result.user))}&sso_org=${encodeURIComponent(result.organizationId)}`;
        return res.redirect(landingUrl);
      }

      // Default: render a simple HTML page that stores token and redirects
      const html = `<!DOCTYPE html>
<html>
<head><title>SSO Login</title></head>
<body>
<script>
  const token = "${result.token}";
  const user = ${JSON.stringify(result.user)};
  const orgId = "${result.organizationId}";
  const orgList = ${JSON.stringify(result.orgList)};

  localStorage.setItem('projectlvqi_token', token);
  localStorage.setItem('projectlvqi_user', JSON.stringify(user));
  localStorage.setItem('activeOrgId', orgId);

  // Notify parent window if embedded
  if (window.opener) {
    window.opener.postMessage({ type: 'SSO_LOGIN', token, user, orgId, orgList }, '*');
    window.close();
  } else {
    window.location.href = '/';
  }
</script>
<p>登录成功，正在跳转...</p>
</body>
</html>`;
      res.type('text/html').send(html);
    } catch (err: any) {
      console.error('Feishu SSO callback error:', err);
      res.status(400).send(`SSO Login Failed: ${err.message}`);
    }
  }
}
