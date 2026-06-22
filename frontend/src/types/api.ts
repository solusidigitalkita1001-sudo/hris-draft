export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  meta?: PaginationMeta;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface ApiError {
  success: false;
  code: string;
  message: string;
  errors?: Array<{
    field: string;
    message: string;
  }>;
}

export interface ApiConfig {
  baseURL: string;
  timeout: number;
}
