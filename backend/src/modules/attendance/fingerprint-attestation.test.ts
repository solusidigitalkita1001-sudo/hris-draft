import { AttendanceCaptureMethod } from '@prisma/client';
import { FINGERPRINT_NOT_ATTESTED, methodAttestationWarnings } from './attendance.service';

/**
 * `FINGERPRINT` now arrives two ways, and they carry different guarantees.
 *
 * Through a registered terminal (`/attendance-devices/punches`) the punch is
 * attested by hardware that authenticated with its own credential. Declared by
 * a client over the ordinary check-in endpoint it is attested by nothing — the
 * method is simply what the caller said. Face recognition is matched
 * server-side and GPS is geofenced with mock-location detection, so without
 * this marker a reviewer reading a client-declared fingerprint punch would
 * assume a verification that never happened.
 *
 * The client-declared punch is still accepted: a fingerprint-only branch with
 * no terminal installed has no other way to clock in. Only the record changes.
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

  it('drops the marker for a punch a registered terminal attested', () => {
    expect(methodAttestationWarnings(AttendanceCaptureMethod.FINGERPRINT, true)).toEqual([]);
  });

  it('keeps the marker when the method is merely claimed by the caller', () => {
    expect(methodAttestationWarnings(AttendanceCaptureMethod.FINGERPRINT, false)).toEqual([FINGERPRINT_NOT_ATTESTED]);
  });

  it('says nothing when no method was given', () => {
    expect(methodAttestationWarnings(null)).toEqual([]);
    expect(methodAttestationWarnings(undefined)).toEqual([]);
  });
});
