# Coaching Management System — Backend Architecture (Single Institute)

**Version:** 1.0
**Backend:** Node.js + Express.js + JavaScript
**Database:** MongoDB
**Authentication:** JWT + Refresh Token
**File Storage:** AWS S3 / Cloudflare R2 (can start local, migrate later)
**Payment:** Razorpay
**API Style:** REST
**Scale target:** 1 institute, up to ~5,000 students

---

## 1. System Overview

This is a backend for a **single coaching institute**, covering:

- Student, Teacher & Admin Management
- Role-based Access (Admin / Teacher / Student)
- Course & Batch Management
- Enrollment
- Fees, Invoices & Payments
- Student & Teacher Attendance
- MCQ Tests, Question Bank & Results
- Competitions & Registration
- Announcements & Notifications
- Study Materials
- Teacher Payroll
- Reports & Dashboard
- Audit Logs

No multi-tenancy needed — everything belongs to one institute, so there's no `instituteId` scoping anywhere.

---

## 2. Architecture

Keep it a **simple modular monolith**. No microservices, no mandatory Redis/Queue on day 1 — add them only when actual load demands it.

```text
                CLIENTS (Admin / Teacher / Student Web or App)
                              |
                        Express.js API (/api/v1)
                              |
        Auth --> Authorization --> Validation --> Controller
                              |
                        Service Layer
                              |
                      Mongoose / MongoDB
                              |
                +-------------+-------------+
                |                           |
          S3/R2 (files)          Redis + BullMQ (optional,
                                   add later for notifications)
```

---

## 3. Tech Stack

```text
Node.js
Express.js
JavaScript
MongoDB + Mongoose
JWT (access + refresh token)
bcrypt or argon2 (password hashing)
Zod or Joi (validation)
Razorpay (payments)
Nodemailer / SMTP (email)
Firebase FCM (push, optional)
Redis + BullMQ (optional — add when notification/report volume grows)
```

---

## 4. Folder Structure

```text
src/
├── config/
│   ├── database.js
│   ├── env.js
│   ├── storage.js
│   └── razorpay.js
│
├── modules/
│   ├── auth/
│   ├── users/
│   ├── students/
│   ├── teachers/
│   ├── roles/
│   ├── courses/
│   ├── batches/
│   ├── enrollments/
│   ├── attendance/
│   ├── fees/
│   ├── exams/
│   ├── questions/
│   ├── competitions/
│   ├── notifications/
│   ├── announcements/
│   ├── studyMaterials/
│   ├── payroll/
│   ├── reports/
│   └── auditLogs/
│       (each module has: controller.js, service.js, routes.js, validation.js, model.js)
│
├── middleware/
│   ├── auth.middleware.js
│   ├── permission.middleware.js
│   ├── validation.middleware.js
│   ├── upload.middleware.js
│   ├── rateLimit.middleware.js
│   └── error.middleware.js
│
├── common/
│   ├── constants/
│   ├── utils/
│   ├── errors/
│   └── helpers/
│
├── routes/
│   └── index.js
│
├── app.js
└── server.js
```

---

## 5. User Roles (MVP)

Start with only 3 roles — this keeps auth simple. More roles (Accountant, Staff, Parent) can be added later without changing the auth architecture.

```text
ADMIN
TEACHER
STUDENT
```

Permission format: `module.action` (e.g. `student.create`, `fees.read`, `exam.publish`)

```text
authenticate() → authorize() → checkPermission("student.create") → Controller
```

---

## 6. Authentication

### Tokens

| Token | Lifetime | Purpose |
|---|---|---|
| Access Token | 15 minutes | API requests |
| Refresh Token | 7–30 days | Get new access token |

### Login Flow

```text
POST /api/v1/auth/login  { email, password }
        |
Find user by email → check status ACTIVE → compare password
        |
Generate access + refresh token
        |
Response:
{
  "success": true,
  "data": {
    "accessToken": "...",
    "refreshToken": "...",
    "user": { "id": "...", "name": "Rahul", "role": "STUDENT" }
  }
}
```

### Refresh Flow

```text
POST /api/v1/auth/refresh  { refreshToken }
→ Validate refresh token → Issue new access token
```

### Logout Flow

```text
POST /api/v1/auth/logout  { refreshToken }
→ Invalidate/delete session record
```

### Auth APIs

