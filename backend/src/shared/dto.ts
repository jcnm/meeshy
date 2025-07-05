import { IsString, IsEmail, IsOptional, IsBoolean, MinLength, MaxLength, IsEnum, IsArray, IsUUID, IsNumber, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';
import { ConversationType, ParticipantRole } from './interfaces';

// ===== USER DTOs =====

export class CreateUserDto {
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  username: string;

  @IsString()
  @MinLength(2)
  @MaxLength(50)
  firstName: string;

  @IsString()
  @MinLength(2)
  @MaxLength(50)
  lastName: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  displayName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  systemLanguage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  regionalLanguage?: string;

  @IsOptional()
  @IsBoolean()
  autoTranslateEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  translateToSystemLanguage?: boolean;

  @IsOptional()
  @IsBoolean()
  translateToRegionalLanguage?: boolean;

  @IsOptional()
  @IsBoolean()
  useCustomDestination?: boolean;
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  lastName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  displayName?: string;

  @IsOptional()
  @IsString()
  avatar?: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  systemLanguage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  regionalLanguage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  customDestinationLanguage?: string;

  @IsOptional()
  @IsBoolean()
  autoTranslateEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  translateToSystemLanguage?: boolean;

  @IsOptional()
  @IsBoolean()
  translateToRegionalLanguage?: boolean;

  @IsOptional()
  @IsBoolean()
  useCustomDestination?: boolean;
}

export class LoginDto {
  @IsString()
  @MinLength(3)
  username: string;

  @IsString()
  @MinLength(8)
  password: string;
}

// ===== CONVERSATION DTOs =====

export class CreateConversationDto {
  @IsEnum(ConversationType)
  type: ConversationType;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsArray()
  @IsUUID(4, { each: true })
  participantIds: string[];
}

export class UpdateConversationDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class JoinConversationDto {
  @IsUUID(4)
  conversationId: string;

  @IsOptional()
  @IsString()
  linkId?: string;
}

// ===== MESSAGE DTOs =====

export class CreateMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  @Transform(({ value }) => value?.trim())
  content: string;

  @IsUUID(4)
  conversationId: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  originalLanguage?: string;

  @IsOptional()
  @IsUUID(4)
  replyToId?: string;
}

export class UpdateMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  @Transform(({ value }) => value?.trim())
  content: string;
}

// ===== GROUP DTOs =====

export class CreateGroupDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(2)
  @Max(1000)
  maxMembers?: number;
}

export class UpdateGroupDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(2)
  @Max(1000)
  maxMembers?: number;
}

export class UpdateMemberRoleDto {
  @IsEnum(ParticipantRole)
  role: ParticipantRole;
}

// ===== SEARCH ET PAGINATION DTOs =====

export class SearchDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  q: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Transform(({ value }) => parseInt(value))
  page?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Transform(({ value }) => parseInt(value))
  limit?: number;
}

export class PaginationDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Transform(({ value }) => parseInt(value))
  page?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Transform(({ value }) => parseInt(value))
  limit?: number;
}
