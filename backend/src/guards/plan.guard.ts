import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PLANS_KEY } from '../modules/auth/plan.decorator';
import { Plan } from '@prisma/client';

@Injectable()
export class PlanGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPlans = this.reflector.getAllAndOverride<Plan[]>(PLANS_KEY, [
      context.getHandler(),
      context.getClass()
    ]);
    if (!requiredPlans || requiredPlans.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ org?: { plan?: Plan } }>();
    const org = request.org;
    const orgPlan = org?.plan || 'FREE';

    if (requiredPlans.includes(orgPlan)) {
      return true;
    }

    throw new ForbiddenException(
      `This feature requires ${requiredPlans.join(' or ')} plan. Current plan: ${orgPlan}`
    );
  }
}
