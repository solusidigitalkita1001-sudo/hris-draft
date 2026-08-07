import { Router } from 'express';
import { authenticate } from '@/shared/middleware/Authenticate';
import { authorize } from '@/shared/middleware/Authorize';
import { validate } from '@/shared/middleware/RequestValidator';
import { assetController } from './asset.controller';
import { createAssetSchema, assignAssetSchema } from './asset.dto';

const router = Router();
router.use(authenticate);

router.get('/', authorize({ resource: 'employee', action: 'read' }), assetController.findAll.bind(assetController));
router.get('/:id', authorize({ resource: 'employee', action: 'read' }), assetController.findById.bind(assetController));
router.get('/:id/depreciation', authorize({ resource: 'employee', action: 'read' }), assetController.getDepreciation.bind(assetController));
router.post('/', authorize({ resource: 'employee', action: 'create' }), validate(createAssetSchema), assetController.create.bind(assetController));
router.post('/:id/assign', authorize({ resource: 'employee', action: 'update' }), validate(assignAssetSchema), assetController.assign.bind(assetController));
router.post('/:id/return', authorize({ resource: 'employee', action: 'update' }), assetController.returnAsset.bind(assetController));

export default router;
