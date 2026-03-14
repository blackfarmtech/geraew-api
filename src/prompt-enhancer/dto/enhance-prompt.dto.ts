import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class EnhancePromptDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  prompt: string;
}
