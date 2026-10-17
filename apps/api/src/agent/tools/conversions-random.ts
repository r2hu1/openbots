import { tool } from "ai";
import { z } from "zod";

export const unitConverter = tool({
  description:
    "Convert between metric, imperial, and digital units: temperature (C, F, K), length (m, km, ft, mi, in, cm), weight (kg, g, lb, oz), volume (l, ml, gal, oz), data size (b, kb, mb, gb, tb), and time (s, m, h, d).",
  inputSchema: z.object({
    value: z.number().describe("Numeric amount to convert"),
    from: z
      .string()
      .describe(
        "Source unit symbol or name (e.g. 'km', 'mi', 'c', 'f', 'kg', 'lb', 'mb', 'gb')",
      ),
    to: z
      .string()
      .describe(
        "Target unit symbol or name (e.g. 'mi', 'km', 'f', 'c', 'lb', 'kg', 'gb', 'mb')",
      ),
  }),
  execute: async ({ value, from, to }) => {
    const f = from.trim().toLowerCase();
    const t = to.trim().toLowerCase();

    if (["c", "celsius", "f", "fahrenheit", "k", "kelvin"].includes(f)) {
      let celsius = value;
      if (f.startsWith("f")) celsius = ((value - 32) * 5) / 9;
      if (f.startsWith("k")) celsius = value - 273.15;

      let target = celsius;
      if (t.startsWith("f")) target = (celsius * 9) / 5 + 32;
      if (t.startsWith("k")) target = celsius + 273.15;

      return {
        value,
        from,
        to,
        result: Number(target.toFixed(2)),
      };
    }

    const lengthToMeters: Record<string, number> = {
      m: 1,
      meter: 1,
      meters: 1,
      km: 1000,
      kilometer: 1000,
      cm: 0.01,
      centimeter: 0.01,
      mm: 0.001,
      millimeter: 0.001,
      mi: 1609.344,
      mile: 1609.344,
      miles: 1609.344,
      yd: 0.9144,
      yard: 0.9144,
      ft: 0.3048,
      foot: 0.3048,
      feet: 0.3048,
      in: 0.0254,
      inch: 0.0254,
      inches: 0.0254,
    };

    if (lengthToMeters[f] && lengthToMeters[t]) {
      const meters = value * lengthToMeters[f];
      const result = meters / lengthToMeters[t];
      return { value, from, to, result: Number(result.toFixed(4)) };
    }

    const weightToGrams: Record<string, number> = {
      g: 1,
      gram: 1,
      grams: 1,
      kg: 1000,
      kilogram: 1000,
      mg: 0.001,
      lb: 453.59237,
      pound: 453.59237,
      pounds: 453.59237,
      oz: 28.3495,
      ounce: 28.3495,
      ton: 1000000,
    };

    if (weightToGrams[f] && weightToGrams[t]) {
      const grams = value * weightToGrams[f];
      const result = grams / weightToGrams[t];
      return { value, from, to, result: Number(result.toFixed(4)) };
    }

    const dataToBytes: Record<string, number> = {
      b: 1,
      byte: 1,
      bytes: 1,
      kb: 1024,
      mb: 1024 ** 2,
      gb: 1024 ** 3,
      tb: 1024 ** 4,
    };

    if (dataToBytes[f] && dataToBytes[t]) {
      const bytes = value * dataToBytes[f];
      const result = bytes / dataToBytes[t];
      return { value, from, to, result: Number(result.toFixed(4)) };
    }

    return {
      error: `Unsupported unit conversion between '${from}' and '${to}'`,
    };
  },
});

export const randomGenerator = tool({
  description:
    "Generate random numbers in a range, select random choices from a list, roll dice, shuffle arrays, or flip a coin.",
  inputSchema: z.object({
    type: z
      .enum(["number", "choice", "coin", "dice", "shuffle"])
      .describe("Kind of random generation"),
    min: z
      .number()
      .optional()
      .describe("Minimum number for 'number' range (default 1)"),
    max: z
      .number()
      .optional()
      .describe("Maximum number for 'number' range (default 100)"),
    options: z
      .array(z.string())
      .optional()
      .describe("List of choices for 'choice' or array to 'shuffle'"),
    diceCount: z.number().int().min(1).max(10).optional().default(1),
    diceSides: z.number().int().min(2).max(100).optional().default(6),
  }),
  execute: async ({
    type,
    min = 1,
    max = 100,
    options = [],
    diceCount = 1,
    diceSides = 6,
  }) => {
    switch (type) {
      case "number": {
        const val = Math.floor(Math.random() * (max - min + 1)) + min;
        return { type, min, max, result: val };
      }
      case "coin": {
        const flip = Math.random() < 0.5 ? "heads" : "tails";
        return { type, result: flip };
      }
      case "dice": {
        const rolls = Array.from(
          { length: diceCount },
          () => Math.floor(Math.random() * diceSides) + 1,
        );
        const total = rolls.reduce((a, b) => a + b, 0);
        return { type, diceCount, diceSides, rolls, total };
      }
      case "choice": {
        if (!options.length) {
          return { error: "Please provide 'options' array for random choice." };
        }
        const picked = options[Math.floor(Math.random() * options.length)];
        return { type, picked, from: options };
      }
      case "shuffle": {
        const arr = [...options];
        for (let i = arr.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          const temp = arr[i]!;
          arr[i] = arr[j]!;
          arr[j] = temp;
        }
        return { type, shuffled: arr };
      }
    }
  },
});
