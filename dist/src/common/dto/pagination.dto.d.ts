export declare class PaginationDto {
    page: number;
    limit: number;
    sort?: string;
    get skip(): number;
}