```text
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh
POST   /api/v1/auth/logout
POST   /api/v1/auth/logout-all
GET    /api/v1/auth/me
POST   /api/v1/auth/change-password
POST   /api/v1/auth/forgot-password
POST   /api/v1/auth/reset-password
```

---

## 7. Core Schemas

### `users`

```json
{
  "_id": "ObjectId",
  "name": "Rahul Sharma",
  "email": "rahul@example.com",
  "phone": "9876543210",
  "passwordHash": "...",
  "roleIds": [],
  "status": "ACTIVE",
  "profileImage": null,
  "lastLoginAt": null,
  "createdAt": "Date",
  "updatedAt": "Date"
}
```
Indexes: `email UNIQUE`, `phone UNIQUE`, `status`, `roleIds`

### `sessions` (refresh token store)

```json
{
  "_id": "ObjectId",
  "userId": "ObjectId",
  "refreshTokenHash": "...",
  "device": { "type": "WEB", "browser": "Chrome", "os": "Windows" },
  "ipAddress": "...",
  "expiresAt": "Date",
  "createdAt": "Date"
}
```
TTL index on `expiresAt` — MongoDB auto-deletes expired sessions.

### `roles`

```json
{
  "_id": "ObjectId",
  "name": "TEACHER",
  "permissions": ["student.read", "attendance.create", "exam.create"],
  "isSystemRole": true
}
```

---

## 8. Student Module

The system manages two distinct categories of students:
1. **`REGULAR` (Enrolled Coaching Students):** Onboarded by Admin/Staff. Complete access to fees, invoices, batches, attendance, study materials, and tests.
2. **`ONLINE_GUEST` (MCQ Test / Lead Students):** Self-registered via OTP / Google to take mock tests. Automatically tracked in `leads`. Restricted strictly to tests and results until enrolled.

### `students`

```json
{
  "_id": "ObjectId",
  "userId": "ObjectId",
  "studentType": "REGULAR", // "REGULAR" | "ONLINE_GUEST"
  "isEnrolled": true, // false for ONLINE_GUEST
  "studentCode": "STD-2026-0001", // generated for REGULAR students
  "leadId": null, // ObjectId ref to leads collection
  "personal": { "firstName": "Rahul", "lastName": "Sharma", "dob": "2010-05-10", "gender": "MALE" },
  "contact": { "phone": "9876543210", "email": "rahul@example.com", "address": {} },
  "guardian": { "name": "Ramesh Sharma", "phone": "9876543211", "relation": "FATHER" },
  "academic": { "schoolName": "ABC School", "class": "10", "board": "CBSE" },
  "status": "ACTIVE",
  "createdAt": "Date",
  "updatedAt": "Date"
}
```
Indexes: `studentCode UNIQUE (sparse)`, `userId UNIQUE`, `studentType`, `contact.phone`, `status`

### APIs

```text
POST   /api/v1/students            # Admin onboard regular student
GET    /api/v1/students?page=1&limit=20&search=rahul&status=ACTIVE&studentType=REGULAR
GET    /api/v1/students/:id
PATCH  /api/v1/students/:id
POST   /api/v1/students/:id/upgrade  # Upgrade ONLINE_GUEST to REGULAR student

# Student self-service (uses req.user.id, never accepts arbitrary IDs)
GET    /api/v1/me                    # Returns profile with studentType & isEnrolled
GET    /api/v1/me/tests              # Available to BOTH Regular and Guest students
GET    /api/v1/me/results            # Available to BOTH Regular and Guest students
GET    /api/v1/me/fees               # REGULAR ONLY (Guest returns 403 ENROLLMENT_REQUIRED)
GET    /api/v1/me/attendance         # REGULAR ONLY (Guest returns 403 ENROLLMENT_REQUIRED)
```

---

## 9. Teacher Module

### `teachers`

```json
{
  "_id": "ObjectId",
  "userId": "ObjectId",
  "teacherCode": "TCH-001",
  "personal": { "name": "Amit Verma", "phone": "9876543210", "email": "amit@example.com" },
  "employment": { "joiningDate": "Date", "designation": "Math Teacher", "employmentType": "FULL_TIME" },
  "salary": { "salaryType": "MONTHLY", "baseSalary": 30000 },
  "subjects": [],
  "status": "ACTIVE"
}
```
Indexes: `teacherCode UNIQUE`, `userId UNIQUE`, `status`

### APIs

