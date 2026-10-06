import { Router } from 'express';
import { authenticate } from '@/shared/middleware/Authenticate';
import { authorize } from '@/shared/middleware/Authorize';
import { validate } from '@/shared/middleware/RequestValidator';
import { assetController } from './asset.controller';
import { createAssetSchema, assignAssetSchema, returnAssetSchema, myAssetsQuerySchema } from './asset.dto';
import { requireCompanyAccess } from '@/shared/middleware/CompanyScope';

const router = Router();
router.use(authenticate);
router.use(requireCompanyAccess());

// Employee self-service. Keep this static path before /:id.
router.get('/my', validate(myAssetsQuerySchema, 'query'), assetController.findMine.bind(assetController));
router.get('/', authorize({ resource: 'employee', action: 'read' }), assetController.findAll.bind(assetController));
router.get('/:id', authorize({ resource: 'employee', action: 'read' }), assetController.findById.bind(assetController));
router.get('/:id/depreciation', authorize({ resource: 'employee', action: 'read' }), assetController.getDepreciation.bind(assetController));
router.post('/', authorize({ resource: 'employee', action: 'create' }), validate(createAssetSchema), assetController.create.bind(assetController));
router.post('/:id/assign', authorize({ resource: 'employee', action: 'update' }), validate(assignAssetSchema), assetController.assign.bind(assetController));
// `returnAssetSchema` existed, was exported and had a DTO type — and was never
// imported here, so this route ran unvalidated. `conditionAtReturn` is a
// VarChar(20), not an enum column, so any string at all was stored as the
// condition an asset came back in.
router.post('/:id/return', authorize({ resource: 'employee', action: 'update' }), validate(returnAssetSchema), assetController.returnAsset.bind(assetController));

export default router;
