import { Router } from 'express';
import { authenticate } from '@/shared/middleware/Authenticate';
import { authorize } from '@/shared/middleware/Authorize';
import { validate } from '@/shared/middleware/RequestValidator';
import { recruitmentController } from './recruitment.controller';
import { createJobPostingSchema, createCandidateSchema, createApplicationSchema, updateApplicationStatusSchema, createInterviewSchema, createInterviewFeedbackSchema } from './recruitment.dto';
import { requireCompanyAccess } from '@/shared/middleware/CompanyScope';

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

router.get('/interviews', authorize({ resource: 'recruitment', action: 'read' }), recruitmentController.findAllInterviews.bind(recruitmentController));
router.post('/interviews', authorize({ resource: 'recruitment', action: 'create' }), validate(createInterviewSchema), recruitmentController.createInterview.bind(recruitmentController));
router.post('/interviews/:id/feedback', authorize({ resource: 'recruitment', action: 'create' }), validate(createInterviewFeedbackSchema), recruitmentController.submitFeedback.bind(recruitmentController));

export default router;