```text
POST   /api/v1/teachers
GET    /api/v1/teachers
GET    /api/v1/teachers/:id
PATCH  /api/v1/teachers/:id
DELETE /api/v1/teachers/:id
GET    /api/v1/teachers/:id/attendance
GET    /api/v1/teachers/:id/payments
GET    /api/v1/teachers/:id/batches
```

---

## 10. Course & Batch Module

### `courses`

```json
{
  "_id": "ObjectId",
  "name": "JEE Foundation",
  "code": "JEE-FND",
  "duration": { "startDate": "Date", "endDate": "Date" },
  "subjects": [{ "subjectId": "ObjectId", "name": "Physics" }],
  "status": "ACTIVE"
}
```

### `batches`

```json
{
  "_id": "ObjectId",
  "courseId": "ObjectId",
  "name": "JEE Foundation Morning",
  "batchCode": "JEE-M-01",
  "teachers": ["ObjectId"],
  "schedule": [{ "day": "MONDAY", "startTime": "08:00", "endTime": "09:30" }],
  "capacity": 50,
  "status": "ACTIVE"
}
```

### APIs

```text
POST/GET/PATCH/DELETE  /api/v1/courses
POST/GET/PATCH/DELETE  /api/v1/batches
```

---

## 11. Enrollment

Kept as a **separate collection** (not embedded in student) so a student can enroll in multiple courses/batches.

### `enrollments`

```json
{
  "_id": "ObjectId",
  "studentId": "ObjectId",
  "courseId": "ObjectId",
  "batchId": "ObjectId",
  "enrollmentDate": "Date",
  "feePlanId": "ObjectId",
  "status": "ACTIVE"
}
```
Compound index: `studentId + batchId`

### APIs

```text
POST   /api/v1/enrollments
GET    /api/v1/enrollments
GET    /api/v1/enrollments/:id
PATCH  /api/v1/enrollments/:id
```

---

## 12. Attendance Module

Single generic collection for both student and teacher attendance.

### `attendance`

```json
{
  "_id": "ObjectId",
  "userType": "STUDENT",
  "userId": "ObjectId",
  "batchId": "ObjectId",
  "date": "2026-09-15",
  "status": "PRESENT",
  "markedBy": "ObjectId",
  "remarks": null,
  "createdAt": "Date"
}
```
Unique compound index: `userType + userId + batchId + date`

### APIs

```text
POST   /api/v1/attendance
POST   /api/v1/attendance/bulk
GET    /api/v1/attendance
GET    /api/v1/attendance/student/:studentId
GET    /api/v1/attendance/teacher/:teacherId
PATCH  /api/v1/attendance/:id
```

Bulk payload:
```json
{
  "batchId": "xxx",
  "date": "2026-09-15",
  "records": [
    { "studentId": "1", "status": "PRESENT" },
    { "studentId": "2", "status": "ABSENT" }
  ]
}
```

---

## 13. Fees Module

Financial data is kept in **separate, immutable-once-successful** collections: `feePlans`, `invoices`, `payments`, `refunds`.

### `feePlans`
```json
{ "_id": "ObjectId", "courseId": "ObjectId", "name": "Monthly Plan", "amount": 5000, "frequency": "MONTHLY", "status": "ACTIVE" }
```

### `invoices`
```json
{
  "_id": "ObjectId",
  "invoiceNumber": "INV-2026-00001",
  "studentId": "ObjectId",
  "enrollmentId": "ObjectId",
  "amount": { "subtotal": 5000, "discount": 500, "tax": 0, "total": 4500 },
  "dueDate": "Date",
  "status": "PENDING",
  "createdAt": "Date"
}
```

### `payments`
```json
{
  "_id": "ObjectId",
  "paymentNumber": "PAY-2026-00001",
  "studentId": "ObjectId",
  "invoiceId": "ObjectId",
  "amount": 4500,
  "method": "RAZORPAY",
  "gateway": { "orderId": "...", "paymentId": "...", "signature": "..." },
  "status": "SUCCESS",
  "paidAt": "Date",
  "createdBy": "ObjectId"
}
```

### APIs

```text
POST   /api/v1/fee-plans
GET    /api/v1/fee-plans
PATCH  /api/v1/fee-plans/:id

POST   /api/v1/invoices
GET    /api/v1/invoices
GET    /api/v1/invoices/:id

POST   /api/v1/payments/create-order
POST   /api/v1/payments/verify
GET    /api/v1/payments
GET    /api/v1/payments/:id
POST   /api/v1/payments/:id/refund
```

