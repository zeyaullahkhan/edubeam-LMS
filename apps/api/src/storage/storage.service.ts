import { Injectable } from '@nestjs/common';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class StorageService {
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly publicBase: string;
  readonly configured: boolean;

  constructor() {
    this.bucket = process.env.AWS_BUCKET_NAME ?? '';
    const region = process.env.AWS_REGION ?? 'us-east-1';
    const endpoint = process.env.AWS_ENDPOINT_URL;
    this.configured = !!(this.bucket && process.env.AWS_ACCESS_KEY_ID);
    this.publicBase =
      process.env.AWS_PUBLIC_URL ??
      `https://${this.bucket}.s3.${region}.amazonaws.com`;
    this.s3 = new S3Client({
      region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? 'placeholder',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? 'placeholder',
      },
      ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
    });
  }

  async presign(key: string, contentType: string) {
    const cmd = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });
    const uploadUrl = await getSignedUrl(this.s3, cmd, { expiresIn: 300 });
    const publicUrl = `${this.publicBase}/${key}`;
    return { uploadUrl, publicUrl, key };
  }

  async delete(key: string) {
    await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}
