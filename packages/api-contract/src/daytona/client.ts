import { Daytona } from "@daytona/sdk";

let daytonaClientInstance: Daytona | null = null;

export function getDaytonaClient(): Daytona | null {
  const apiKey = process.env.DAYTONA_API_KEY;
  if (!apiKey) {
    return null;
  }

  if (!daytonaClientInstance) {
    const apiUrl = process.env.DAYTONA_API_URL;
    daytonaClientInstance = new Daytona({
      apiKey,
      ...(apiUrl ? { apiUrl } : {}),
    });
  }

  return daytonaClientInstance;
}
