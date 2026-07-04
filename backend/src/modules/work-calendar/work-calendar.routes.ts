import { Router } from 'express';
import { authenticate } from '@/shared/middleware/Authenticate';
import { authorize } from '@/shared/middleware/Authorize';
import { validate } from '@/shared/middleware/RequestValidator';
import { workCalendarController } from './work-calendar.controller';
import {
  createCalendarSchema, updateCalendarSchema, bulkUpdateDaysSchema,
  createHolidaySchema, updateHolidaySchema, copyCalendarSchema,
  createShiftFormulaSchema, updateShiftFormulaSchema,
  createShiftSwapRequestSchema, reviewShiftSwapRequestSchema,
} from './work-calendar.dto';

const router = Router();
router.use(authenticate);

// Calendar CRUD
router.get('/', authorize({ resource: 'work-calendar', action: 'read' }), workCalendarController.findAll.bind(workCalendarController));
router.post('/', authorize({ resource: 'work-calendar', action: 'create' }), validate(createCalendarSchema), workCalendarController.create.bind(workCalendarController));
router.get('/shift-formulas', authorize({ resource: 'work-calendar', action: 'read' }), workCalendarController.findAllShiftFormulas.bind(workCalendarController));
router.post('/shift-formulas', authorize({ resource: 'work-calendar', action: 'create' }), validate(createShiftFormulaSchema), workCalendarController.createShiftFormula.bind(workCalendarController));
router.get('/shift-formulas/:sid', authorize({ resource: 'work-calendar', action: 'read' }), workCalendarController.findShiftFormulaById.bind(workCalendarController));
router.put('/shift-formulas/:sid', authorize({ resource: 'work-calendar', action: 'update' }), validate(updateShiftFormulaSchema), workCalendarController.updateShiftFormula.bind(workCalendarController));
router.delete('/shift-formulas/:sid', authorize({ resource: 'work-calendar', action: 'delete' }), workCalendarController.deleteShiftFormula.bind(workCalendarController));
router.get('/:id', authorize({ resource: 'work-calendar', action: 'read' }), workCalendarController.findById.bind(workCalendarController));
router.put('/:id', authorize({ resource: 'work-calendar', action: 'update' }), validate(updateCalendarSchema), workCalendarController.update.bind(workCalendarController));
router.delete('/:id', authorize({ resource: 'work-calendar', action: 'delete' }), workCalendarController.delete.bind(workCalendarController));

// Calendar Days
router.get('/:id/days', authorize({ resource: 'work-calendar', action: 'read' }), workCalendarController.findDays.bind(workCalendarController));
router.put('/:id/days', authorize({ resource: 'work-calendar', action: 'update' }), validate(bulkUpdateDaysSchema), workCalendarController.bulkUpdateDays.bind(workCalendarController));
router.post('/:id/generate', authorize({ resource: 'work-calendar', action: 'update' }), workCalendarController.generateDefaultDays.bind(workCalendarController));

// Copy Calendar
router.post('/:id/copy', authorize({ resource: 'work-calendar', action: 'create' }), validate(copyCalendarSchema), workCalendarController.copyCalendar.bind(workCalendarController));

// Working Days Calculation
router.get('/:id/working-days', authorize({ resource: 'work-calendar', action: 'read' }), workCalendarController.countWorkingDays.bind(workCalendarController));

// National Holidays
router.get('/holidays/list', authorize({ resource: 'work-calendar', action: 'read' }), workCalendarController.findAllHolidays.bind(workCalendarController));
router.post('/holidays', authorize({ resource: 'work-calendar', action: 'create' }), validate(createHolidaySchema), workCalendarController.createHoliday.bind(workCalendarController));
router.put('/holidays/:hid', authorize({ resource: 'work-calendar', action: 'update' }), validate(updateHolidaySchema), workCalendarController.updateHoliday.bind(workCalendarController));
router.delete('/holidays/:hid', authorize({ resource: 'work-calendar', action: 'delete' }), workCalendarController.deleteHoliday.bind(workCalendarController));

// My Calendar
router.get('/me/resolved', workCalendarController.getMyResolvedCalendar.bind(workCalendarController));
router.get('/shift-swaps/candidates/my', workCalendarController.findShiftSwapCandidates.bind(workCalendarController));
router.get('/shift-swaps/my', workCalendarController.findMyShiftSwapRequests.bind(workCalendarController));
router.get('/shift-swaps/approvals/my', workCalendarController.findMyShiftSwapApprovals.bind(workCalendarController));
router.post('/shift-swaps', validate(createShiftSwapRequestSchema), workCalendarController.createShiftSwapRequest.bind(workCalendarController));
router.patch('/shift-swaps/:requestId/cancel', workCalendarController.cancelShiftSwapRequest.bind(workCalendarController));
router.patch('/shift-swaps/:requestId/approve', validate(reviewShiftSwapRequestSchema), workCalendarController.approveShiftSwapRequest.bind(workCalendarController));
router.patch('/shift-swaps/:requestId/reject', validate(reviewShiftSwapRequestSchema), workCalendarController.rejectShiftSwapRequest.bind(workCalendarController));

// Employee & Team Calendar
router.get('/employee/:employeeId', authorize({ resource: 'work-calendar', action: 'read' }), workCalendarController.getEmployeeCalendar.bind(workCalendarController));
router.get('/team/:managerId', authorize({ resource: 'work-calendar', action: 'read' }), workCalendarController.getTeamCalendar.bind(workCalendarController));

export default router;
