import { Injectable } from '@nestjs/common';
import { AssessmentAccessService } from '../../../common/access/assessment-access.service';

/**
 * Facade entry for Assessment application services.
 * Domain services (exams, attempts, scoring) will be added in later phases.
 */
@Injectable()
export class AssessmentService {
  constructor(private readonly assessmentAccess: AssessmentAccessService) {}

  /** Module self-check used by the health endpoint path (no I/O). */
  getModuleStatus(): { module: string; status: string } {
    return {
      module: 'assessment',
      status: 'ok',
    };
  }

  /** Expose access service for future controllers without re-injecting everywhere. */
  get access(): AssessmentAccessService {
    return this.assessmentAccess;
  }
}
