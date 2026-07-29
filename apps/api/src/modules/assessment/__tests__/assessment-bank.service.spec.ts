import { ConflictException } from '@nestjs/common';
import { AssessmentBankService } from '../services/assessment-bank.service';
import { AssessmentContentGuard } from '../services/assessment-content.guard';
import { ContentLifecycleStatus } from '../enums';
import { AssessmentBankRepository } from '../repositories';
import { AssessmentAccessService } from '../../../common/access/assessment-access.service';

describe('AssessmentBankService', () => {
  const banks = {
    findById: jest.fn(),
    update: jest.fn(),
    save: jest.fn(),
    findAll: jest.fn(),
    filterByStatus: jest.fn(),
  } as unknown as jest.Mocked<AssessmentBankRepository>;

  const access = {
    assertCanManageCreatedContent: jest.fn(),
  } as unknown as AssessmentAccessService;
  const service = new AssessmentBankService(banks, new AssessmentContentGuard(), access);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('published entity cannot be edited', async () => {
    banks.findById.mockResolvedValue({
      id: 'bank-1',
      name: 'HSK',
      status: ContentLifecycleStatus.Published,
    } as never);

    await expect(
      service.update(
        { sub: 'teacher-1', role: 'teacher', email: 't@test.local' },
        'bank-1',
        { name: 'Changed' },
      ),
    ).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(banks.update).not.toHaveBeenCalled();
  });
});
