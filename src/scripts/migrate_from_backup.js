import fs from 'fs';
import path from 'path';
import { prisma } from '../config/database.js';

const BACKUP_FILE = path.join(process.cwd(), '.data', 'db_backup.json');

export const migrateDataFromBackup = async () => {
  if (!fs.existsSync(BACKUP_FILE)) {
    console.log('No backup file found at', BACKUP_FILE);
    return;
  }

  const raw = fs.readFileSync(BACKUP_FILE, 'utf-8');
  if (!raw.trim()) {
    console.log('Backup file is empty.');
    return;
  }

  const backup = JSON.parse(raw);
  console.log('📦 Starting migration from .data/db_backup.json to Supabase PostgreSQL...');

  // 1. Roles
  const roleIdToNameMap = {};
  if (Array.isArray(backup.roles)) {
    for (const r of backup.roles) {
      roleIdToNameMap[r._id] = r.name;
      await prisma.role.upsert({
        where: { name: r.name },
        update: {
          permissions: r.permissions || [],
          isSystemRole: Boolean(r.isSystemRole),
        },
        create: {
          name: r.name,
          permissions: r.permissions || [],
          isSystemRole: Boolean(r.isSystemRole),
          createdAt: r.createdAt ? new Date(r.createdAt) : new Date(),
          updatedAt: r.updatedAt ? new Date(r.updatedAt) : new Date(),
        },
      });
    }
    console.log(`✅ Roles migrated (${backup.roles.length} records)`);
  }

  // 2. Users
  if (Array.isArray(backup.users)) {
    for (const u of backup.users) {
      const roleNames = (u.roleIds || [])
        .map((id) => roleIdToNameMap[id])
        .filter(Boolean);

      await prisma.user.upsert({
        where: { email: u.email },
        update: {
          name: u.name,
          phone: u.phone || null,
          passwordHash: u.passwordHash || null,
          authProvider: u.authProvider || 'LOCAL',
          googleId: u.googleId || null,
          studentType: u.studentType || null,
          status: u.status || 'ACTIVE',
          profileImage: u.profileImage || null,
          lastLoginAt: u.lastLoginAt ? new Date(u.lastLoginAt) : null,
          roles: {
            set: roleNames.map((name) => ({ name })),
          },
        },
        create: {
          id: u._id,
          name: u.name,
          email: u.email,
          phone: u.phone || null,
          passwordHash: u.passwordHash || null,
          authProvider: u.authProvider || 'LOCAL',
          googleId: u.googleId || null,
          studentType: u.studentType || null,
          status: u.status || 'ACTIVE',
          profileImage: u.profileImage || null,
          lastLoginAt: u.lastLoginAt ? new Date(u.lastLoginAt) : null,
          createdAt: u.createdAt ? new Date(u.createdAt) : new Date(),
          updatedAt: u.updatedAt ? new Date(u.updatedAt) : new Date(),
          roles: {
            connect: roleNames.map((name) => ({ name })),
          },
        },
      });
    }
    console.log(`✅ Users migrated (${backup.users.length} records)`);
  }

  // 3. Leads
  if (Array.isArray(backup.leads)) {
    for (const l of backup.leads) {
      await prisma.lead.upsert({
        where: { id: l._id },
        update: {
          name: l.name,
          email: l.email,
          phone: l.phone || null,
          source: l.source || 'WEBSITE',
          status: l.status || 'NEW',
          convertedToAdmission: Boolean(l.convertedToAdmission),
          notes: l.notes || '',
        },
        create: {
          id: l._id,
          name: l.name,
          email: l.email,
          phone: l.phone || null,
          source: l.source || 'WEBSITE',
          status: l.status || 'NEW',
          convertedToAdmission: Boolean(l.convertedToAdmission),
          notes: l.notes || '',
          createdAt: l.createdAt ? new Date(l.createdAt) : new Date(),
          updatedAt: l.updatedAt ? new Date(l.updatedAt) : new Date(),
        },
      });
    }
    console.log(`✅ Leads migrated (${backup.leads.length} records)`);
  }

  // 4. Students
  if (Array.isArray(backup.students)) {
    for (const s of backup.students) {
      // Find user by id or email
      let user = await prisma.user.findUnique({ where: { id: s.userId } });
      if (!user && s.contact?.email) {
        user = await prisma.user.findUnique({ where: { email: s.contact.email.toLowerCase().trim() } });
      }
      if (!user) continue;

      let leadId = s.leadId;
      if (leadId) {
        const leadExists = await prisma.lead.findUnique({ where: { id: leadId } });
        if (!leadExists) leadId = null;
      }

      await prisma.student.upsert({
        where: { userId: user.id },
        update: {
          studentType: s.studentType || 'REGULAR',
          isEnrolled: s.isEnrolled !== undefined ? s.isEnrolled : true,
          studentCode: s.studentCode || null,
          leadId: leadId || null,
          personal: s.personal || {},
          contact: s.contact || {},
          guardian: s.guardian || {},
          academic: s.academic || {},
          status: s.status || 'ACTIVE',
        },
        create: {
          id: s._id,
          userId: user.id,
          studentType: s.studentType || 'REGULAR',
          isEnrolled: s.isEnrolled !== undefined ? s.isEnrolled : true,
          studentCode: s.studentCode || null,
          leadId: leadId || null,
          personal: s.personal || {},
          contact: s.contact || {},
          guardian: s.guardian || {},
          academic: s.academic || {},
          status: s.status || 'ACTIVE',
          createdAt: s.createdAt ? new Date(s.createdAt) : new Date(),
          updatedAt: s.updatedAt ? new Date(s.updatedAt) : new Date(),
        },
      });
    }
    console.log(`✅ Students migrated (${backup.students.length} records)`);
  }

  // 5. MCQ Sets
  if (Array.isArray(backup.mcqsets)) {
    for (const set of backup.mcqsets) {
      let createdBy = set.createdBy;
      if (createdBy) {
        const userExists = await prisma.user.findUnique({ where: { id: createdBy } });
        if (!userExists) createdBy = null;
      }

      await prisma.mcqSet.upsert({
        where: { id: set._id },
        update: {
          title: set.title,
          subject: set.subject || 'General',
          topicName: set.topicName || '',
          accessType: set.accessType || 'FREE',
          price: Number(set.price) || 0,
          difficulty: set.difficulty || 'MEDIUM',
          marksPerQuestion: Number(set.marksPerQuestion) || 4,
          negativeMarks: Number(set.negativeMarks) || 1,
          durationMinutes: Number(set.durationMinutes) || 30,
          passingMarks: Number(set.passingMarks) || 0,
          status: set.status || 'PUBLISHED',
          totalQuestionsCount: Number(set.totalQuestionsCount) || 0,
          createdBy,
        },
        create: {
          id: set._id,
          title: set.title,
          subject: set.subject || 'General',
          topicName: set.topicName || '',
          accessType: set.accessType || 'FREE',
          price: Number(set.price) || 0,
          difficulty: set.difficulty || 'MEDIUM',
          marksPerQuestion: Number(set.marksPerQuestion) || 4,
          negativeMarks: Number(set.negativeMarks) || 1,
          durationMinutes: Number(set.durationMinutes) || 30,
          passingMarks: Number(set.passingMarks) || 0,
          status: set.status || 'PUBLISHED',
          totalQuestionsCount: Number(set.totalQuestionsCount) || 0,
          createdBy,
          createdAt: set.createdAt ? new Date(set.createdAt) : new Date(),
          updatedAt: set.updatedAt ? new Date(set.updatedAt) : new Date(),
        },
      });
    }
    console.log(`✅ MCQ Sets migrated (${backup.mcqsets.length} records)`);
  }

  // 6. MCQ Questions
  if (Array.isArray(backup.mcqquestions)) {
    for (const q of backup.mcqquestions) {
      const setExists = await prisma.mcqSet.findUnique({ where: { id: q.setId } });
      if (!setExists) continue;

      let createdBy = q.createdBy;
      if (createdBy) {
        const userExists = await prisma.user.findUnique({ where: { id: createdBy } });
        if (!userExists) createdBy = null;
      }

      await prisma.mcqQuestion.upsert({
        where: { id: q._id },
        update: {
          setId: q.setId,
          questionNumber: Number(q.questionNumber) || 1,
          question: q.question,
          imageUrl: q.imageUrl || '',
          options: q.options || [],
          correctOption: q.correctOption,
          explanation: q.explanation || '',
          explanationImage: q.explanationImage || '',
          createdBy,
        },
        create: {
          id: q._id,
          setId: q.setId,
          questionNumber: Number(q.questionNumber) || 1,
          question: q.question,
          imageUrl: q.imageUrl || '',
          options: q.options || [],
          correctOption: q.correctOption,
          explanation: q.explanation || '',
          explanationImage: q.explanationImage || '',
          createdBy,
          createdAt: q.createdAt ? new Date(q.createdAt) : new Date(),
          updatedAt: q.updatedAt ? new Date(q.updatedAt) : new Date(),
        },
      });
    }
    console.log(`✅ MCQ Questions migrated (${backup.mcqquestions.length} records)`);
  }

  // 7. Gallery Items
  if (Array.isArray(backup.galleryitems)) {
    for (const g of backup.galleryitems) {
      await prisma.galleryItem.upsert({
        where: { id: g._id },
        update: {
          title: g.title || 'Campus Photo',
          category: g.category || 'Campus',
          image: g.image,
          public_id: g.public_id || '',
          tall: Boolean(g.tall),
          order: Number(g.order) || 0,
        },
        create: {
          id: g._id,
          title: g.title || 'Campus Photo',
          category: g.category || 'Campus',
          image: g.image,
          public_id: g.public_id || '',
          tall: Boolean(g.tall),
          order: Number(g.order) || 0,
          createdAt: g.createdAt ? new Date(g.createdAt) : new Date(),
          updatedAt: g.updatedAt ? new Date(g.updatedAt) : new Date(),
        },
      });
    }
    console.log(`✅ Gallery Items migrated (${backup.galleryitems.length} records)`);
  }

  console.log('🎉 Migration from backup completed successfully!');
};

migrateDataFromBackup()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
