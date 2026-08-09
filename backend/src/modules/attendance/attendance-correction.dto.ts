export interface CreateAttendanceCorrectionDTO {
  employeeId: string;
  companyId: string;
  attendanceId?: string;
  date: string;
  requestedCheckIn?: string;
  requestedCheckOut?: string;
  reason: string;
}

export interface RejectAttendanceCorrectionDTO {
  rejectionReason?: string;
}
