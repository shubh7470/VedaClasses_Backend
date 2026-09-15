import { batchService } from './service.js';

export const createBatch = async (req, res, next) => {
  try {
    const batch = await batchService.createBatch(req.body);
    return res.status(201).json({
      success: true,
      message: 'Batch created successfully',
      data: batch,
    });
  } catch (error) {
    next(error);
  }
};

export const listBatches = async (req, res, next) => {
  try {
    const result = await batchService.listBatches(req.query);
    return res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
};

export const getBatchById = async (req, res, next) => {
  try {
    const batch = await batchService.getBatchById(req.params.id);
    return res.status(200).json({
      success: true,
      data: batch,
    });
  } catch (error) {
    next(error);
  }
};

export const updateBatch = async (req, res, next) => {
  try {
    const batch = await batchService.updateBatch(req.params.id, req.body);
    return res.status(200).json({
      success: true,
      message: 'Batch updated successfully',
      data: batch,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteBatch = async (req, res, next) => {
  try {
    await batchService.deleteBatch(req.params.id);
    return res.status(200).json({
      success: true,
      message: 'Batch deleted successfully',
      data: null,
    });
  } catch (error) {
    next(error);
  }
};
