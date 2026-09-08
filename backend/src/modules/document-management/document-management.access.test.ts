jest.mock('./document-management.repository', () => ({ documentManagementRepository: { findDocumentById: jest.fn(), findDocuments: jest.fn() } }));
jest.mock('@/shared/database/prisma', () => ({ prisma: {} }));
jest.mock('@/modules/administration/administration.service', () => ({ administrationService: {
  findMyDataScopeByUser: jest.fn().mockResolvedValue(null), resolveEmployeeFilterForCurrentUser: jest.fn().mockReturnValue({}),
} }));
import { DocumentManagementService } from './document-management.service';
import { documentManagementRepository } from './document-management.repository';
const service = new DocumentManagementService();
const user = { id: 'u', companyId: 'A', employeeId: 'e', roles: ['EMPLOYEE'] };
describe('document access is applied in database queries', () => {
  beforeEach(() => jest.clearAllMocks());
  it('constrains guessed document IDs to company and ownership before reading files', async () => {
    jest.mocked(documentManagementRepository.findDocumentById).mockResolvedValue(null);
    await expect(service.getDownloadPayload('foreign-id', user)).rejects.toThrow('Document not found');
    expect(documentManagementRepository.findDocumentById).toHaveBeenCalledWith('foreign-id', expect.objectContaining({
      companyId: 'A', OR: expect.arrayContaining([{ uploadedBy: 'u' }, { employeeId: 'e' }]),
    }));
  });
  it('denies a companyless caller before repository access', async () => {
    await expect(service.getDownloadPayload('id', { id: 'u' })).rejects.toThrow('Company context');
    expect(documentManagementRepository.findDocumentById).not.toHaveBeenCalled();
  });
  it('rejects cross-company listing', async () => {
    await expect(service.findDocuments({ companyId: 'B' }, user)).rejects.toThrow();
    expect(documentManagementRepository.findDocuments).not.toHaveBeenCalled();
  });
});
