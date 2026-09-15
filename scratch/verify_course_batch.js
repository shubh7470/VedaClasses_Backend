const BASE_URL = 'http://localhost:5000/api/v1';

async function testCourseAndBatch() {
  console.log('🧪 Testing Course & Batch Module...\n');

  // 1. Admin Login
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@vedaclasses.com', password: 'Admin@123456' }),
  });
  const loginData = await loginRes.json();
  const token = loginData.data.accessToken;
  console.log('✅ Admin Authenticated.');

  // 2. Create Course
  console.log('\n2. Creating Course...');
  const courseCode = `JEE-${Date.now() % 10000}`;
  const courseRes = await fetch(`${BASE_URL}/courses`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      name: 'JEE Advanced Batch 2026',
      code: courseCode,
      description: 'Comprehensive 2-year JEE training program',
      duration: {
        startDate: '2026-04-01',
        endDate: '2028-03-31',
      },
      subjects: [
        { name: 'Physics' },
        { name: 'Chemistry' },
        { name: 'Mathematics' },
      ],
      status: 'ACTIVE',
    }),
  });
  const courseData = await courseRes.json();
  console.log('Course Created:', JSON.stringify(courseData, null, 2));

  if (!courseData.success) throw new Error('Failed to create course');
  const courseId = courseData.data._id;

  // 3. List Courses
  console.log('\n3. Listing Courses...');
  const listCoursesRes = await fetch(`${BASE_URL}/courses?page=1&limit=10`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const listCoursesData = await listCoursesRes.json();
  console.log(`Found ${listCoursesData.pagination.total} courses. Page 1 count: ${listCoursesData.data.length}`);

  // 4. Create Batch
  console.log('\n4. Creating Batch...');
  const batchCode = `BTH-${Date.now() % 10000}`;
  const batchRes = await fetch(`${BASE_URL}/batches`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      courseId,
      name: 'JEE Morning Star Batch',
      batchCode,
      schedule: [
        { day: 'MONDAY', startTime: '08:00', endTime: '10:00' },
        { day: 'WEDNESDAY', startTime: '08:00', endTime: '10:00' },
        { day: 'FRIDAY', startTime: '08:00', endTime: '10:00' },
      ],
      capacity: 45,
      status: 'ACTIVE',
    }),
  });
  const batchData = await batchRes.json();
  console.log('Batch Created:', JSON.stringify(batchData, null, 2));

  if (!batchData.success) throw new Error('Failed to create batch');
  const batchId = batchData.data._id;

  // 5. List Batches with Course filter
  console.log(`\n5. Listing Batches for Course ${courseId}...`);
  const listBatchesRes = await fetch(`${BASE_URL}/batches?courseId=${courseId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const listBatchesData = await listBatchesRes.json();
  console.log(`Found ${listBatchesData.data.length} batches for course.`);
  console.log(`Associated Course populated: ${listBatchesData.data[0].courseId.name} (${listBatchesData.data[0].courseId.code})`);

  // 6. Update Batch Capacity
  console.log('\n6. Updating Batch Capacity...');
  const updateBatchRes = await fetch(`${BASE_URL}/batches/${batchId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ capacity: 60 }),
  });
  const updateBatchData = await updateBatchRes.json();
  console.log('Updated Batch Capacity:', updateBatchData.data.capacity);

  // 7. Test Duplicate Batch Code (Expect 409)
  console.log('\n7. Testing Duplicate Batch Code Prevention (Expect 409)...');
  const dupBatchRes = await fetch(`${BASE_URL}/batches`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      courseId,
      name: 'Duplicate Test Batch',
      batchCode,
      capacity: 30,
    }),
  });
  const dupBatchData = await dupBatchRes.json();
  console.log(`Duplicate Status: ${dupBatchRes.status} (Code: ${dupBatchData.code})`);

  console.log('\n🎉 ALL COURSE & BATCH TESTS COMPLETED SUCCESSFULLY!');
}

testCourseAndBatch().catch((err) => {
  console.error('\n❌ Test failed with error:', err);
  process.exit(1);
});
