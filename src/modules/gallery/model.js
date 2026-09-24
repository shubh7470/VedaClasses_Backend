import mongoose from 'mongoose';

const galleryItemSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      trim: true,
      default: 'Veda Classes Campus',
    },
    category: {
      type: String,
      trim: true,
      default: 'Campus',
      enum: ['Campus', 'Classroom', 'Students', 'Faculty', 'Events', 'Seminars', 'Award Ceremony', 'General'],
    },
    image: {
      type: String,
      required: true,
      trim: true,
    },
    public_id: {
      type: String,
      default: '',
    },
    tall: {
      type: Boolean,
      default: false,
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

export const GalleryItem = mongoose.model('GalleryItem', galleryItemSchema);
