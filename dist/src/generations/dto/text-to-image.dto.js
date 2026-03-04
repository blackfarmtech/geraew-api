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
exports.TextToImageDto = void 0;
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
const create_generation_dto_1 = require("./create-generation.dto");
class TextToImageDto extends create_generation_dto_1.CreateGenerationDto {
    prompt;
}
exports.TextToImageDto = TextToImageDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Prompt para geração de imagem', maxLength: 20000 }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)({ message: 'Prompt é obrigatório para text-to-image' }),
    (0, class_validator_1.MaxLength)(20000, { message: 'Prompt excede o limite de 20000 caracteres' }),
    __metadata("design:type", String)
], TextToImageDto.prototype, "prompt", void 0);
//# sourceMappingURL=text-to-image.dto.js.map