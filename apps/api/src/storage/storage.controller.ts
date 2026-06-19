import { BadRequestException, Body, Controller, Delete, Post, Query, UseGuards } from '@nestjs/common';
import { StorageService } from './storage.service';
import { JwtGuard } from '../auth/jwt.guard';

@Controller('storage')
@UseGuards(JwtGuard)
export class StorageController {
  constructor(private readonly storage: StorageService) {}

  @Post('presign')
  async presign(@Body() body: { folder: string; fileName: string; contentType: string }) {
    if (!body.folder || !body.fileName || !body.contentType) {
      throw new BadRequestException('folder, fileName and contentType are required');
    }
    if (!this.storage.configured) {
      throw new BadRequestException('File storage is not configured (AWS_BUCKET_NAME / AWS_ACCESS_KEY_ID missing)');
    }
    const ext = body.fileName.split('.').pop()?.toLowerCase() ?? 'bin';
    const rand = Math.random().toString(36).slice(2, 8);
    const key = `${body.folder}/${Date.now()}-${rand}.${ext}`;
    return this.storage.presign(key, body.contentType);
  }

  @Delete('file')
  async deleteFile(@Query('key') key: string) {
    if (!key) throw new BadRequestException('key query param is required');
    await this.storage.delete(decodeURIComponent(key));
    return { ok: true };
  }
}