### Payment Flow (critical — always verify on backend)

```text
Student selects pending fee
   → Backend creates Razorpay order
   → Frontend opens payment gateway
   → Payment success (frontend callback)
   → Backend VERIFIES signature (never trust frontend alone)
   → Create Payment record (inside a MongoDB transaction with invoice update)
   → Generate receipt
   → Send notification
```

Use an `Idempotency-Key` header on payment creation so retried requests don't create duplicate payments.

---

## 14. MCQ / Exam Module

Collections: `subjects`, `questions`, `tests`, `testAttempts`, `testAnswers`

### `questions`

```json
{
  "_id": "ObjectId",
  "subjectId": "ObjectId",
  "topicId": "ObjectId",
  "question": "What is 2 + 2?",
  "options": [{ "id": "A", "text": "3" }, { "id": "B", "text": "4" }, { "id": "C", "text": "5" }],
  "correctOption": "B",
  "explanation": "2 + 2 = 4",
  "difficulty": "EASY",
  "marks": 1,
  "negativeMarks": 0,
  "status": "ACTIVE",
  "createdBy": "ObjectId"
}
```

### `tests`

```json
{
  "_id": "ObjectId",
  "title": "Weekly Physics Test",
  "subjectIds": [],
  "questionIds": [],
  "durationMinutes": 30,
  "totalMarks": 50,
  "passingMarks": 20,
  "startAt": "Date",
  "endAt": "Date",
  "status": "PUBLISHED"
}
```

### `testAttempts` / `testAnswers`

```json
{
  "_id": "ObjectId",
  "testId": "ObjectId",
  "studentId": "ObjectId",
  "startedAt": "Date",
  "submittedAt": "Date",
  "status": "SUBMITTED",
  "score": 42,
  "correctAnswers": 42,
  "wrongAnswers": 8,
  "unanswered": 0
}
```
```json
{ "attemptId": "ObjectId", "questionId": "ObjectId", "selectedOption": "B", "isCorrect": true, "marks": 1 }
```

### APIs

```text
POST/GET/PATCH/DELETE  /api/v1/questions
POST/GET/PATCH/DELETE  /api/v1/tests
POST   /api/v1/tests/:id/start
POST   /api/v1/tests/:id/submit
GET    /api/v1/tests/:id/results
GET    /api/v1/me/test-results
```

---

## 15. Competition Module

### `competitions`

```json
{
  "_id": "ObjectId",
  "title": "National Science Quiz",
  "registration": { "startDate": "Date", "endDate": "Date", "fee": 100 },
  "eventDate": "Date",
  "capacity": 500,
  "status": "OPEN"
}
```

### `competitionRegistrations`

```json
{
  "_id": "ObjectId",
  "competitionId": "ObjectId",
  "studentId": "ObjectId",
  "registrationNumber": "REG-2026-001",
  "paymentStatus": "PAID",
  "status": "CONFIRMED",
  "registeredAt": "Date"
}
```
Unique index: `competitionId + studentId` (prevents duplicate registration)

### APIs

```text
POST/GET/PATCH/DELETE  /api/v1/competitions
POST   /api/v1/competitions/:id/register
GET    /api/v1/competitions/:id/registrations
GET    /api/v1/me/competitions
```

---

## 16. Announcements & Notifications

Keep these **two concepts separate**: an announcement is the content admin creates; a notification is the per-user delivery record.

### `announcements`

```json
{
  "_id": "ObjectId",
  "title": "Holiday Announcement",
  "content": "...",
  "target": { "type": "BATCH", "batchIds": [] },
  "publishAt": "Date",
  "expiresAt": "Date",
  "status": "PUBLISHED",
  "createdBy": "ObjectId"
}
```
Target types: `ALL | STUDENTS | TEACHERS | BATCH | COURSE | INDIVIDUAL`

### `notifications`

```json
{
  "_id": "ObjectId",
  "userId": "ObjectId",
  "type": "FEE_REMINDER",
  "title": "Fee Reminder",
  "message": "Your monthly fee is due.",
  "data": { "invoiceId": "ObjectId" },
  "channels": { "inApp": true, "push": true, "email": false, "whatsapp": false },
  "readAt": null,
  "createdAt": "Date"
}
```

### APIs

