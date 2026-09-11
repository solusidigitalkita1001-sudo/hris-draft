import { Router } from 'express';
import { authenticate } from '@/shared/middleware/Authenticate';
import { authorize } from '@/shared/middleware/Authorize';
import { validate } from '@/shared/middleware/RequestValidator';
import { recruitmentController } from './recruitment.controller';
import { createJobPostingSchema, createCandidateSchema, createApplicationSchema, updateApplicationStatusSchema, createInterviewSchema, createInterviewFeedbackSchema, createOfferSchema, respondOfferSchema } from './recruitment.dto';
import { requireCompanyAccess } from '@/shared/middleware/CompanyScope';
import { auditLog } from '@/shared/middleware/AuditLog';

const router = Router();
router.use(authenticate);
router.use(requireCompanyAccess());

router.get('/job-postings', authorize({ resource: 'recruitment', action: 'read' }), recruitmentController.findAllJobPostings.bind(recruitmentController));
router.get('/job-postings/:id', authorize({ resource: 'recruitment', action: 'read' }), recruitmentController.findJobPostingById.bind(recruitmentController));
router.post('/job-postings', authorize({ resource: 'recruitment', action: 'create' }), validate(createJobPostingSchema), recruitmentController.createJobPosting.bind(recruitmentController));
router.patch('/job-postings/:id/approve', authorize({ resource: 'recruitment', action: 'approve' }), recruitmentController.approveJobPosting.bind(recruitmentController));
router.patch('/job-postings/:id/close', authorize({ resource: 'recruitment', action: 'update' }), recruitmentController.closeJobPosting.bind(recruitmentController));

router.get('/candidates', authorize({ resource: 'recruitment', action: 'read' }), recruitmentController.findAllCandidates.bind(recruitmentController));
router.get('/candidates/:id', authorize({ resource: 'recruitment', action: 'read' }), recruitmentController.findCandidateById.bind(recruitmentController));
router.post('/candidates', authorize({ resource: 'recruitment', action: 'create' }), validate(createCandidateSchema), recruitmentController.createCandidate.bind(recruitmentController));

router.get('/applications', authorize({ resource: 'recruitment', action: 'read' }), recruitmentController.findAllApplications.bind(recruitmentController));
router.post('/applications', authorize({ resource: 'recruitment', action: 'create' }), validate(createApplicationSchema), recruitmentController.createApplication.bind(recruitmentController));
router.patch('/applications/:id/status', authorize({ resource: 'recruitment', action: 'update' }), validate(updateApplicationStatusSchema), recruitmentController.updateApplicationStatus.bind(recruitmentController));

// Offers (checklist §27) — versioned; approve is maker-checker; hire requires ACCEPTED.
router.get('/applications/:id/offers', authorize({ resource: 'recruitment', action: 'read' }), recruitmentController.findOffers.bind(recruitmentController));
router.post('/applications/:id/offers', authorize({ resource: 'recruitment', action: 'create' }), validate(createOfferSchema), auditLog({ action: 'CREATE_OFFER', entity: 'Offer' }), recruitmentController.createOffer.bind(recruitmentController));
router.patch('/offers/:id/approve', authorize({ resource: 'recruitment', action: 'approve' }), auditLog({ action: 'APPROVE_OFFER', entity: 'Offer', model: 'offer' }), recruitmentController.approveOffer.bind(recruitmentController));
router.patch('/offers/:id/respond', authorize({ resource: 'recruitment', action: 'update' }), validate(respondOfferSchema), auditLog({ action: 'RESPOND_OFFER', entity: 'Offer', model: 'offer' }), recruitmentController.respondOffer.bind(recruitmentController));

router.get('/interviews', authorize({ resource: 'recruitment', action: 'read' }), recruitmentController.findAllInterviews.bind(recruitmentController));
router.post('/interviews', authorize({ resource: 'recruitment', action: 'create' }), validate(createInterviewSchema), recruitmentController.createInterview.bind(recruitmentController));
router.post('/interviews/:id/feedback', authorize({ resource: 'recruitment', action: 'create' }), validate(createInterviewFeedbackSchema), recruitmentController.submitFeedback.bind(recruitmentController));

export default router;
