export const appConfig = {
  appName: 'HRMS Enterprise',
  apiPrefix: '/api/v1',
  apiUrl: import.meta.env.VITE_API_URL || '/api/v1',
  authTokenKey: 'hrms_access_token',
  refreshTokenKey: 'hrms_refresh_token',
  companyKey: 'hrms_active_company',
  languageKey: 'hrms_language',
  themeKey: 'hrms_theme',
  pagination: {
    defaultPageSize: 20,
    pageSizeOptions: [10, 20, 50, 100],
  },
  date: {
    format: 'DD/MM/YYYY',
    datetimeFormat: 'DD/MM/YYYY HH:mm',
    timeFormat: 'HH:mm',
  },
} as const;

export const constants = {
  MAX_UPLOAD_SIZE: 5 * 1024 * 1024, // 5MB
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif'],
  DEBOUNCE_DELAY: 300,
  SEARCH_DELAY: 500,
} as const;
