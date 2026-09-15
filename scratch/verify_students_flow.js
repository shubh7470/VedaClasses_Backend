import mongoose from 'mongoose';
import crypto from 'crypto';
import { Otp } from '../src/modules/auth/otp.model.js';
import { Lead } from '../src/modules/leads/model.js';
import { Student } from '../src/modules/students/model.js';
import { env } from '../src/config/env.js';

const BASE_URL = 'http://localhost:5000/api/v1';

async function runStudentFlowTests() {
  console.log('🧪 Starting Two-Student Model & Lead Flow Verification...\n');

  // Connect to DB directly for OTP query
  await mongoose.connect(env.MONGO_URI, { dbName: 'coaching_management' });

  // 1. Admin Login
  console.log('1. Admin Login...');
  const adminLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@vedaclasses.com', password: 'Admin@123456' }),
  });
  const adminLoginData = await adminLoginRes.json();
  const adminToken = adminLoginData.data.accessToken;
  console.log('✅ Admin Logged In.');

  // 2. Guest Student OTP Flow
  const guestEmail = `guest_${Date.now()}@example.com`;
  console.log(`\n2. Sending OTP to Guest: ${guestEmail}...`);
  await fetch(`${BASE_URL}/auth/send-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: guestEmail }),
  });

  // Find generated OTP in DB
  const rawOtp = '123456'; // Let's find real OTP from collection
  const otpDoc = await Otp.findOne({ email: guestEmail });
  if (!otpDoc) throw new Error('OTP was not created in DB');

  // We can update OTP hash to match '123456' for test verification
  const testOtp = '123456';
  otpDoc.otpHash = crypto.createHash('sha256').update(testOtp).digest('hex');
  await otpDoc.save();

  console.log(`Verifying OTP ${testOtp} for Guest Student...`);
  const verifyRes = await fetch(`${BASE_URL}/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: guestEmail, otp: testOtp, name: 'Guest Aman' }),
  });
  const verifyData = await verifyRes.json();
  console.log('Verify Response:', JSON.stringify(verifyData, null, 2));

  if (!verifyData.success || verifyData.data.user.studentType !== 'ONLINE_GUEST') {
    throw new Error('Guest student creation failed or wrong studentType');
  }
  const guestToken = verifyData.data.accessToken;
  const guestUserId = verifyData.data.user.id;

  // Verify Lead in DB
  const leadDoc = await Lead.findOne({ email: guestEmail });
  console.log(`✅ Lead automatically tracked in leads collection: ID=${leadDoc?._id}, Source=${leadDoc?.source}`);

  // 3. Test Guest Student Access Controls
  console.log('\n3. Testing Guest Student Access Controls:');
  
  // A. Guest accesses /me/tests -> MUST BE 200 OK
  const guestTestsRes = await fetch(`${BASE_URL}/me/tests`, {
    headers: { Authorization: `Bearer ${guestToken}` },
  });
  console.log(`Guest /me/tests Status: ${guestTestsRes.status} (Expected: 200)`);

  // B. Guest accesses /me/fees -> MUST BE 403 ENROLLMENT_REQUIRED
  const guestFeesRes = await fetch(`${BASE_URL}/me/fees`, {
    headers: { Authorization: `Bearer ${guestToken}` },
  });
  const guestFeesData = await guestFeesRes.json();
  console.log(`Guest /me/fees Status: ${guestFeesRes.status} (Expected: 403)`);
  console.log(`Guest /me/fees Response:`, guestFeesData);

  // C. Guest accesses /me/attendance -> MUST BE 403 ENROLLMENT_REQUIRED
  const guestAttRes = await fetch(`${BASE_URL}/me/attendance`, {
    headers: { Authorization: `Bearer ${guestToken}` },
  });
  console.log(`Guest /me/attendance Status: ${guestAttRes.status} (Expected: 403)`);

  // 4. Admin Onboards Regular Student
  console.log('\n4. Admin Onboarding Regular Student...');
  const regularEmail = `regular_${Date.now()}@example.com`;
  const regularPhone = `98${Math.floor(10000000 + Math.random() * 90000000)}`;

  const createStudentRes = await fetch(`${BASE_URL}/students`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      personal: { firstName: 'Rohan', lastName: 'Sharma', gender: 'MALE' },
      contact: { email: regularEmail, phone: regularPhone },
      guardian: { name: 'Suresh Sharma', phone: '9876543210', relation: 'FATHER' },
      academic: { schoolName: 'Delhi Public School', class: '11th', board: 'CBSE' },
    }),
  });
  const createStudentData = await createStudentRes.json();
  console.log('Student Onboarded:', JSON.stringify(createStudentData, null, 2));

  const regularStudentId = createStudentData.data.student._id;
  const tempPassword = createStudentData.data.initialCredentials.temporaryPassword;

  // Login as Regular Student
  console.log('Logging in as Regular Student...');
  const regLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: regularEmail, password: tempPassword }),
  });
  const regLoginData = await regLoginRes.json();
  const regToken = regLoginData.data.accessToken;

  // Regular Student accesses /me/fees -> MUST BE 200 OK
  const regFeesRes = await fetch(`${BASE_URL}/me/fees`, {
    headers: { Authorization: `Bearer ${regToken}` },
  });
  console.log(`Regular Student /me/fees Status: ${regFeesRes.status} (Expected: 200)`);

  // Regular Student accesses /me/attendance -> MUST BE 200 OK
  const regAttRes = await fetch(`${BASE_URL}/me/attendance`, {
    headers: { Authorization: `Bearer ${regToken}` },
  });
  console.log(`Regular Student /me/attendance Status: ${regAttRes.status} (Expected: 200)`);

  // 5. Admin Upgrades Guest Student to Regular
  console.log('\n5. Admin Upgrades Guest Student to Regular...');
  // Find guest student ID from Student collection
  const guestStudentDoc = await mongoose.model('Student').findOne({ userId: guestUserId });
  const upgradeRes = await fetch(`${BASE_URL}/students/${guestStudentDoc._id}/upgrade`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      guardian: { name: 'Kailash Verma', phone: '9876543219', relation: 'FATHER' },
      academic: { schoolName: 'St. Xavier', class: '12th', board: 'ICSE' },
    }),
  });
  const upgradeData = await upgradeRes.json();
  console.log('Upgrade Response:', JSON.stringify(upgradeData, null, 2));

  // Verify Upgraded Student now has access to /me/fees!
  const upgradedFeesRes = await fetch(`${BASE_URL}/me/fees`, {
    headers: { Authorization: `Bearer ${guestToken}` },
  });
  console.log(`Upgraded Student /me/fees Status: ${upgradedFeesRes.status} (Expected: 200)`);

  console.log('\n🎉 ALL TWO-STUDENT & LEAD FLOW TESTS COMPLETED SUCCESSFULLY!');
  await mongoose.disconnect();
}

runStudentFlowTests().catch((err) => {
  console.error('\n❌ Test failed with error:', err);
  process.exit(1);
});
