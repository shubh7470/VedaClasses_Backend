import { leadService } from './service.js';

export const createLead = async (req, res, next) => {
  try {
    const lead = await leadService.createLead(req.body);
    return res.status(201).json({
      success: true,
      message: 'Demo booking enquiry submitted successfully. Our team will contact you soon.',
      data: lead,
    });
  } catch (error) {
    next(error);
  }
};

export const listLeads = async (req, res, next) => {
  try {
    const result = await leadService.listLeads(req.query);
    return res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
};

export const updateLeadStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const lead = await leadService.updateLeadStatus(id, status);
    return res.status(200).json({
      success: true,
      message: 'Lead status updated successfully',
      data: lead,
    });
  } catch (error) {
    next(error);
  }
};