```text
POST/GET/PATCH/DELETE  /api/v1/announcements
POST   /api/v1/announcements/:id/publish

GET    /api/v1/notifications
PATCH  /api/v1/notifications/:id/read
PATCH  /api/v1/notifications/read-all
POST   /api/v1/notifications/send
```

> Note: For an MVP with one institute, sending notifications directly (no Redis/queue) is fine. Add a queue only once volume/latency becomes a real problem.

---

## 17. Study Materials

Files live in S3/R2 (or local disk for very early MVP) — only metadata goes in MongoDB.

### `studyMaterials`

```json
{
  "_id": "ObjectId",
  "title": "Physics Chapter 1",
  "courseId": "ObjectId",
  "batchId": "ObjectId",
  "subjectId": "ObjectId",
  "file": { "url": "...", "storageKey": "...", "type": "PDF", "size": 500000 },
  "uploadedBy": "ObjectId",
  "status": "PUBLISHED"
}
```

### APIs

```text
POST/GET/PATCH/DELETE  /api/v1/study-materials
```

---

## 18. Teacher Payroll

### `salaryStructures`

```json
{ "_id": "ObjectId", "teacherId": "ObjectId", "salaryType": "MONTHLY", "baseSalary": 30000, "allowances": 3000, "deductions": 1000, "effectiveFrom": "Date", "status": "ACTIVE" }
```

### `payrolls`

```json
{
  "_id": "ObjectId",
  "teacherId": "ObjectId",
  "month": 9, "year": 2026,
  "attendanceDays": 25, "presentDays": 24, "leaveDays": 1,
  "baseSalary": 30000, "allowances": 3000, "deductions": 1000, "netSalary": 32000,
  "status": "GENERATED"
}
```
Unique index: `teacherId + month + year`

### `teacherPayments`

```json
{ "_id": "ObjectId", "payrollId": "ObjectId", "teacherId": "ObjectId", "amount": 32000, "paymentMethod": "BANK_TRANSFER", "transactionReference": "TXN12345", "paidAt": "Date", "status": "PAID", "paidBy": "ObjectId" }
```

### APIs

```text
POST   /api/v1/payroll/generate
GET    /api/v1/payroll
GET    /api/v1/payroll/:id
POST   /api/v1/payroll/:id/pay
GET    /api/v1/teachers/:id/payments
```

> Never auto-mark payroll as PAID just because it was generated — always require an explicit admin action.

---

## 19. Reports & Dashboard

Reports are computed from existing collections — no separate report storage needed at this scale.

```text
GET /api/v1/reports/students
GET /api/v1/reports/attendance
GET /api/v1/reports/fees
GET /api/v1/reports/tests
GET /api/v1/reports/competitions
GET /api/v1/reports/payroll
```
Supports query params: `dateFrom, dateTo, batchId, courseId, teacherId, studentId`

```text
GET /api/v1/dashboard/admin
GET /api/v1/dashboard/teacher
GET /api/v1/dashboard/student
```

Admin dashboard example response:
```json
{
  "students": { "total": 1250, "active": 1180 },
  "teachers": { "total": 45 },
  "fees": { "collected": 500000, "pending": 120000 },
  "attendance": { "today": 87 },
  "tests": { "active": 5 }
}
```

---

## 20. Audit Logs

### `auditLogs`

```json
{
  "_id": "ObjectId",
  "userId": "ObjectId",
  "action": "PAYMENT_CREATED",
  "module": "FEES",
  "entityId": "ObjectId",
  "metadata": {},
  "ipAddress": "...",
  "userAgent": "...",
  "createdAt": "Date"
}
```

Log at minimum: `LOGIN, LOGOUT, STUDENT_CREATED, STUDENT_DELETED, FEE_CREATED, PAYMENT_CREATED, PAYMENT_REFUNDED, TEACHER_CREATED, SALARY_PAID, TEST_PUBLISHED, COMPETITION_CREATED`

---

## 21. Standard API Response Format

**Success:**
```json
{ "success": true, "message": "Student created successfully", "data": {} }
```

