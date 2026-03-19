import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserProfileResponseDto } from './dto/user-profile-response.dto';
export declare class UsersController {
    private readonly usersService;
    constructor(usersService: UsersService);
    getProfile(userId: string): Promise<UserProfileResponseDto>;
    updateProfile(userId: string, dto: UpdateUserDto): Promise<UserProfileResponseDto>;
    completeOnboarding(userId: string): Promise<UserProfileResponseDto>;
    deleteAccount(userId: string): Promise<{
        message: string;
    }>;
}
