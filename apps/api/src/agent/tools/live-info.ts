import { tool } from "ai";
import { z } from "zod";

const WEATHER_CODE_MAP: Record<number, string> = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  61: "Slight rain",
  62: "Moderate rain",
  65: "Heavy rain",
  71: "Slight snow fall",
  73: "Moderate snow fall",
  75: "Heavy snow fall",
  80: "Slight rain showers",
  81: "Moderate rain showers",
  82: "Violent rain showers",
  95: "Thunderstorm",
  96: "Thunderstorm with slight hail",
  99: "Thunderstorm with heavy hail",
};

export const getWeather = tool({
  description:
    "Get live real-time weather conditions and forecast for any city or location in the world. Provides temperature, humidity, apparent temperature, wind speed, condition summary, and daily forecast.",
  inputSchema: z.object({
    location: z
      .string()
      .min(1)
      .describe(
        "City or place name, e.g. 'Mumbai', 'New York', 'London', 'Tokyo'",
      ),
    temperatureUnit: z
      .enum(["celsius", "fahrenheit"])
      .default("celsius")
      .describe("Unit of temperature: 'celsius' or 'fahrenheit'"),
  }),
  execute: async ({ location, temperatureUnit }) => {
    try {
      const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
        location,
      )}&count=1&language=en&format=json`;
      const geoRes = await fetch(geoUrl);
      if (!geoRes.ok) {
        return { error: `Failed to find location: ${location}` };
      }
      const geoData = (await geoRes.json()) as {
        results?: Array<{
          name: string;
          country?: string;
          admin1?: string;
          latitude: number;
          longitude: number;
          timezone?: string;
        }>;
      };

      const match = geoData.results?.[0];
      if (!match) {
        return {
          error: `Location '${location}' not found. Please try specifying a nearby major city.`,
        };
      }

      const tempParam =
        temperatureUnit === "fahrenheit" ? "&temperature_unit=fahrenheit" : "";
      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${match.latitude}&longitude=${match.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto${tempParam}`;
      const weatherRes = await fetch(weatherUrl);
      if (!weatherRes.ok) {
        return { error: `Could not retrieve weather data for ${match.name}` };
      }

      const weatherData = (await weatherRes.json()) as any;
      const current = weatherData.current;
      const daily = weatherData.daily;
      const condition =
        WEATHER_CODE_MAP[current?.weather_code] ??
        `Code ${current?.weather_code}`;

      return {
        location: match.name,
        region: match.admin1,
        country: match.country,
        coordinates: { latitude: match.latitude, longitude: match.longitude },
        timezone: match.timezone ?? weatherData.timezone,
        condition,
        temperature: `${current?.temperature_2m}°${temperatureUnit === "fahrenheit" ? "F" : "C"}`,
        feelsLike: `${current?.apparent_temperature}°${temperatureUnit === "fahrenheit" ? "F" : "C"}`,
        humidity: `${current?.relative_humidity_2m}%`,
        windSpeed: `${current?.wind_speed_10m} km/h`,
        precipitation: `${current?.precipitation} mm`,
        dailyForecast: daily?.time
          ?.slice(0, 3)
          ?.map((date: string, i: number) => ({
            date,
            condition: WEATHER_CODE_MAP[daily.weather_code[i]] ?? "Unknown",
            maxTemp: `${daily.temperature_2m_max[i]}°`,
            minTemp: `${daily.temperature_2m_min[i]}°`,
          })),
      };
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : "Weather retrieval failed",
      };
    }
  },
});

export const wikipediaSearch = tool({
  description:
    "Search Wikipedia for articles, facts, history, biographies, concepts, or encyclopedic knowledge and retrieve page summaries and links.",
  inputSchema: z.object({
    query: z.string().min(1).describe("Search topic or concept on Wikipedia"),
  }),
  execute: async ({ query }) => {
    try {
      const searchUrl = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(
        query,
      )}&limit=3&namespace=0&format=json`;
      const res = await fetch(searchUrl, {
        headers: { "User-Agent": "OpenBots/1.0" },
      });
      if (!res.ok) {
        return { error: "Failed to connect to Wikipedia" };
      }
      const data = (await res.json()) as [string, string[], string[], string[]];
      const titles = data[1] ?? [];
      const descriptions = data[2] ?? [];
      const urls = data[3] ?? [];

      if (!titles.length || !titles[0]) {
        return { query, result: "No matching Wikipedia articles found." };
      }

      const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
        titles[0],
      )}`;
      const summaryRes = await fetch(summaryUrl, {
        headers: { "User-Agent": "OpenBots/1.0" },
      });

      let fullExtract = "";
      if (summaryRes.ok) {
        const summaryData = (await summaryRes.json()) as any;
        fullExtract = summaryData.extract || "";
      }

      return {
        title: titles[0],
        summary: fullExtract || descriptions[0] || "Summary unavailable",
        url: urls[0],
        related: titles.slice(1).map((t, idx) => ({
          title: t,
          url: urls[idx + 1],
        })),
      };
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : "Wikipedia lookup failed",
      };
    }
  },
});

export const currencyConverter = tool({
  description:
    "Get live exchange rates and convert monetary amounts between global fiat currencies (e.g. USD, EUR, INR, GBP, JPY, CAD, AUD, CHF, CNY).",
  inputSchema: z.object({
    amount: z.number().positive().describe("The numeric amount to convert"),
    from: z
      .string()
      .length(3)
      .describe("3-letter base currency code, e.g. 'USD', 'EUR', 'INR'"),
    to: z
      .string()
      .length(3)
      .describe("3-letter target currency code, e.g. 'INR', 'EUR', 'GBP'"),
  }),
  execute: async ({ amount, from, to }) => {
    try {
      const base = from.toUpperCase();
      const target = to.toUpperCase();
      const res = await fetch(`https://open.er-api.com/v6/latest/${base}`);
      if (!res.ok) {
        return { error: `Failed to fetch exchange rates for ${base}` };
      }
      const data = (await res.json()) as {
        result: string;
        rates?: Record<string, number>;
        time_last_update_utc?: string;
      };

      if (data.result !== "success" || !data.rates) {
        return {
          error: `Currency code '${base}' not supported or rate unavailable.`,
        };
      }

      const rate = data.rates[target];
      if (rate === undefined) {
        return {
          error: `Target currency '${target}' not found in exchange rates.`,
        };
      }

      const converted = Number((amount * rate).toFixed(4));
      return {
        amount,
        from: base,
        to: target,
        rate,
        converted,
        lastUpdated: data.time_last_update_utc,
      };
    } catch (err) {
      return {
        error:
          err instanceof Error ? err.message : "Currency conversion failed",
      };
    }
  },
});
