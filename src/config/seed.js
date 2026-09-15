import { Role } from '../modules/roles/model.js';
import { User } from '../modules/users/model.js';
import { ROLES, DEFAULT_ROLE_PERMISSIONS } from '../common/constants/roles.js';
import { hashPassword } from '../common/utils/password.js';

export const seedDatabase = async () => {
  try {
    // 1. Seed Roles
    const roleDocs = {};
    for (const roleName of Object.values(ROLES)) {
      let role = await Role.findOne({ name: roleName });
      if (!role) {
        role = await Role.create({
          name: roleName,
          permissions: DEFAULT_ROLE_PERMISSIONS[roleName] || [],
          isSystemRole: true,
        });
        console.log(`🌱 Seeded Role: ${roleName}`);
      }
      roleDocs[roleName] = role;
    }

    // 2. Seed Default Admin User
    const adminEmail = 'admin@vedaclasses.com';
    const existingAdmin = await User.findOne({ email: adminEmail });

    if (!existingAdmin) {
      const defaultPassword = 'Admin@123456';
      const passwordHash = await hashPassword(defaultPassword);

      await User.create({
        name: 'System Administrator',
        email: adminEmail,
        phone: '9999999999',
        passwordHash,
        roleIds: [roleDocs[ROLES.ADMIN]._id],
        status: 'ACTIVE',
      });

      console.log('🌱 Seeded Default Admin User:');
      console.log(`   Email:    ${adminEmail}`);
      console.log(`   Password: ${defaultPassword}`);
    }
  } catch (error) {
    console.error('❌ Error seeding database:', error.message);
  }
};
