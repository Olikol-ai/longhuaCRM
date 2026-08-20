export interface UploadedFilePayload {
  /** Present when Multer uses memoryStorage. */
  buffer?: Buffer;
  /** Absolute path when Multer uses diskStorage. */
  path?: string;
  size: number;
  originalname: string;
  mimetype?: string;
  filename?: string;
  destination?: string;
}
