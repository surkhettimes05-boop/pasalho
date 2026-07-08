import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';

// Configure Cloudinary using the CLOUDINARY_URL environment variable
// (Which is automatically picked up if process.env.CLOUDINARY_URL is present)
cloudinary.config({
  // CLOUDINARY_URL is automatically read by the SDK, but we can explicitly call config() to ensure it's initialized
});

export const cloudinaryStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    return {
      folder: 'pasalho/products',
      allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
      // Cloudinary allows automatic unique naming
      public_id: `${Date.now()}-${file.originalname.split('.')[0]}`,
    };
  },
});
