const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const dbFilePath = path.join(__dirname, '..', 'carpool_data.json');

const passHash = (pwd) => bcrypt.hashSync(pwd, 10);
const today = new Date().toISOString().split('T')[0];
const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
const nextWeek = new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0];

console.log('🌱 Resetting and seeding ICBT UniRide database...');

const seedData = {
  users: [
    {
      id: 1,
      name: 'Campus Admin Officer',
      email: 'admin@icbt.edu.lk',
      password_hash: passHash('admin123'),
      role: 'staff',
      system_role: 'admin',
      student_staff_id: 'STAFF-ADM-001',
      phone: '+94 77 123 4567',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      created_at: new Date().toISOString()
    },
    {
      id: 2,
      name: 'Kamal Perera',
      email: 'kamal.driver@icbt.edu.lk',
      password_hash: passHash('driver123'),
      role: 'student',
      system_role: 'user',
      student_staff_id: 'ICBT-ST-2024-89',
      phone: '+94 71 456 7890',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      created_at: new Date().toISOString()
    },
    {
      id: 3,
      name: 'Nimal Silva',
      email: 'nimal.student@icbt.edu.lk',
      password_hash: passHash('student123'),
      role: 'student',
      system_role: 'user',
      student_staff_id: 'ICBT-ST-2024-42',
      phone: '+94 76 998 1122',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
      created_at: new Date().toISOString()
    },
    {
      id: 4,
      name: 'Dilani Fernando',
      email: 'dilani.pending@icbt.edu.lk',
      password_hash: passHash('pending123'),
      role: 'staff',
      system_role: 'user',
      student_staff_id: 'STAFF-ENG-08',
      phone: '+94 70 334 5566',
      avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
      created_at: new Date().toISOString()
    },
    {
      id: 5,
      name: 'Sanduni Jayawardena',
      email: 'sanduni.user@icbt.edu.lk',
      password_hash: passHash('user123'),
      role: 'student',
      system_role: 'user',
      student_staff_id: 'ICBT-ST-2025-15',
      phone: '+94 72 778 9900',
      avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
      created_at: new Date().toISOString()
    }
  ],
  driver_verifications: [
    {
      id: 1,
      user_id: 2,
      license_number: 'B-9876543-LK',
      vehicle_model: 'Toyota Aqua (Hybrid)',
      vehicle_plate: 'WP-CBH-4521',
      odd_even_type: 'ODD',
      seats: 4,
      fuel_type: 'Hybrid',
      license_doc_url: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=400&auto=format&fit=crop&q=80',
      vehicle_photo_url: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=400&auto=format&fit=crop&q=80',
      status: 'approved',
      admin_comment: 'Verified with ICBT Student registry and valid RMV motor traffic license',
      submitted_at: new Date().toISOString(),
      reviewed_at: new Date().toISOString()
    },
    {
      id: 2,
      user_id: 4,
      license_number: 'B-1122334-LK',
      vehicle_model: 'Suzuki Wagon R',
      vehicle_plate: 'WP-CAD-8842',
      odd_even_type: 'EVEN',
      seats: 3,
      fuel_type: 'Petrol',
      license_doc_url: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=400&auto=format&fit=crop&q=80',
      vehicle_photo_url: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=400&auto=format&fit=crop&q=80',
      status: 'pending',
      admin_comment: 'Awaiting review by campus security office',
      submitted_at: new Date().toISOString(),
      reviewed_at: null
    }
  ],
  passenger_verifications: [
    {
      id: 1,
      user_id: 3,
      id_card_number: 'ICBT-ST-2024-42',
      id_doc_url: '',
      status: 'approved',
      admin_comment: 'Student ID Card verified',
      submitted_at: new Date().toISOString(),
      reviewed_at: new Date().toISOString()
    }
  ],
  rides: [
    {
      id: 1,
      driver_id: 2,
      origin: 'Gampaha Town',
      destination: 'ICBT Colombo Campus',
      route_waypoints: JSON.stringify(['Miriswatta', 'Kiribathgoda', 'Kelaniya', 'Orugodawatta', 'Bambalapitiya']),
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
    },
    {
      id: 2,
      driver_id: 2,
      origin: 'Negombo Bus Stand',
      destination: 'ICBT Colombo Campus',
      route_waypoints: JSON.stringify(['Ja-Ela', 'Kandana', 'Wattala', 'Peliyagoda', 'Maradana']),
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
    },
    {
      id: 3,
      driver_id: 2,
      origin: 'Moratuwa Town',
      destination: 'ICBT Colombo Campus',
      route_waypoints: JSON.stringify(['Ratmalana', 'Mount Lavinia', 'Dehiwala', 'Wellawatte']),
      departure_date: nextWeek,
      departure_time: '08:00',
      return_time: '17:00',
      total_seats: 3,
      available_seats: 3,
      price_per_seat: 250,
      vehicle_desc: 'Toyota Aqua (AC / Hybrid) - Silver',
      odd_even_tag: 'ODD',
      notes: 'Galle Road commute to Bambalapitiya campus.',
      status: 'active',
      created_at: new Date().toISOString()
    }
  ],
  bookings: [
    {
      id: 1,
      ride_id: 1,
      passenger_id: 3,
      seats_booked: 1,
      pickup_location: 'Kiribathgoda Junction',
      booking_code: 'CP-789234',
      status: 'confirmed',
      created_at: new Date().toISOString()
    }
  ],
  messages: [
    {
      id: 1,
      ride_id: 1,
      sender_id: 3,
      text: 'Hi Kamal, I booked 1 seat from Kiribathgoda junction. See you tomorrow at 7:35 AM!',
      created_at: new Date().toISOString()
    },
    {
      id: 2,
      ride_id: 1,
      sender_id: 2,
      text: 'Great Nimal! I will be by the Cargills Food City at 7:35 sharp. Car number WP-CBH-4521.',
      created_at: new Date().toISOString()
    }
  ],
  reviews: [
    {
      id: 1,
      ride_id: 1,
      reviewer_id: 3,
      reviewee_id: 2,
      rating: 5,
      comment: 'Very punctual and smooth drive to ICBT campus.',
      created_at: new Date().toISOString()
    }
  ]
};

fs.writeFileSync(dbFilePath, JSON.stringify(seedData, null, 2), 'utf8');
console.log('✅ Database successfully populated with ICBT campus seed data.');
