export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  meta?: PaginationMeta;
}

export class Result {
  static success<T>(data: T, message: string = 'Success'): ApiResponse<T> {
    return {
      success: true,
      message,
      data,
    };
  }

  static paginated<T>(
    data: T[],
    total: number,
    page: number,
    limit: number,
    message: string = 'Success'
  ): ApiResponse<T[]> {
    const totalPages = Math.ceil(total / limit);
    return {
      success: true,
      message,
      data,
      meta: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  static error(message: string, code?: string): ApiResponse<null> {
    return {
      success: false,
      message,
      ...(code && { code }),
    };
  }

  static created<T>(data: T, message: string = 'Created successfully'): ApiResponse<T> {
    return {
      success: true,
      message,
      data,
    };
  }

  static deleted(message: string = 'Deleted successfully'): ApiResponse<null> {
    return {
      success: true,
      message,
      data: null,
    };
  }

  static updated<T>(data: T, message: string = 'Updated successfully'): ApiResponse<T> {
    return {
      success: true,
      message,
      data,
    };
  }

  static noContent(message: string = 'No content'): ApiResponse<null> {
    return {
      success: true,
      message,
      data: null,
    };
  }
}
