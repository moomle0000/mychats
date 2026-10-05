import { RequestWithUser } from '@interfaces/auth.interface';

export class TenantContext {
  public static getTenantId(req?: RequestWithUser | any): string {
    return req?.user?.tenantId || 'personal';
  }

  public static scopeQuery<T extends Record<string, any>>(
    req?: RequestWithUser | any,
    query: T = {} as T,
  ): T & { tenantId: string } {
    return {
      ...query,
      tenantId: this.getTenantId(req),
    };
  }

  public static getCacheKey(tenantId: string, namespace: string, keySuffix: string = ''): string {
    const sanitizedSuffix = keySuffix ? `:${keySuffix}` : '';
    return `tenant:${tenantId}:${namespace}${sanitizedSuffix}`;
  }
}
