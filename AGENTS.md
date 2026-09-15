# 🚨 STRICT AI AGENT RULES & INSTRUCTIONS FOR BACKEND

You are working on the **Coaching Management System — Backend**.

### ⚠️ MANDATORY FIRST STEP FOR ANY AI TASK
Before generating, modifying, or refactoring any code in this backend, you **MUST** read and adhere to:
1. [`coaching-backend-architecture.md`](./coaching-backend-architecture.md) — The single source of truth for all schemas, routes, roles, and business logic.
2. [`AI_WORKFLOW.md`](./AI_WORKFLOW.md) — The step-by-step development protocol, module blueprint, and quality checklist.

---

### Key Non-Negotiable Directives:

1. **Architecture & Language**:
   - Single institute architecture (no `instituteId` multi-tenancy).
   - **Language:** JavaScript (Node.js ES6+). **ALL files must be `.js` (NO `.ts` files).**
   - Tech stack: Node.js, Express.js, JavaScript, MongoDB (Mongoose), Zod.
   - Modular Monolith: Keep everything inside `src/modules/<module-name>/`. Do NOT introduce microservices or premature Redis/queues unless instructed.

2. **Module Layout (Strict 5 Files per Module)**:
   Every module under `src/modules/<name>/` must contain:
   - `model.js` (Mongoose schema with explicit indexes)
   - `validation.js` (Zod validation schemas)
   - `service.js` (Business logic, DB queries, transactions)
   - `controller.js` (Thin HTTP layer, standard response)
   - `routes.js` (Express router with auth + permission + validation middleware)

3. **Security & Authorization**:
   - 3 User roles: `ADMIN`, `TEACHER`, `STUDENT`.
   - Permissions format: `module.action` (e.g. `student.create`, `attendance.read`).
   - Self-Service Endpoints (`/api/v1/me/*`): ALWAYS take user identity from `req.user.id`. NEVER accept `userId` or `studentId` from request parameters or body.

4. **API Response & Error Standard**:
   - Success format: `{ "success": true, "message": "...", "data": ... }`
   - Paginated list: `{ "success": true, "data": [...], "pagination": { "page": 1, "limit": 20, "total": 100, "totalPages": 5 } }`
   - Error format: `{ "success": false, "message": "...", "code": "...", "errors": [...] }`
   - Never return raw unbounded arrays from list queries.

5. **Financial Transactions**:
   - Razorpay signature verification strictly on backend.
   - MongoDB Transactions must wrap Payment creation + Invoice status update.

6. **Development Phases**:
   - Strictly follow the roadmap in Section 25 of `coaching-backend-architecture.md`:
     - Phase 1: Auth, Users, Roles, Permissions, Students, Teachers, Courses, Batches, Enrollments
     - Phase 2: Attendance, Fees, Invoices, Payments
     - Phase 3: MCQ Question Bank, Tests, Results
     - Phase 4: Competitions & Registration
     - Phase 5: Announcements & Notifications
     - Phase 6: Payroll, Reports & Dashboard, Audit Logs
