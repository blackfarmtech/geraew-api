"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RegisterDto = void 0;
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
class RegisterDto {
    email;
    name;
    password;
    phone;
}
exports.RegisterDto = RegisterDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 'john.doe@example.com',
        description: 'Email do usuário',
    }),
    (0, class_validator_1.IsEmail)({}, { message: 'Email inválido' }),
    (0, class_validator_1.IsNotEmpty)({ message: 'Email é obrigatório' }),
    __metadata("design:type", String)
], RegisterDto.prototype, "email", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 'John Doe',
        description: 'Nome completo do usuário',
    }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)({ message: 'Nome é obrigatório' }),
    (0, class_validator_1.MinLength)(2, { message: 'Nome deve ter no mínimo 2 caracteres' }),
    (0, class_validator_1.MaxLength)(100, { message: 'Nome deve ter no máximo 100 caracteres' }),
    __metadata("design:type", String)
], RegisterDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 'SecurePassword123!',
        description: 'Senha do usuário',
    }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)({ message: 'Senha é obrigatória' }),
    (0, class_validator_1.MinLength)(8, { message: 'Senha deve ter no mínimo 8 caracteres' }),
    (0, class_validator_1.MaxLength)(100, { message: 'Senha deve ter no máximo 100 caracteres' }),
    (0, class_validator_1.Matches)(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d\W_]{8,}$/, {
        message: 'Senha deve conter pelo menos uma letra maiúscula, uma minúscula e um número',
    }),
    __metadata("design:type", String)
], RegisterDto.prototype, "password", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: '5511999998888',
        description: 'Número de telefone com código do país',
    }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)({ message: 'Telefone é obrigatório' }),
    (0, class_validator_1.Matches)(/^\+?\d{10,15}$/, {
        message: 'Telefone inválido. Use formato: 5511999998888',
    }),
    __metadata("design:type", String)
], RegisterDto.prototype, "phone", void 0);
//# sourceMappingURL=register.dto.js.map