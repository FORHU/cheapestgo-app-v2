export type ErrorCode =
    | 'AUTH_REQUIRED'
    | 'AUTH_INVALID'
    | 'FORBIDDEN'
    | 'NOT_FOUND'
    | 'VALIDATION_ERROR'
    | 'CONFLICT'
    | 'RATE_LIMITED'
    | 'INTERNAL_ERROR';

export class ApiError extends Error {
    constructor(
        public status: number,
        message: string,
        public code?: ErrorCode,
    ) {
        super(message);
        this.name = 'ApiError';
    }

    get isAuth()       { return this.status === 401; }
    get isForbidden()  { return this.status === 403; }
    get isNotFound()   { return this.status === 404; }
    get isValidation() { return this.status === 422; }
    get isConflict()   { return this.status === 409; }
    get isServer()     { return this.status >= 500; }
}
