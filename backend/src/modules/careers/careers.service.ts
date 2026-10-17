import prisma from '@/shared/database/prisma';
import { ConflictError, NotFoundError } from '@/shared/exceptions/AppError';
import { logger } from '@/shared/logger/WinstonLogger';
import { runInSystemContext } from '@/shared/context/RequestContext';
import type { ApplyDTO } from './careers.dto';

/**
 * Halaman karier publik (GAP-48): pintu masuk pelamar luar ke ATS internal
 * yang sudah ada (posting → kandidat → lamaran).
 *
 * Tidak ada autentikasi, maka tidak ada konteks tenant — query berjalan dalam
 * system context dengan filter companyId EKSPLISIT di setiap klausa, pola yang
 * sama dengan penerimaan punch dari mesin absensi. Perusahaan diidentifikasi
 * kodenya di URL dan halamannya hanya hidup bila tenant MENYALAKANNYA lewat
 * setting `public_career_page_enabled` — halaman yang tidak dinyalakan
 * menjawab 404, bukan daftar kosong, supaya keberadaan tenant tidak bocor.
 *
 * Yang dipaparkan hanya kolom iklan lowongan; rentang gaji internal tidak.
 */
const PUBLIC_POSTING_SELECT = {
  code: true, title: true, employmentType: true, location: true,
  description: true, requirements: true, responsibilities: true,
  vacancies: true, postedAt: true,
};

export class CareersService {
  /** Kode perusahaan → id, hanya bila halaman kariernya dinyalakan. */
  private async enabledCompany(companyCode: string): Promise<{ id: string; name: string }> {
    return runInSystemContext('public career page', async () => {
      const company = await prisma.company.findFirst({
        where: { code: companyCode, deletedAt: null },
        select: { id: true, name: true },
      });
      if (!company) throw new NotFoundError('Halaman karier tidak ditemukan');
      const setting = await prisma.companySetting.findUnique({
        where: { companyId_key: { companyId: company.id, key: 'public_career_page_enabled' } },
        select: { value: true },
      });
      if (setting?.value !== 'true') throw new NotFoundError('Halaman karier tidak ditemukan');
      return company;
    });
  }

  async listPostings(companyCode: string) {
    const company = await this.enabledCompany(companyCode);
    return runInSystemContext('public career page', async () => {
      const postings = await prisma.jobPosting.findMany({
        where: { companyId: company.id, status: 'PUBLISHED', deletedAt: null },
        orderBy: { postedAt: 'desc' },
        select: PUBLIC_POSTING_SELECT,
      });
      return { company: { name: company.name }, postings };
    });
  }

  async getPosting(companyCode: string, postingCode: string) {
    const company = await this.enabledCompany(companyCode);
    return runInSystemContext('public career page', async () => {
      const posting = await prisma.jobPosting.findFirst({
        where: { companyId: company.id, code: postingCode, status: 'PUBLISHED', deletedAt: null },
        select: PUBLIC_POSTING_SELECT,
      });
      if (!posting) throw new NotFoundError('Lowongan tidak ditemukan');
      return { company: { name: company.name }, posting };
    });
  }

  async apply(companyCode: string, postingCode: string, input: ApplyDTO) {
    const company = await this.enabledCompany(companyCode);
    return runInSystemContext('public career application', async () => {
      const posting = await prisma.jobPosting.findFirst({
        where: { companyId: company.id, code: postingCode, status: 'PUBLISHED', deletedAt: null },
        select: { id: true, title: true },
      });
      if (!posting) throw new NotFoundError('Lowongan tidak ditemukan');

      return prisma.$transaction(async (tx) => {
        // Satu kandidat per email per perusahaan: pelamar yang kembali memakai
        // profil yang sama, riwayatnya menyatu.
        const email = input.email.toLowerCase();
        let candidate = await tx.candidate.findFirst({
          where: { companyId: company.id, email, deletedAt: null },
          select: { id: true },
        });
        if (!candidate) {
          candidate = await tx.candidate.create({
            data: {
              companyId: company.id,
              firstName: input.firstName,
              lastName: input.lastName,
              email,
              phone: input.phone,
              resume: input.resumeUrl,
              portfolio: input.portfolioUrl,
              source: 'CAREER_PAGE',
            },
            select: { id: true },
          });
        }

        const existing = await tx.jobApplication.findFirst({
          where: { jobPostingId: posting.id, candidateId: candidate.id, deletedAt: null },
          select: { id: true },
        });
        if (existing) throw new ConflictError('Lamaran untuk lowongan ini sudah pernah dikirim dengan email itu');

        const application = await tx.jobApplication.create({
          data: {
            companyId: company.id,
            jobPostingId: posting.id,
            candidateId: candidate.id,
            coverLetter: input.coverLetter,
            expectedSalary: input.expectedSalary,
          },
          select: { id: true, appliedAt: true },
        });

        logger.info('Public application received', {
          companyId: company.id, postingId: posting.id, applicationId: application.id,
        });
        // Yang keluar hanya tanda terima — id internal kandidat tidak.
        return { received: true, position: posting.title, appliedAt: application.appliedAt };
      });
    });
  }
}

export const careersService = new CareersService();
