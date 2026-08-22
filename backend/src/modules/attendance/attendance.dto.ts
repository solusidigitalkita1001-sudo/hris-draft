import { z } from 'zod';

export const createAttendanceSchema = z.object({
  employeeId: z.string().uuid(),
  companyId: z.string().uuid(),
  date: z.string().datetime(),
  checkIn: z.string().datetime().optional(),
  checkOut: z.string().datetime().optional(),
  method: z.enum(['FINGERPRINT', 'MOBILE_GPS', 'MANUAL', 'FACE_RECOGNITION']).default('MANUAL'),
  source: z.string().max(50).optional(),
  checkInLatitude: z.number().optional(),
  checkInLongitude: z.number().optional(),
  checkOutLatitude: z.number().optional(),
  checkOutLongitude: z.number().optional(),
  status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']).default('PRESENT'),
  notes: z.string().optional(),
  /// B.7 Face Recognition Backend Ready
  faceRecognition: z
    .object({
      selfieUrl: z.string().max(500).optional(),
      referencePhotoUrl: z.string().max(500).optional(),
      similarityScore: z.number().min(-1).max(1).optional(),
      isFaceMatch: z.boolean().optional(),
      /// Task 3.3: Selfie photo base64 (data:image/jpeg;base64,...) — akan diextract vectornya otomatis oleh backend extractFaceVectorFromImage() jika client tidak mampu extract lokal (mobile/web PWA lawas).
      selfieImage: z.string().max(20_000_000).optional(), // ~20MB JPEG base64 limit
      /// Reference photo base64 (jika client mau server bandingkan foto referensi terbaru, bukan dari employee.referencePhotoUrl)
      referencePhotoImage: z.string().max(20_000_000).optional(),
      /// Preferred: client-side extract vector via face-api.js/Google ML Kit (FaceNet 512-dim normalized number[]). Jika diisi, selfieImage/referencePhotoImage tidak dipakai untuk vector.
      selfieVector: z.array(z.number()).optional(),
      referenceVector: z.array(z.number()).optional(),
      /// Extra meta: file size bytes & mime type untuk liveness assess otomatis dari foto yang dikirim
      selfieFileSizeBytes: z.number().int().min(0).optional(),
      selfieMimeType: z.string().max(100).optional(),
    })
    .optional(),
  /// B.8 Liveness
  liveness: z
    .object({
      exifMake: z.string().max(100).optional().nullable(),
      exifModel: z.string().max(100).optional().nullable(),
      exifSoftware: z.string().max(200).optional().nullable(),
      exifDateTimeOriginal: z.string().max(30).optional().nullable(),
      pixelVariance: z.number().min(0).optional().nullable(),
      fileSizeBytes: z.number().int().min(0).optional().nullable(),
      mimeType: z.string().max(100).optional().nullable(),
      clientSource: z.string().max(50).optional().nullable(),
      isLiveCapture: z.boolean().optional().nullable(),
    })
    .optional(),
  /// B.9 GPS / Mock Location
  deviceGps: z
    .object({
      isMockLocation: z.boolean().optional().nullable(),
      mockProviderApp: z.string().max(200).optional().nullable(),
      accuracyMeters: z.number().min(0).optional().nullable(),
      coordinateStaleHours: z.number().min(0).optional().nullable(),
      altitudeMeters: z.number().optional().nullable(),
      bearingDegrees: z.number().min(0).max(360).optional().nullable(),
    })
    .optional(),
});

export const checkoutAttendanceSchema = z.object({
  checkOut: z.string().datetime(),
  method: z.enum(['FINGERPRINT', 'MOBILE_GPS', 'MANUAL', 'FACE_RECOGNITION']).optional(),
  checkOutLatitude: z.number().optional(),
  checkOutLongitude: z.number().optional(),
  notes: z.string().optional(),
});

export const updateAttendanceSchema = z.object({
  checkIn: z.string().datetime().optional(),
  checkOut: z.string().datetime().optional(),
  method: z.enum(['FINGERPRINT', 'MOBILE_GPS', 'MANUAL', 'FACE_RECOGNITION']).optional(),
  checkOutLatitude: z.number().optional(),
  checkOutLongitude: z.number().optional(),
  workDuration: z.number().int().nonnegative().optional(),
  earlyLeaveMinutes: z.number().int().nonnegative().optional(),
  distanceMeters: z.number().int().nullable().optional(),
  isWithinRadius: z.boolean().nullable().optional(),
  isException: z.boolean().optional(),
  exceptionType: z
    .enum([
      'OUT_OF_RADIUS',
      'OFF_DAY_ATTENDANCE',
      'MISSING_POLICY',
      'MISSING_GPS',
      'METHOD_NOT_ALLOWED',
      'INVALID_BRANCH_CONTEXT',
    ])
    .nullable()
    .optional(),
  exceptionReason: z.string().nullable().optional(),
  requiresReview: z.boolean().optional(),
  policySnapshot: z.record(z.any()).optional(),
  status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']).optional(),
  notes: z.string().optional(),
});

export const attendanceQuerySchema = z.object({
  companyId: z.string().uuid(),
  employeeId: z.string().uuid().optional(),
  date: z.string().optional(),
  month: z.string().optional(),
  status: z.string().optional(),
});

export const attendanceContextQuerySchema = z.object({
  employeeId: z.string().uuid(),
  companyId: z.string().uuid().optional(),
  date: z.string().min(1),
});

export const createOvertimeSchema = z.object({
  employeeId: z.string().uuid(),
  companyId: z.string().uuid(),
  date: z.string().datetime(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  durationHours: z.number().positive(),
  reason: z.string().min(1),
  multiplier: z.number().default(1.5),
});

export const overtimeQuerySchema = z.object({
  companyId: z.string().uuid(),
  employeeId: z.string().uuid().optional(),
  status: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export type CreateAttendanceDTO = z.infer<typeof createAttendanceSchema>;
export type CheckoutAttendanceDTO = z.infer<typeof checkoutAttendanceSchema>;
export type UpdateAttendanceDTO = z.infer<typeof updateAttendanceSchema>;
export type CreateOvertimeDTO = z.infer<typeof createOvertimeSchema>;
