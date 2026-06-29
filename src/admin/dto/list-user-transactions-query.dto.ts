import { IsOptional, IsEnum, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CreditTransactionType } from '@prisma/client';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class ListUserTransactionsQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: CreditTransactionType, description: 'Tipo de transação' })
  @IsOptional()
  @IsEnum(CreditTransactionType)
  type?: CreditTransactionType;

  @ApiPropertyOptional({ description: 'Data inicial (ISO 8601). Inclui transações a partir desta data.' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Data final (ISO 8601). Inclui transações até esta data.' })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
