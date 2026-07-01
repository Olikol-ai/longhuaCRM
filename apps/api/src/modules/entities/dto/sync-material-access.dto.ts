import { IsArray, IsUUID } from 'class-validator';

export class SyncMaterialAccessDto {
  @IsArray()
  @IsUUID('4', { each: true })
  material_ids!: string[];
}
