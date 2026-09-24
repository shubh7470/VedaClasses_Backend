import { GalleryItem } from './model.js';
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

export const listGalleryItems = async (req, res) => {
  try {
    const { category } = req.query;
    const filter = category && category !== 'All' ? { category } : {};
    const items = await GalleryItem.find(filter).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      data: items,
      count: items.length,
    });
  } catch (error) {
    console.error('List Gallery Error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch gallery items',
    });
  }
};

export const createGalleryItem = async (req, res) => {
  try {
    const { title, category, image, public_id, tall, order } = req.body;

    if (!image) {
      return res.status(400).json({
        success: false,
        message: 'Image URL is required',
      });
    }

    const item = await GalleryItem.create({
      title: title || 'Campus Photo',
      category: category || 'Campus',
      image,
      public_id: public_id || '',
      tall: Boolean(tall),
      order: Number(order) || 0,
    });

    return res.status(201).json({
      success: true,
      data: item,
      message: 'Photo added to gallery successfully',
    });
  } catch (error) {
    console.error('Create Gallery Item Error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to add gallery item',
    });
  }
};

export const deleteGalleryItem = async (req, res) => {
  try {
    const { id } = req.params;
    const item = await GalleryItem.findById(id);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Gallery item not found',
      });
    }

    // Try deleting from Cloudinary if public_id exists
    if (item.public_id && !item.public_id.startsWith('local_') && initCloudinary()) {
      try {
        await cloudinary.uploader.destroy(item.public_id);
      } catch (cErr) {
        console.warn('Cloudinary delete warning:', cErr.message);
      }
    }

    await GalleryItem.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: 'Gallery photo deleted successfully',
    });
  } catch (error) {
    console.error('Delete Gallery Item Error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete gallery item',
    });
  }
};

export const updateGalleryItem = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const item = await GalleryItem.findByIdAndUpdate(id, updates, { new: true });
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Gallery item not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: item,
      message: 'Gallery item updated successfully',
    });
  } catch (error) {
    console.error('Update Gallery Item Error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to update gallery item',
    });
  }
};
