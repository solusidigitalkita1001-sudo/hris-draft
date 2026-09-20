import { AttendanceCaptureMethod } from '@prisma/client';
import { enforceTrustedFaceRecognition } from './attendance.service';

const selfieImage = `data:image/jpeg;base64,${'a'.repeat(64)}`;

describe('trusted face-recognition request policy', () => {
  it('rejects face payloads smuggled through a non-face attendance method', () => {
    expect(() => enforceTrustedFaceRecognition(
      AttendanceCaptureMethod.MANUAL,
      { selfieImage },
      false,
    )).toThrow(/hanya boleh dipakai dengan method FACE_RECOGNITION/i);
  });

  it.each([
    ['selfieVector', [1, 0, 0]],
    ['referenceVector', [1, 0, 0]],
    ['referencePhotoImage', selfieImage],
    ['referencePhotoUrl', '/uploads/reference.jpg'],
    ['selfieUrl', '/uploads/selfie.jpg'],
    ['similarityScore', 1],
    ['isFaceMatch', true],
  ])('rejects client-supplied derived biometric field %s', (field, value) => {
    expect(() => enforceTrustedFaceRecognition(
      AttendanceCaptureMethod.FACE_RECOGNITION,
      { selfieImage, [field]: value },
      true,
    )).toThrow(/seluruh keputusan biometrik harus berasal dari server/i);
  });

  it('accepts only the source selfie once a trusted server profile exists', () => {
    expect(() => enforceTrustedFaceRecognition(
      AttendanceCaptureMethod.FACE_RECOGNITION,
      { selfieImage },
      true,
    )).not.toThrow();
  });

  it('fails closed when the server profile is missing', () => {
    expect(() => enforceTrustedFaceRecognition(
      AttendanceCaptureMethod.FACE_RECOGNITION,
      { selfieImage },
      false,
    )).toThrow(/profil wajah karyawan belum terdaftar/i);
  });

  describe('when the resolved attendance policy requires a selfie', () => {
    it('requires a selfie even for MOBILE_GPS attendance', () => {
      expect(() => enforceTrustedFaceRecognition(
        AttendanceCaptureMethod.MOBILE_GPS,
        undefined,
        true,
        true,
      )).toThrow(/membutuhkan selfieImage/i);
    });

    it('requires a trusted server profile for MOBILE_GPS attendance', () => {
      expect(() => enforceTrustedFaceRecognition(
        AttendanceCaptureMethod.MOBILE_GPS,
        { selfieImage },
        false,
        true,
      )).toThrow(/profil wajah karyawan belum terdaftar/i);
    });

    it('accepts a source selfie backed by a trusted server profile', () => {
      expect(() => enforceTrustedFaceRecognition(
        AttendanceCaptureMethod.MOBILE_GPS,
        { selfieImage },
        true,
        true,
      )).not.toThrow();
    });
  });
});
