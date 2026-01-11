import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

interface Location {
  address: string;
  coordinates?: { lat: number; lng: number };
}

interface CommuteConfig {
  home: Location;
  daycare: Location;
  commute_preferences: {
    buffer_minutes: number;
  };
}

function loadConfig(): CommuteConfig {
  const path = "/root/.clawdbot/config/personal-locations.json";
  if (!existsSync(path)) {
    throw new Error("Locations config not found");
  }
  return JSON.parse(readFileSync(path, "utf8"));
}

function getApiKey(): string {
  const path = join(homedir(), ".clawdbot", "credentials", "google-maps-api.txt");
  if (!existsSync(path)) {
    throw new Error("Google Maps API key not found");
  }
  return readFileSync(path, "utf8").trim();
}

async function getDistance(
  origin: string | { lat: number; lng: number },
  destination: string | { lat: number; lng: number },
  departureTime?: Date
): Promise<{ distance: string; duration: string; durationSeconds: number }> {
  const apiKey = getApiKey();

  let originStr: string;
  let destStr: string;

  if (typeof origin === "object") {
    originStr = `${origin.lat},${origin.lng}`;
  } else {
    originStr = origin;
  }

  if (typeof destination === "object") {
    destStr = `${destination.lat},${destination.lng}`;
  } else {
    destStr = destination;
  }

  const params = new URLSearchParams({
    origins: originStr,
    destinations: destStr,
    key: apiKey,
  });

  if (departureTime) {
    params.append("departure_time", Math.floor(departureTime.getTime() / 1000).toString());
  }

  const res = await fetch(
    `https://maps.googleapis.com/maps/api/distancematrix/json?${params}`
  );

  if (!res.ok) {
    throw new Error(`Maps API error: ${res.status}`);
  }

  const data = (await res.json()) as any;

  if (data.status !== "OK") {
    throw new Error(`Maps API error: ${data.error_message || data.status}`);
  }

  const element = data.rows[0]?.elements[0];

  if (!element || element.status !== "OK") {
    throw new Error("No route found");
  }

  return {
    distance: element.distance.text,
    duration: element.duration.text,
    durationSeconds: element.duration.value,
  };
}

async function calculateDepartureTime(meetingTime: Date, meetingAddress: string) {
  const config = loadConfig() as any;

  console.log("📍 Calculating commute...\n");
  console.log(`Home: ${config.home.address}`);
  console.log(`Daycare: ${config.daycare.address}`);
  console.log(`Meeting: ${meetingAddress} at ${meetingTime.toLocaleTimeString()}\n`);

  // Home to daycare (current time)
  const homeToDaycare = await getDistance(
    config.home.coordinates,
    config.daycare.coordinates,
    new Date()
  );
  console.log(`🏠 → 🏫 ${homeToDaycare.duration} (${homeToDaycare.distance})`);

  // Daycare to meeting - account for daycare drop-off time (assume 15 min)
  const daycareLeaveTime = new Date(meetingTime.getTime() - (homeToDaycare.durationSeconds + 15 * 60) * 1000);

  let meetingCoords: any = config.meeting_location?.coordinates;
  if (!meetingCoords) {
    meetingCoords = await geocode(meetingAddress);
  }

  const daycareToMeeting = await getDistance(
    config.daycare.coordinates,
    meetingCoords,
    daycareLeaveTime
  );
  console.log(`🏫 → 📍 ${daycareToMeeting.duration} (${daycareToMeeting.distance})`);

  // Silent 5-minute buffer + 10-minute travel buffer
  const silentBufferSeconds = 5 * 60;
  const travelBufferSeconds = config.commute_preferences.buffer_minutes * 60;

  // Calculate total time needed (includes 15 min daycare drop-off)
  const daycareDropoffSeconds = 15 * 60;
  const totalTravelSeconds =
    homeToDaycare.durationSeconds + daycareDropoffSeconds + daycareToMeeting.durationSeconds;

  // Departure = Meeting time - 5 min (silent) - travel time - 10 min (buffer)
  const departureTime = new Date(
    meetingTime.getTime() - silentBufferSeconds * 1000 - totalTravelSeconds * 1000 - travelBufferSeconds * 1000
  );

  const arrivalWithoutBuffer = new Date(meetingTime.getTime() - silentBufferSeconds * 1000);
  const arrivalWithBuffer = new Date(arrivalWithoutBuffer.getTime() - travelBufferSeconds * 1000);

  console.log(
    `\n⏱️  Total commute: ${Math.floor(homeToDaycare.durationSeconds / 60)} min (drive) + 15 min (daycare drop-off) + ${Math.floor(daycareToMeeting.durationSeconds / 60)} min (to meeting)`
  );
  console.log(
    `\n📍 You'll arrive by: ${arrivalWithBuffer.toLocaleTimeString()} (${Math.floor((meetingTime.getTime() - arrivalWithBuffer.getTime()) / 1000 / 60)} min before meeting)`
  );
  console.log(
    `\n🚗 Leave home at: ${departureTime.toLocaleTimeString()}`
  );

  return departureTime;
}

async function main() {
  const [command, ...args] = process.argv.slice(2);

  if (command === "calculate" && args[0]) {
    // Parse meeting time: "YYYY-MM-DD HH:MM" or "HH:MM" (assumes today)
    let meetingTime: Date;
    const addressArg = args.slice(1).join(" ");

    if (args[0].includes("-")) {
      // Full date format
      meetingTime = new Date(args[0]);
    } else {
      // Time only, assume tomorrow
      const [hours, minutes] = args[0].split(":").map(Number);
      meetingTime = new Date();
      meetingTime.setDate(meetingTime.getDate() + 1); // Tomorrow
      meetingTime.setHours(hours, minutes, 0, 0);
    }

    const meetingAddress = addressArg || "3/9 Technology Dr, Arundel QLD 4214";

    try {
      await calculateDepartureTime(meetingTime, meetingAddress);
    } catch (err) {
      console.error(`❌ Error: ${err}`);
      process.exit(1);
    }
  } else {
    console.error(
      "Usage: commute-time calculate <HH:MM|YYYY-MM-DD HH:MM> [address]"
    );
    console.error("\nExamples:");
    console.error("  commute-time calculate 10:00");
    console.error('  commute-time calculate 10:00 "3/9 Technology Dr, Arundel"');
    console.error("  commute-time calculate 2026-01-12 10:00");
  }
}

main();
