const express = require("express");
const db = require("../db");

const router = express.Router();

// Current Sri Lanka fuel pricing standards (LKR per Liter)
const FUEL_PRICING = {
  petrol: 370,
  auto_diesel: 340,
  super_diesel: 380,
  hybrid_equivalent: 370,
};

// 1. Get Live Fuel Quota & Transit Analytics
router.get("/fuel-quota", (req, res) => {
  try {
    const today = new Date();
    const dayOfMonth = today.getDate();
    const isOddDay = dayOfMonth % 2 !== 0;
    const todayTag = isOddDay ? "ODD" : "EVEN";

    const totalRides = db
      .prepare("SELECT COUNT(*) AS count FROM rides WHERE status = 'active'")
      .get().count;
    const totalBookings = db
      .prepare(
        "SELECT COUNT(*) AS count FROM bookings WHERE status = 'confirmed'",
      )
      .get().count;

    // Fuel saving calculation: Avg round-trip is 35km. Carpool with 3 passengers saves ~3.2 Litres/day
    const totalLitersSaved = (totalBookings * 3.2).toFixed(1);
    const totalCostSavedLKR = Math.round(
      totalLitersSaved * FUEL_PRICING.petrol,
    );
    const totalCo2SavedKg = Math.round(totalLitersSaved * 2.31); // ~2.31 kg CO2 per liter petrol

    // District distribution breakdown based on active carpools
    const activeRides = db
      .prepare("SELECT origin FROM rides WHERE status = 'active'")
      .all();
    const corridors = {
      "Colombo & Suburbs": 0,
      "Gampaha / Kandy Road Corridor": 0,
      "Negombo / Airport Expressway Corridor": 0,
      "Southern Corridor (Moratuwa / Galle)": 0,
      "Other Outstations": 0,
    };

    activeRides.forEach((r) => {
      const orig = (r.origin || "").toLowerCase();
      if (
        orig.includes("gampaha") ||
        orig.includes("kiribathgoda") ||
        orig.includes("kelaniya") ||
        orig.includes("kadawatha")
      ) {
        corridors["Gampaha / Kandy Road Corridor"]++;
      } else if (
        orig.includes("negombo") ||
        orig.includes("ja-ela") ||
        orig.includes("wattala") ||
        orig.includes("kandana")
      ) {
        corridors["Negombo / Airport Expressway Corridor"]++;
      } else if (
        orig.includes("moratuwa") ||
        orig.includes("panadura") ||
        orig.includes("kalutara") ||
        orig.includes("galle")
      ) {
        corridors["Southern Corridor (Moratuwa / Galle)"]++;
      } else if (
        orig.includes("colombo") ||
        orig.includes("bambalapitiya") ||
        orig.includes("maradana") ||
        orig.includes("nugegoda")
      ) {
        corridors["Colombo & Suburbs"]++;
      } else {
        corridors["Other Outstations"]++;
      }
    });

    res.json({
      fuel_quota: {
        current_date: today.toISOString().split("T")[0],
        active_plate_rule: todayTag,
        authorized_last_digits: isOddDay ? [1, 3, 5, 7, 9] : [0, 2, 4, 6, 8],
        next_day_plate_rule: isOddDay ? "EVEN" : "ODD",
        pricing_lkr: FUEL_PRICING,
      },
      impact_summary: {
        total_active_carpools: totalRides,
        total_confirmed_trips: totalBookings,
        estimated_fuel_saved_liters: Number(totalLitersSaved),
        estimated_cost_saved_lkr: totalCostSavedLKR,
        estimated_co2_reduced_kg: totalCo2SavedKg,
      },
      corridor_distribution: corridors,
    });
  } catch (error) {
    console.error("Analytics error:", error);
    res.status(500).json({ error: "Failed to compute fuel quota analytics." });
  }
});

module.exports = router;
