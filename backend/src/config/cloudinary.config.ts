import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';

cloudinary.config({});

export const cloudinaryClient = cloudinary;

export function uploadImageBuffer(buffer: Buffer): Promise<UploadApiResponse> {
  return new Promise((resolve, reject) => {
    const stream = cloudinaryClient.uploader.upload_stream(
      {
        folder: 'pasalho/products',
        resource_type: 'image',
        unique_filename: true,
        overwrite: false,
      },
      (error, result) => {
        if (error) return reject(error);
        if (!result) return reject(new Error('Cloudinary returned no upload result.'));
        resolve(result);
      },
    );

    stream.end(buffer);
  });
}
