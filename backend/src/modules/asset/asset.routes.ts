import { Router } from 'express';
import { authenticate } from '@/shared/middleware/Authenticate';
import { authorize } from '@/shared/middleware/Authorize';
import { validate } from '@/shared/middleware/RequestValidator';
import { auditLog } from '@/shared/middleware/AuditLog';
import { assetController } from './asset.controller';
import {
  createAssetSchema, updateAssetSchema, assignAssetSchema, returnAssetSchema, transferAssetSchema,
  assetCategoryCreateSchema, assetCategoryUpdateSchema, assetIdParamSchema, employeeIdParamSchema,
  myAssetsQuerySchema,
} from './asset.dto';
import { requireCompanyAccess } from '@/shared/middleware/CompanyScope';

const router = Router();
router.use(authenticate);
router.use(requireCompanyAccess());

// Employee self-service. Keep static paths before /:id.
router.get('/my', validate(myAssetsQuerySchema, 'query'), assetController.findMine.bind(assetController));

// Kategori memegang metode depresiasi + umur ekonomis; tanpa CRUD ini semua
// aset jatuh ke fallback garis-lurus 4 tahun dan fitur depresiasinya nganggur.
router.get('/categories', authorize({ resource: 'asset', action: 'read' }), assetController.listCategories.bind(assetController));
router.post('/categories',
  authorize({ resource: 'asset', action: 'create' }),
  auditLog({ action: 'CREATE', entity: 'AssetCategory' }),
  validate(assetCategoryCreateSchema),
  assetController.createCategory.bind(assetController));
router.put('/categories/:id',
  authorize({ resource: 'asset', action: 'update' }),
  auditLog({ action: 'UPDATE', entity: 'AssetCategory', getEntityId: (req) => req.params.id as string }),
  validate(assetIdParamSchema, 'params'),
  validate(assetCategoryUpdateSchema),
  assetController.updateCategory.bind(assetController));
router.delete('/categories/:id',
  authorize({ resource: 'asset', action: 'delete' }),
  auditLog({ action: 'DELETE', entity: 'AssetCategory', getEntityId: (req) => req.params.id as string }),
  validate(assetIdParamSchema, 'params'),
  assetController.deleteCategory.bind(assetController));

// Aset yang masih dipegang seorang karyawan + nilai bukunya — bahan exit
// clearance dan dasar beban aset hilang di final payroll.
router.get('/outstanding/:employeeId',
  authorize({ resource: 'asset', action: 'read' }),
  validate(employeeIdParamSchema, 'params'),
  assetController.outstanding.bind(assetController));

router.get('/', authorize({ resource: 'asset', action: 'read' }), assetController.findAll.bind(assetController));
router.get('/:id', authorize({ resource: 'asset', action: 'read' }), validate(assetIdParamSchema, 'params'), assetController.findById.bind(assetController));
router.get('/:id/depreciation', authorize({ resource: 'asset', action: 'read' }), validate(assetIdParamSchema, 'params'), assetController.getDepreciation.bind(assetController));
router.post('/',
  authorize({ resource: 'asset', action: 'create' }),
  auditLog({ action: 'CREATE', entity: 'Asset' }),
  validate(createAssetSchema),
  assetController.create.bind(assetController));
router.put('/:id',
  authorize({ resource: 'asset', action: 'update' }),
  auditLog({ action: 'UPDATE', entity: 'Asset', model: 'asset', getEntityId: (req) => req.params.id as string }),
  validate(assetIdParamSchema, 'params'),
  validate(updateAssetSchema),
  assetController.update.bind(assetController));
router.delete('/:id',
  authorize({ resource: 'asset', action: 'delete' }),
  auditLog({ action: 'DELETE', entity: 'Asset', model: 'asset', getEntityId: (req) => req.params.id as string }),
  validate(assetIdParamSchema, 'params'),
  assetController.delete.bind(assetController));
router.post('/:id/assign',
  authorize({ resource: 'asset', action: 'update' }),
  auditLog({ action: 'ASSIGN', entity: 'Asset', getEntityId: (req) => req.params.id as string }),
  validate(assetIdParamSchema, 'params'),
  validate(assignAssetSchema),
  assetController.assign.bind(assetController));
// `returnAssetSchema` existed, was exported and had a DTO type — and was never
// imported here, so this route ran unvalidated. `conditionAtReturn` is a
// VarChar(20), not an enum column, so any string at all was stored as the
// condition an asset came back in.
router.post('/:id/return',
  authorize({ resource: 'asset', action: 'update' }),
  auditLog({ action: 'RETURN', entity: 'Asset', getEntityId: (req) => req.params.id as string }),
  validate(assetIdParamSchema, 'params'),
  validate(returnAssetSchema),
  assetController.returnAsset.bind(assetController));
router.post('/:id/transfer',
  authorize({ resource: 'asset', action: 'update' }),
  auditLog({ action: 'TRANSFER', entity: 'Asset', getEntityId: (req) => req.params.id as string }),
  validate(assetIdParamSchema, 'params'),
  validate(transferAssetSchema),
  assetController.transfer.bind(assetController));

export default router;
