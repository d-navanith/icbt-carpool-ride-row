const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const dbPath = path.join(__dirname, "data", "carpool.db");
const jsonPath = path.join(__dirname, "carpool_data.json");

if (!fs.existsSync(jsonPath)) {
    throw new Error(`carpool_data.json not found: ${jsonPath}`);
}

const data = JSON.parse(
    fs.readFileSync(jsonPath, "utf8")
);

const db = new Database(dbPath);

try {
    // Make sure foreign keys are enabled.
    db.pragma("foreign_keys = ON");

    console.log("📦 Starting JSON → SQLite migration...\n");

    // -------------------------------------------------
    // IMPORTANT:
    // Clear current SQLite records so the migration
    // can be safely re-run without duplicate rows.
    // -------------------------------------------------

    const clearTables = db.transaction(() => {
        db.exec(`
            DELETE FROM reviews;
            DELETE FROM messages;
            DELETE FROM bookings;
            DELETE FROM rides;
            DELETE FROM passenger_verifications;
            DELETE FROM driver_verifications;
            DELETE FROM users;
        `);
    });

    clearTables();

    // -------------------------------------------------
    // USERS
    // -------------------------------------------------

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

    // -------------------------------------------------
    // DRIVER VERIFICATIONS
    // -------------------------------------------------

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

    // -------------------------------------------------
    // PASSENGER VERIFICATIONS
    // -------------------------------------------------

    const insertPassengerVerification = db.prepare(`
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
    `);

    // -------------------------------------------------
    // RIDES
    // -------------------------------------------------

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

    // -------------------------------------------------
    // BOOKINGS
    // -------------------------------------------------

    const insertBooking = db.prepare(`
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
    `);

    // -------------------------------------------------
    // MESSAGES
    // -------------------------------------------------

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

    // -------------------------------------------------
    // REVIEWS
    // -------------------------------------------------

    const insertReview = db.prepare(`
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
    `);

    // -------------------------------------------------
    // TRANSACTION
    // -------------------------------------------------

    const migrate = db.transaction(() => {
        for (const user of data.users ?? []) {
            insertUser.run({
                id: user.id,
                name: user.name ?? "",
                email: user.email ?? "",
                password_hash: user.password_hash ?? "",
                role: user.role ?? "student",
                system_role: user.system_role ?? "user",
                student_staff_id: user.student_staff_id ?? "",
                phone: user.phone ?? "",
                avatar: user.avatar ?? "",
                suspended: user.suspended ? 1 : 0,
                created_at: user.created_at ?? new Date().toISOString()
            });
        }

        for (const item of data.driver_verifications ?? []) {
            insertDriverVerification.run({
                id: item.id,
                user_id: item.user_id,
                license_number: item.license_number ?? "",
                vehicle_model: item.vehicle_model ?? "",
                vehicle_plate: item.vehicle_plate ?? "",
                odd_even_type: item.odd_even_type ?? "ODD",
                seats: item.seats ?? 1,
                fuel_type: item.fuel_type ?? "",
                license_doc_url: item.license_doc_url ?? "",
                vehicle_photo_url: item.vehicle_photo_url ?? "",
                status: item.status ?? "pending",
                admin_comment: item.admin_comment ?? "",
                submitted_at: item.submitted_at ?? new Date().toISOString(),
                reviewed_at: item.reviewed_at ?? null
            });
        }

        for (const item of data.passenger_verifications ?? []) {
            insertPassengerVerification.run({
                id: item.id,
                user_id: item.user_id,
                id_card_number: item.id_card_number ?? "",
                id_doc_url: item.id_doc_url ?? "",
                status: item.status ?? "pending",
                admin_comment: item.admin_comment ?? "",
                submitted_at: item.submitted_at ?? new Date().toISOString(),
                reviewed_at: item.reviewed_at ?? null
            });
        }

        for (const ride of data.rides ?? []) {
            insertRide.run({
                id: ride.id,
                driver_id: ride.driver_id,
                origin: ride.origin ?? "",
                destination: ride.destination ?? "",
                route_waypoints: ride.route_waypoints ?? "[]",
                departure_date: ride.departure_date ?? "",
                departure_time: ride.departure_time ?? "",
                return_time: ride.return_time ?? null,
                total_seats: ride.total_seats ?? 1,
                available_seats: ride.available_seats ?? 0,
                price_per_seat: Number(ride.price_per_seat ?? 0),
                vehicle_desc: ride.vehicle_desc ?? "",
                odd_even_tag: ride.odd_even_tag ?? null,
                notes: ride.notes ?? "",
                status: ride.status ?? "active",
                created_at: ride.created_at ?? new Date().toISOString()
            });
        }

        for (const booking of data.bookings ?? []) {
            insertBooking.run({
                id: booking.id,
                ride_id: booking.ride_id,
                passenger_id: booking.passenger_id,
                seats_booked: booking.seats_booked ?? 1,
                pickup_location: booking.pickup_location ?? "",
                booking_code: booking.booking_code ?? `CP-${booking.id}`,
                status: booking.status ?? "pending",

                // These fields did not exist in the old JSON structure.
                payment_status: booking.payment_status ?? "unpaid",
                payment_method: booking.payment_method ?? null,
                paid_amount: Number(booking.paid_amount ?? 0),
                completed_at: booking.completed_at ?? null,

                created_at: booking.created_at ?? new Date().toISOString()
            });
        }

        for (const message of data.messages ?? []) {
            insertMessage.run({
                id: message.id,
                ride_id: message.ride_id,
                sender_id: message.sender_id,
                receiver_id: message.receiver_id ?? null,
                text: message.text ?? "",
                is_read: message.is_read ? 1 : 0,
                created_at: message.created_at ?? new Date().toISOString()
            });
        }

        for (const review of data.reviews ?? []) {
            insertReview.run({
                id: review.id,
                ride_id: review.ride_id,
                reviewer_id: review.reviewer_id,
                reviewee_id: review.reviewee_id,
                rating: review.rating ?? 5,
                comment: review.comment ?? "",
                created_at: review.created_at ?? new Date().toISOString()
            });
        }
    });

    migrate();

    console.log("✅ Migration completed successfully.\n");

    // -------------------------------------------------
    // VERIFICATION
    // -------------------------------------------------

    const tables = [
        "users",
        "driver_verifications",
        "passenger_verifications",
        "rides",
        "bookings",
        "messages",
        "reviews"
    ];

    console.log("📊 Migration verification:\n");

    for (const table of tables) {
        const result = db
            .prepare(`SELECT COUNT(*) AS count FROM ${table}`)
            .get();

        console.log(`${table.padEnd(26)} ${result.count}`);
    }

    // -------------------------------------------------
    // ADMIN CHECK
    // -------------------------------------------------

    const adminUsers = db
        .prepare(`
            SELECT id, name, email, role, system_role
            FROM users
            WHERE system_role = 'admin'
        `)
        .all();

    console.log("\n🔐 Admin account(s):");

    if (adminUsers.length === 0) {
        console.log("   ⚠️ No admin account found.");
    } else {
        for (const admin of adminUsers) {
            console.log(
                `   ${admin.id} | ${admin.name} | ${admin.email} | ${admin.role} | ${admin.system_role}`
            );
        }
    }

} catch (error) {
    console.error("\n❌ Migration failed.");
    console.error(error);
    process.exitCode = 1;
} finally {
    db.close();
}