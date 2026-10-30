import { prisma } from './database.js';
import { ROLES, DEFAULT_ROLE_PERMISSIONS } from '../common/constants/roles.js';
import { hashPassword } from '../common/utils/password.js';

export const seedDatabase = async () => {
  try {
    // 1. Seed Roles
    const roleDocs = {};
    for (const roleName of Object.values(ROLES)) {
      let role = await prisma.role.findUnique({ where: { name: roleName } });
      if (!role) {
        role = await prisma.role.create({
          data: {
            name: roleName,
            permissions: DEFAULT_ROLE_PERMISSIONS[roleName] || [],
            isSystemRole: true,
          },
        });
        console.log(`🌱 Seeded Role: ${roleName}`);
      }
      roleDocs[roleName] = role;
    }

    // 2. Seed Default Admin User
    const adminEmail = 'admin@vedaclasses.com';
    const existingAdmin = await prisma.user.findUnique({
      where: { email: adminEmail },
      include: { roles: true },
    });

    if (!existingAdmin) {
      const defaultPassword = 'Admin@123456';
      const passwordHash = await hashPassword(defaultPassword);

      await prisma.user.create({
        data: {
          name: 'System Administrator',
          email: adminEmail,
          phone: '9999999999',
          passwordHash,
          status: 'ACTIVE',
          roles: {
            connect: [{ id: roleDocs[ROLES.ADMIN].id }],
          },
        },
      });

      console.log('🌱 Seeded Default Admin User:');
      console.log(`   Email:    ${adminEmail}`);
      console.log(`   Password: ${defaultPassword}`);
    }
  } catch (error) {
    console.error('❌ Error seeding database:', error.message);
  }
};
