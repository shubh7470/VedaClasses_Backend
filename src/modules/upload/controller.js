import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary if env vars are present
if (process.env.CLOUDINARY_CLOUD_NAME) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

export const uploadImageController = async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) {
      return res.status(400).json({
        success: false,
        message: 'No image data provided',
      });
    }

    // Check if Cloudinary credentials exist
    if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY) {
      const uploadRes = await cloudinary.uploader.upload(image, {
        folder: 'vedaclasses/mcq_questions',
      });

      return res.status(200).json({
        success: true,
        data: {
          url: uploadRes.secure_url,
          public_id: uploadRes.public_id,
        },
        message: 'Image uploaded to Cloudinary successfully',
      });
    }

    // Fallback if Cloudinary keys aren't configured in .env yet
    return res.status(200).json({
      success: true,
      data: {
        url: image, // Returns base64 / data-url directly for local instant display
      },
      message: 'Image processed (configure CLOUDINARY_CLOUD_NAME for Cloudinary cloud hosting)',
    });
  } catch (error) {
    console.error('Upload Error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Image upload failed',
    });
  }
};
