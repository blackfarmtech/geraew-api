import { PlansService } from './plans.service';
import { PlanResponseDto } from './dto/plan-response.dto';
export declare class PlansController {
    private readonly plansService;
    constructor(plansService: PlansService);
    findAll(): Promise<PlanResponseDto[]>;
}
