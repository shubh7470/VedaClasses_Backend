import { prisma } from '../../config/database.js';
import { AppError } from '../../common/errors/AppError.js';

export const leadService = {
  /**
   * Create a new Lead (Public: Book Free Demo / Website Enquiry)
   */
  createLead: async (data) => {
    const { name, phone, email, source = 'WEBSITE', notes = '', course, klass } = data;

    if (!name || name.trim().length < 2) {
      throw new AppError('Full name is required.', 400, 'INVALID_NAME');
    }

    if (!phone || phone.trim().length < 10) {
      throw new AppError('A valid 10-digit phone number is required.', 400, 'INVALID_PHONE');
    }

    const cleanPhone = phone.trim();
    const cleanEmail = (email && email.trim())
      ? email.toLowerCase().trim()
      : `${cleanPhone.replace(/\D/g, '')}@lead.vedaclasses.com`;

    const fullNotes = [
      klass ? `Class: ${klass}` : '',
      course ? `Course: ${course}` : '',
      notes ? `Message: ${notes}` : '',
    ]
      .filter(Boolean)
      .join(' | ');

    const lead = await prisma.lead.create({
      data: {
        name: name.trim(),
        email: cleanEmail,
        phone: cleanPhone,
        source: source || 'WEBSITE',
        status: 'NEW',
        convertedToAdmission: false,
        notes: fullNotes,
      },
    });

    return lead;
  },

  /**
   * List all leads with filtering and pagination (Admin only)
   */
  listLeads: async (queryParams = {}) => {
    const page = Math.max(1, parseInt(queryParams.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(queryParams.limit || '20', 10)));
    const skip = (page - 1) * limit;

    const where = {};

    if (queryParams.status && queryParams.status !== 'ALL') {
      where.status = queryParams.status;
    }

    if (queryParams.source) {
      where.source = queryParams.source;
    }

    if (queryParams.search) {
      const search = queryParams.search.trim();
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.lead.count({ where }),
    ]);

    return {
      data: leads,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  /**
   * Update lead status (Admin only)
   */
  updateLeadStatus: async (id, status) => {
    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) {
      throw new AppError('Lead not found.', 404, 'LEAD_NOT_FOUND');
    }

    const updated = await prisma.lead.update({
      where: { id },
      data: {
        status,
        ...(status === 'CONVERTED' && { convertedToAdmission: true }),
      },
    });

    return updated;
  },
};

