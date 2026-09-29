import { AttendanceCaptureMethod } from '@prisma/client';
import { FINGERPRINT_NOT_ATTESTED, methodAttestationWarnings } from './attendance.service';

/**
 * `FINGERPRINT` exists in both attendance method enums, but nothing attests it:
 * no device integration, no device credential, no punch import — the method is
 * whatever the caller claims. Face recognition is matched server-side and GPS is
 * geofenced with mock-location detection, so without this marker a reviewer
 * reading a fingerprint punch would assume a verification that never happened.
 *
 * The punch is still accepted: a fingerprint-only branch has no other way to
 * clock in until devices exist. Only the record changes.
 */
describe('attendance method attestation', () => {
  it('marks a fingerprint punch as not device-attested', () => {
    expect(methodAttestationWarnings(AttendanceCaptureMethod.FINGERPRINT)).toEqual([FINGERPRINT_NOT_ATTESTED]);
  });

  it.each([
    AttendanceCaptureMethod.MOBILE_GPS,
    AttendanceCaptureMethod.FACE_RECOGNITION,
    AttendanceCaptureMethod.MANUAL,
  ])('leaves %s unmarked — each is verified or declared on its own terms', (method) => {
    expect(methodAttestationWarnings(method)).toEqual([]);
  });

  it('says nothing when no method was given', () => {
    expect(methodAttestationWarnings(null)).toEqual([]);
    expect(methodAttestationWarnings(undefined)).toEqual([]);
  });
});
