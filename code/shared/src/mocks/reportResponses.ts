export interface ReportResponse {
  success: boolean;
  message: string;
}

export const MOCK_REPORT_SUCCESS: ReportResponse = {
  success: true,
  message: 'Report submitted successfully',
};

export const MOCK_REPORT_ERROR: ReportResponse = {
  success: false,
  message: 'Failed to submit report',
};


