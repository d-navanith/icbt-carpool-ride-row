PRAGMA foreign_keys = ON;

-- =========================================
-- USER ACCOUNTS
-- =========================================
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'student'
        CHECK (role IN ('student', 'staff')),
    system_role TEXT NOT NULL DEFAULT 'user'
        CHECK (system_role IN ('user', 'admin')),
    student_staff_id TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    avatar TEXT DEFAULT '',
    suspended INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =========================================
-- DRIVER VERIFICATION
-- =========================================
CREATE TABLE IF NOT EXISTS driver_verifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    license_number TEXT NOT NULL,
    vehicle_model TEXT NOT NULL,
    vehicle_plate TEXT NOT NULL,
    odd_even_type TEXT NOT NULL
        CHECK (odd_even_type IN ('ODD', 'EVEN')),
    seats INTEGER NOT NULL DEFAULT 3,
    fuel_type TEXT DEFAULT 'Petrol',
    license_doc_url TEXT DEFAULT '',
    vehicle_photo_url TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected')),
    admin_comment TEXT DEFAULT '',
    submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TEXT DEFAULT NULL,

    FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);

-- =========================================
-- PASSENGER VERIFICATION
-- =========================================
CREATE TABLE IF NOT EXISTS passenger_verifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    id_card_number TEXT NOT NULL,
    id_doc_url TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected')),
    admin_comment TEXT DEFAULT '',
    submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TEXT DEFAULT NULL,

    FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);

-- =========================================
-- RIDES
-- =========================================
CREATE TABLE IF NOT EXISTS rides (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    driver_id INTEGER NOT NULL,
    origin TEXT NOT NULL,
    destination TEXT NOT NULL,
    route_waypoints TEXT DEFAULT '[]',
    departure_date TEXT NOT NULL,
    departure_time TEXT NOT NULL,
    return_time TEXT DEFAULT NULL,
    total_seats INTEGER NOT NULL,
    available_seats INTEGER NOT NULL,
    price_per_seat REAL NOT NULL DEFAULT 0,
    vehicle_desc TEXT DEFAULT '',
    odd_even_tag TEXT
        CHECK (odd_even_tag IN ('ODD', 'EVEN')),
    notes TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (
            status IN (
                'active',
                'scheduled',
                'in_transit',
                'completed',
                'cancelled'
            )
        ),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (driver_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);

-- =========================================
-- BOOKINGS
-- =========================================
CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ride_id INTEGER NOT NULL,
    passenger_id INTEGER NOT NULL,
    seats_booked INTEGER NOT NULL DEFAULT 1,
    pickup_location TEXT DEFAULT '',
    booking_code TEXT NOT NULL UNIQUE,

    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (
            status IN (
                'pending',
                'confirmed',
                'rejected',
                'cancelled',
                'completed'
            )
        ),

    payment_status TEXT NOT NULL DEFAULT 'unpaid'
        CHECK (
            payment_status IN (
                'unpaid',
                'paid'
            )
        ),

    payment_method TEXT DEFAULT NULL,
    paid_amount REAL DEFAULT 0,
    completed_at TEXT DEFAULT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (ride_id)
        REFERENCES rides(id)
        ON DELETE CASCADE,

    FOREIGN KEY (passenger_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);

-- =========================================
-- CHAT MESSAGES
-- =========================================
CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ride_id INTEGER NOT NULL,
    sender_id INTEGER NOT NULL,
    receiver_id INTEGER DEFAULT NULL,
    text TEXT NOT NULL,
    is_read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (ride_id)
        REFERENCES rides(id)
        ON DELETE CASCADE,

    FOREIGN KEY (sender_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    FOREIGN KEY (receiver_id)
        REFERENCES users(id)
        ON DELETE SET NULL
);

-- =========================================
-- REVIEWS / RATINGS
-- =========================================
CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ride_id INTEGER NOT NULL,
    reviewer_id INTEGER NOT NULL,
    reviewee_id INTEGER NOT NULL,
    rating INTEGER NOT NULL
        CHECK (rating BETWEEN 1 AND 5),
    comment TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (ride_id)
        REFERENCES rides(id)
        ON DELETE CASCADE,

    FOREIGN KEY (reviewer_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    FOREIGN KEY (reviewee_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);

-- =========================================
-- INDEXES
-- =========================================

CREATE INDEX IF NOT EXISTS idx_users_email
    ON users(email);

CREATE INDEX IF NOT EXISTS idx_driver_verifications_user
    ON driver_verifications(user_id);

CREATE INDEX IF NOT EXISTS idx_driver_verifications_status
    ON driver_verifications(status);

CREATE INDEX IF NOT EXISTS idx_passenger_verifications_user
    ON passenger_verifications(user_id);

CREATE INDEX IF NOT EXISTS idx_rides_driver
    ON rides(driver_id);

CREATE INDEX IF NOT EXISTS idx_rides_date_status
    ON rides(departure_date, status);

CREATE INDEX IF NOT EXISTS idx_bookings_ride
    ON bookings(ride_id);

CREATE INDEX IF NOT EXISTS idx_bookings_passenger
    ON bookings(passenger_id);

CREATE INDEX IF NOT EXISTS idx_messages_ride
    ON messages(ride_id);

CREATE INDEX IF NOT EXISTS idx_reviews_reviewee
    ON reviews(reviewee_id);