**Error:**
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [{ "field": "email", "message": "Invalid email" }]
}
```

**List/Pagination:**
```json
{
  "data": [],
  "pagination": { "page": 1, "limit": 20, "total": 500, "totalPages": 25 }
}
```
Never return unbounded lists — every list API must support `?page=&limit=`.

---

## 22. Security Checklist

```text
✔ Helmet
✔ CORS
✔ Rate limiting (strict on /login, /forgot-password, /payment verification — e.g. 5 attempts / 15 min / IP)
✔ Input validation (Zod/Joi) on every write endpoint
✔ MongoDB query sanitization
✔ JWT signature + expiry validation
✔ Password hashing with bcrypt or Argon2id — never store plain text
✔ HTTP-only cookie for refresh token if using cookie auth
✔ File upload validation (type, size)
✔ Request size limits
✔ Audit logs on sensitive actions
```

### Access Restrictions

- **Students** can never call `/students`, `/teachers`, `/payroll`, `/payments` (list-all). They only get `/me/*` endpoints, and the backend always uses `req.user.id` — never an ID sent from the frontend.
- **Teachers** can access only their own batches, students, attendance, and tests — not other teachers' salary or admin settings, unless explicitly permitted.

---

## 23. Error Handling Flow

```text
Controller → Service → throw AppError → Error Middleware → Standard JSON Response
```
```json
{ "success": false, "message": "Student not found", "code": "STUDENT_NOT_FOUND" }
```

Controllers should stay thin — no business logic, no direct DB calls:
```text
Controller → StudentService → StudentRepository
                            → NotificationService
                            → AuditService
```

---

## 24. Key Business Flows

**Student Admission:**
`Create Student → Create User Account → Create Enrollment → Assign Course/Batch → Create Fee Plan → Generate Invoice → Send Login Credentials`

**Fee Payment:**
`Invoice (Pending) → Payment (Razorpay/Cash/Bank) → Backend Verification → Payment Record → Invoice Updated → Receipt → Notification`

**MCQ Test:**
`Create Questions → Create Test → Publish → Student Starts → Creates Attempt → Answers → Submit → Backend Evaluation → Result → Dashboard`

**Competition:**
`Create Competition → Publish → Student Registers → Payment → Verification → Confirmed → Registration Number → Notification`

**Teacher Attendance → Payroll:**
`Mark Attendance → Monthly Calculation → Salary Calculation → Admin Approval → Teacher Payment`

---

## 25. MVP Development Order

| Phase | Scope |
|---|---|
| 1 | Auth, Users, Roles, Permissions, Students, Teachers, Courses, Batches, Enrollments |
| 2 | Student Attendance, Teacher Attendance, Fees, Invoices, Payments, Receipts |
| 3 | Question Bank, MCQ Tests, Attempts, Results |
| 4 | Competitions, Registration, Competition Payments |
| 5 | Announcements, Notifications (email/push — keep simple, no queue yet) |
| 6 | Teacher Payroll, Salary, Reports, Dashboard, Audit Logs |

---

## 26. Environment Variables

```env
NODE_ENV=production
PORT=5000

MONGO_URI=

JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=

S3_ENDPOINT=
S3_BUCKET=
S3_ACCESS_KEY=
S3_SECRET_KEY=

RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=

SMTP_HOST=
SMTP_USER=
SMTP_PASSWORD=

FCM_PROJECT_ID=
FCM_PRIVATE_KEY=
FCM_CLIENT_EMAIL=

# Optional — add only when scaling beyond single-server
REDIS_URL=
```

Never commit `.env` to version control.

---

## 27. Deployment (Single Institute Scale)

```text
             Cloudflare / Nginx
                    |
              Node.js API (PM2 or Docker)
                    |
              MongoDB (single instance / Atlas)
                    |
              S3 / R2 (files)
```

This is sufficient for a single institute up to a few thousand students. No load balancer, no Redis, no worker queues required at this stage — add them later only if actual traffic/notification volume demands it.

---

## 28. Core Design Principles

1. JWT + Refresh Token authentication
2. RBAC with permission-based authorization (start with 3 roles: Admin, Teacher, Student)
3. Modular backend — one folder per domain module
4. Separate collections for high-growth data (attendance, payments, notifications) — never embed unbounded arrays in a student/teacher document
5. MongoDB indexes on every major query field
6. MongoDB transactions for financial operations (payment + invoice update together)
7. Idempotency key on payment creation
8. Files in S3/R2, only metadata in MongoDB
9. Audit logs on sensitive actions
10. API versioning (`/api/v1`)
11. Pagination on every list endpoint
12. Backend validation always — never trust frontend validation alone
13. Design around entities (`/students`, `/invoices`, `/tests`) not frontend screens — keeps the API reusable across Admin Web, Teacher Web, Student App
14. Keep it a monolith — add Redis/Queue/microservices only when real load requires it, not preemptively
