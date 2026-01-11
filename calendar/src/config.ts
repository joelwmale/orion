export type ProfileName = "personal" | "work";

export interface CalendarProfileConfig {
  profile: ProfileName;
  tokenPath: string;
  calendarId: string;
}

export interface CalendarsConfig {
  credentialsPath: string;
  profiles: Record<ProfileName, CalendarProfileConfig>;
}

export const defaultConfig: CalendarsConfig = {
  credentialsPath: "secrets/google/credentials.json",
  profiles: {
    personal: {
      profile: "personal",
      tokenPath: "secrets/google/token-personal.json",
      calendarId: "primary",
    },
    work: {
      profile: "work",
      tokenPath: "secrets/google/token-work.json",
      calendarId: "primary",
    },
  },
};
