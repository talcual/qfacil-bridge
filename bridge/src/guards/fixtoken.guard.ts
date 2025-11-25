
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { FIXED_JWT } from '../constants';

@Injectable()
export class FixedTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const auth = request.headers['authorization'];

    if (!auth) return false;

    return auth === `Bearer ${FIXED_JWT}`;
  }
}