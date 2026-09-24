import { v2 as cloudinary } from 'cloudinary';

const initCloudinary = () => {
  if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
    return true;
  }
  return false;
};

export const uploadImageController = async (req, res) => {
  try {
    const { image, folder = 'vedaclasses/gallery' } = req.body;
    if (!image) {
      return res.status(400).json({
        success: false,
        message: 'No image data provided',
      });
    }

    const isCloudinaryConfigured = initCloudinary();

    if (isCloudinaryConfigured) {
      const uploadRes = await cloudinary.uploader.upload(image, {
        folder,
        resource_type: 'auto',
      });

      return res.status(200).json({
        success: true,
        data: {
          url: uploadRes.secure_url,
          public_id: uploadRes.public_id,
          format: uploadRes.format,
          width: uploadRes.width,
          height: uploadRes.height,
        },
        message: 'Image uploaded to Cloudinary successfully',
      });
    }

    // Fallback if Cloudinary keys aren't configured in .env yet
    return res.status(200).json({
      success: true,
      data: {
        url: image, // Returns data-url directly for local display
        public_id: `local_${Date.now()}`,
      },
      warning: 'Cloudinary keys not yet configured in backend .env. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.',
      message: 'Image processed (add Cloudinary keys in .env to save directly to Cloudinary)',
    });
  } catch (error) {
    console.error('Upload Error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Image upload failed',
    });
  }
};

export const deleteImageController = async (req, res) => {
  try {
    const { public_id } = req.body;
    if (!public_id) {
      return res.status(400).json({
        success: false,
        message: 'public_id is required to delete image',
      });
    }

    if (initCloudinary() && !public_id.startsWith('local_')) {
      await cloudinary.uploader.destroy(public_id);
    }

    return res.status(200).json({
      success: true,
      message: 'Image removed successfully',
    });
  } catch (error) {
    console.error('Delete Image Error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete image',
    });
  }
};

