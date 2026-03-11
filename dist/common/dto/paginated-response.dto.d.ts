export declare class PaginationMeta {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}
export declare class PaginatedResponseDto<T> {
    data: T[];
    meta: PaginationMeta;
    constructor(data: T[], total: number, page: number, limit: number);
}
