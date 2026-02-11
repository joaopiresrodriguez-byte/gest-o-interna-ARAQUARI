
import { SupabaseService } from '../src/services/SupabaseService';

async function verify() {
    console.log("Starting verification...");

    // 1. Verify Fleet (Vehicle) Insert with new columns
    console.log("1. Verifying Fleet Insert...");
    try {
        const vehicle = await SupabaseService.addVehicle({
            name: "Teste Viatura Fix",
            type: "Viatura",
            status: "active",
            details: "Verification test",
            plate: "TEST-123",
            current_km: 1000, // New column
            last_revision: new Date().toISOString() // New column
        });
        console.log("✅ Fleet Insert Success:", vehicle.id);
        // Cleanup
        await SupabaseService.deleteVehicle(vehicle.id);
    } catch (e) {
        console.error("❌ Fleet Insert Failed:", e);
    }

    // 2. Verify Product Receipt with receipt_date
    console.log("\n2. Verifying Product Receipt...");
    try {
        const receipt = await SupabaseService.addProductReceipt({
            photo_url: "http://example.com/photo.jpg",
            fiscal_note_number: "123",
            receipt_date: new Date().toISOString(), // Fixed field
            notes: "Verification test"
        });
        console.log("✅ Product Receipt Success:", receipt.id);
        await SupabaseService.deleteProductReceipt(receipt.id);
    } catch (e) {
        console.error("❌ Product Receipt Failed:", e);
    }

    // 3. Verify Daily Missions Fetch (Query Fix)
    console.log("\n3. Verifying Daily Missions Fetch...");
    try {
        const today = new Date().toISOString().split('T')[0];
        const missions = await SupabaseService.getDailyMissions({ data: today });
        console.log("✅ Daily Missions Fetch Success. Count:", missions.length);
    } catch (e) {
        console.error("❌ Daily Missions Fetch Failed:", e);
    }

    // 4. Verify Training Fetch (Join Fix)
    console.log("\n4. Verifying Trainings Fetch (Join)...");
    try {
        const trainings = await SupabaseService.getTrainings();
        // If table name match fails, Supabase throws error
        console.log("✅ Trainings Fetch Success. Count:", trainings.length);
    } catch (e) {
        console.error("❌ Trainings Fetch Failed:", e);
    }

    console.log("\nVerification Complete.");
}

verify();
