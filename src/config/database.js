import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis;

export const basePrisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = basePrisma;

export const prisma = basePrisma.$extends({
  result: {
    user: {
      _id: {
        needs: { id: true },
        compute(user) {
          return user.id;
        },
      },
    },
    role: {
      _id: {
        needs: { id: true },
        compute(role) {
          return role.id;
        },
      },
    },
    session: {
      _id: {
        needs: { id: true },
        compute(session) {
          return session.id;
        },
      },
    },
    otp: {
      _id: {
        needs: { id: true },
        compute(otp) {
          return otp.id;
        },
      },
    },
    lead: {
      _id: {
        needs: { id: true },
        compute(lead) {
          return lead.id;
        },
      },
    },
    student: {
      _id: {
        needs: { id: true },
        compute(student) {
          return student.id;
        },
      },
    },
    course: {
      _id: {
        needs: { id: true },
        compute(course) {
          return course.id;
        },
      },
    },
    batch: {
      _id: {
        needs: { id: true },
        compute(batch) {
          return batch.id;
        },
      },
    },
    studentFeeStructure: {
      _id: {
        needs: { id: true },
        compute(fee) {
          return fee.id;
        },
      },
    },
    feeInstallment: {
      _id: {
        needs: { id: true },
        compute(inst) {
          return inst.id;
        },
      },
    },
    feePayment: {
      _id: {
        needs: { id: true },
        compute(payment) {
          return payment.id;
        },
      },
    },
    mcqSet: {
      _id: {
        needs: { id: true },
        compute(set) {
          return set.id;
        },
      },
    },
    mcqQuestion: {
      _id: {
        needs: { id: true },
        compute(q) {
          return q.id;
        },
      },
    },
    mcqAttempt: {
      _id: {
        needs: { id: true },
        compute(att) {
          return att.id;
        },
      },
    },
    galleryItem: {
      _id: {
        needs: { id: true },
        compute(item) {
          return item.id;
        },
      },
    },
  },
});

export const connectDatabase = async () => {
  try {
    await prisma.$connect();
    console.log('✅ PostgreSQL (Supabase) connected successfully via Prisma');
  } catch (error) {
    console.error(`❌ Database Connection Failed: ${error.message}`);
    process.exit(1);
  }
};

export const disconnectDatabase = async () => {
  await prisma.$disconnect();
};
