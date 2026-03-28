import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModuleOptions, ThrottlerStorage } from '@nestjs/throttler';
export declare class CustomThrottlerGuard extends ThrottlerGuard {
    constructor(options: ThrottlerModuleOptions, storageService: ThrottlerStorage, reflector: Reflector);
    protected shouldSkip(_context: ExecutionContext): Promise<boolean>;
    protected getTracker(req: Record<string, any>): Promise<string>;
}
