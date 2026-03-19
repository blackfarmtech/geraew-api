export declare class UserResponseDto {
    id: string;
    email: string;
    name: string;
    avatarUrl?: string;
    role: string;
    emailVerified: boolean;
    hasCompletedOnboarding: boolean;
    createdAt: Date;
}
export declare class AuthResponseDto {
    accessToken: string;
    refreshToken: string;
    user: UserResponseDto;
}
