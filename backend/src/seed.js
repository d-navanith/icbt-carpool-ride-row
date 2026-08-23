const db = require('./db');
const bcrypt = require('bcryptjs');

const hashPassword = (password) => bcrypt.hashSync(password, 10);

const today = new Date().toISOString().split('T')[0];
const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

console.log('🌱 Seeding SQLite database...');

db.pragma('foreign_keys = ON');

const seed = db.transaction(() => {
  // Clear existing data in dependency order
  db.exec(`
    DELETE FROM reviews;
    DELETE FROM messages;
    DELETE FROM bookings;
    DELETE FROM rides;
    DELETE FROM passenger_verifications;
    DELETE FROM driver_verifications;
    DELETE FROM users;
  `);

  // USERS
  const insertUser = db.prepare(`
    INSERT INTO users (
      id,
      name,
      email,
      password_hash,
      role,
      system_role,
      student_staff_id,
      phone,
      avatar,
      suspended,
      created_at
    )
    VALUES (
      @id,
      @name,
      @email,
      @password_hash,
      @role,
      @system_role,
      @student_staff_id,
      @phone,
      @avatar,
      @suspended,
      @created_at
    )
  `);

  const users = [
    {
      id: 1,
      name: 'Campus Admin Officer',
      email: 'admin@icbt.edu.lk',
      password_hash: hashPassword('admin123'),
      role: 'staff',
      system_role: 'admin',
      student_staff_id: 'STAFF-ADM-001',
      phone: '+94 77 123 4567',
      avatar: '',
      suspended: 0,
      created_at: new Date().toISOString()
    },
    {
      id: 2,
      name: 'Kamal Perera',
      email: 'kamal.driver@icbt.edu.lk',
      password_hash: hashPassword('driver123'),
      role: 'student',
      system_role: 'user',
      student_staff_id: 'ICBT-ST-2024-89',
      phone: '+94 71 456 7890',
      avatar: '',
      suspended: 0,
      created_at: new Date().toISOString()
    },
    {
      id: 3,
      name: 'Nimal Silva',
      email: 'nimal.student@icbt.edu.lk',
      password_hash: hashPassword('student123'),
      role: 'student',
      system_role: 'user',
      student_staff_id: 'ICBT-ST-2024-42',
      phone: '+94 76 998 1122',
      avatar: '',
      suspended: 0,
      created_at: new Date().toISOString()
    },
    {
      id: 4,
      name: 'Dilani Fernando',
      email: 'dilani.pending@icbt.edu.lk',
      password_hash: hashPassword('pending123'),
      role: 'staff',
      system_role: 'user',
      student_staff_id: 'STAFF-ENG-08',
      phone: '+94 70 334 5566',
      avatar: '',
      suspended: 0,
      created_at: new Date().toISOString()
    },
    {
      id: 5,
      name: 'Sanduni Jayawardena',
      email: 'sanduni.user@icbt.edu.lk',
      password_hash: hashPassword('user123'),
      role: 'student',
      system_role: 'user',
      student_staff_id: 'ICBT-ST-2025-15',
      phone: '+94 72 778 9900',
      avatar: '',
      suspended: 0,
      created_at: new Date().toISOString()
    }
  ];

  users.forEach((user) => insertUser.run(user));

  // DRIVER VERIFICATIONS
  const insertDriverVerification = db.prepare(`
    INSERT INTO driver_verifications (
      id,
      user_id,
      license_number,
      vehicle_model,
      vehicle_plate,
      odd_even_type,
      seats,
      fuel_type,
      license_doc_url,
      vehicle_photo_url,
      status,
      admin_comment,
      submitted_at,
      reviewed_at
    )
    VALUES (
      @id,
      @user_id,
      @license_number,
      @vehicle_model,
      @vehicle_plate,
      @odd_even_type,
      @seats,
      @fuel_type,
      @license_doc_url,
      @vehicle_photo_url,
      @status,
      @admin_comment,
      @submitted_at,
      @reviewed_at
    )
  `);

  insertDriverVerification.run({
    id: 1,
    user_id: 2,
    license_number: 'B-9876543-LK',
    vehicle_model: 'Toyota Aqua (Hybrid)',
    vehicle_plate: 'WP-CBH-4521',
    odd_even_type: 'ODD',
    seats: 4,
    fuel_type: 'Hybrid',
    license_doc_url: '',
    vehicle_photo_url: '',
    status: 'approved',
    admin_comment: 'Verified with ICBT Student registry and valid RMV motor traffic license',
    submitted_at: new Date().toISOString(),
    reviewed_at: new Date().toISOString()
  });

  insertDriverVerification.run({
    id: 2,
    user_id: 4,
    license_number: 'B-1122334-LK',
    vehicle_model: 'Suzuki Wagon R',
    vehicle_plate: 'WP-CAD-8842',
    odd_even_type: 'EVEN',
    seats: 3,
    fuel_type: 'Petrol',
    license_doc_url: '',
    vehicle_photo_url: '',
    status: 'pending',
    admin_comment: 'Awaiting review by campus security office',
    submitted_at: new Date().toISOString(),
    reviewed_at: null
  });

  // PASSENGER VERIFICATION
  db.prepare(`
    INSERT INTO passenger_verifications (
      id,
      user_id,
      id_card_number,
      id_doc_url,
      status,
      admin_comment,
      submitted_at,
      reviewed_at
    )
    VALUES (
      @id,
      @user_id,
      @id_card_number,
      @id_doc_url,
      @status,
      @admin_comment,
      @submitted_at,
      @reviewed_at
    )
  `).run({
    id: 1,
    user_id: 3,
    id_card_number: 'ICBT-ST-2024-42',
    id_doc_url: '',
    status: 'approved',
    admin_comment: 'Student ID Card verified',
    submitted_at: new Date().toISOString(),
    reviewed_at: new Date().toISOString()
  });

  // RIDES
  const insertRide = db.prepare(`
    INSERT INTO rides (
      id,
      driver_id,
      origin,
      destination,
      route_waypoints,
      departure_date,
      departure_time,
      return_time,
      total_seats,
      available_seats,
      price_per_seat,
      vehicle_desc,
      odd_even_tag,
      notes,
      status,
      created_at
    )
    VALUES (
      @id,
      @driver_id,
      @origin,
      @destination,
      @route_waypoints,
      @departure_date,
      @departure_time,
      @return_time,
      @total_seats,
      @available_seats,
      @price_per_seat,
      @vehicle_desc,
      @odd_even_tag,
      @notes,
      @status,
      @created_at
    )
  `);

  insertRide.run({
    id: 1,
    driver_id: 2,
    origin: 'Gampaha Town',
    destination: 'ICBT Colombo Campus',
    route_waypoints: JSON.stringify([
      'Miriswatta',
      'Kiribathgoda',
      'Kelaniya',
      'Orugodawatta',
      'Bambalapitiya'
    ]),
    departure_date: today,
    departure_time: '07:15',
    return_time: '17:30',
    total_seats: 4,
    available_seats: 3,
    price_per_seat: 350,
    vehicle_desc: 'Toyota Aqua (AC / Hybrid) - Silver',
    odd_even_tag: 'ODD',
    notes: 'Daily university commute. AC on. Pickup along Kandy Road.',
    status: 'active',
    created_at: new Date().toISOString()
  });

  insertRide.run({
    id: 2,
    driver_id: 2,
    origin: 'Negombo Bus Stand',
    destination: 'ICBT Colombo Campus',
    route_waypoints: JSON.stringify([
      'Ja-Ela',
      'Kandana',
      'Wattala',
      'Peliyagoda',
      'Maradana'
    ]),
    departure_date: tomorrow,
    departure_time: '07:00',
    return_time: '16:45',
    total_seats: 4,
    available_seats: 2,
    price_per_seat: 450,
    vehicle_desc: 'Toyota Aqua (AC / Hybrid) - Silver',
    odd_even_tag: 'ODD',
    notes: 'Expressway & Main road commute to save quota fuel.',
    status: 'active',
    created_at: new Date().toISOString()
  });

  // BOOKING
  db.prepare(`
    INSERT INTO bookings (
      id,
      ride_id,
      passenger_id,
      seats_booked,
      pickup_location,
      booking_code,
      status,
      payment_status,
      payment_method,
      paid_amount,
      completed_at,
      created_at
    )
    VALUES (
      @id,
      @ride_id,
      @passenger_id,
      @seats_booked,
      @pickup_location,
      @booking_code,
      @status,
      @payment_status,
      @payment_method,
      @paid_amount,
      @completed_at,
      @created_at
    )
  `).run({
    id: 1,
    ride_id: 1,
    passenger_id: 3,
    seats_booked: 1,
    pickup_location: 'Kiribathgoda Junction near Supermarket',
    booking_code: 'BK-789234',
    status: 'confirmed',
    payment_status: 'unpaid',
    payment_method: null,
    paid_amount: 0,
    completed_at: null,
    created_at: new Date().toISOString()
  });

  // MESSAGES
  const insertMessage = db.prepare(`
    INSERT INTO messages (
      id,
      ride_id,
      sender_id,
      receiver_id,
      text,
      is_read,
      created_at
    )
    VALUES (
      @id,
      @ride_id,
      @sender_id,
      @receiver_id,
      @text,
      @is_read,
      @created_at
    )
  `);

  insertMessage.run({
    id: 1,
    ride_id: 1,
    sender_id: 3,
    receiver_id: 2,
    text: 'Hi Kamal, I booked 1 seat from Kiribathgoda junction. See you tomorrow at 7:35 AM!',
    is_read: 1,
    created_at: new Date().toISOString()
  });

  insertMessage.run({
    id: 2,
    ride_id: 1,
    sender_id: 2,
    receiver_id: 3,
    text: 'Great Nimal! I will be by the Cargills Food City at 7:35 sharp. Car number WP-CBH-4521.',
    is_read: 1,
    created_at: new Date().toISOString()
  });

  // REVIEW
  db.prepare(`
    INSERT INTO reviews (
      id,
      ride_id,
      reviewer_id,
      reviewee_id,
      rating,
      comment,
      created_at
    )
    VALUES (
      @id,
      @ride_id,
      @reviewer_id,
      @reviewee_id,
      @rating,
      @comment,
      @created_at
    )
  `).run({
    id: 1,
    ride_id: 1,
    reviewer_id: 3,
    reviewee_id: 2,
    rating: 5,
    comment: 'Very punctual and smooth drive to ICBT campus.',
    created_at: new Date().toISOString()
  });
});

try {
  seed();
  console.log('✅ SQLite seed completed successfully.');

  const counts = {
    users: db.prepare('SELECT COUNT(*) AS count FROM users').get().count,
    driver_verifications: db.prepare('SELECT COUNT(*) AS count FROM driver_verifications').get().count,
    passenger_verifications: db.prepare('SELECT COUNT(*) AS count FROM passenger_verifications').get().count,
    rides: db.prepare('SELECT COUNT(*) AS count FROM rides').get().count,
    bookings: db.prepare('SELECT COUNT(*) AS count FROM bookings').get().count,
    messages: db.prepare('SELECT COUNT(*) AS count FROM messages').get().count,
    reviews: db.prepare('SELECT COUNT(*) AS count FROM reviews').get().count
  };

  console.log('\n📊 Database counts:');
  console.log(counts);
} catch (error) {
  console.error('❌ SQLite seed failed:', error);
  process.exitCode = 1;
} finally {
  db.close();
}