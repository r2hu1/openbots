export const TAILWIND_BROWSER =
  "https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"

export const CHART_COMPAT_SCRIPT = String.raw`
(function () {
  var current;

  function cssVar(name) {
    return getComputedStyle(document.documentElement)
      .getPropertyValue(name)
      .trim();
  }

  function resolve(value) {
    if (typeof value === "string") {
      return value.replace(
        /var\((--[\w-]+)\)/g,
        function (match, name) {
          return cssVar(name) || match;
        }
      );
    }

    if (Array.isArray(value)) {
      return value.map(resolve);
    }

    if (
      value &&
      typeof value === "object" &&
      Object.getPrototypeOf(value) === Object.prototype
    ) {
      var out = {};

      for (var key in value) {
        out[key] = resolve(value[key]);
      }

      return out;
    }

    return value;
  }

  function getChartColors() {
    return [
      cssVar("--chart-1"),
      cssVar("--chart-2"),
      cssVar("--chart-3"),
      cssVar("--chart-4"),
      cssVar("--chart-5")
    ].filter(Boolean);
  }

  function applyTheme(Chart) {
    try {
      var colors = getChartColors();

      Chart.defaults.color =
        cssVar("--foreground") ||
        cssVar("--muted-foreground");

      Chart.defaults.borderColor =
        cssVar("--border");

      Chart.defaults.font.family =
        cssVar("--font-sans") ||
        "ui-sans-serif, system-ui, sans-serif";

      /*
       * Chart.js global defaults.
       */
      Chart.defaults.elements.line.borderWidth = 2;

      /*
       * Use chart colors for common elements.
       */
      if (colors.length) {
        Chart.defaults.elements.line.borderColor = colors[0];
        Chart.defaults.elements.point.backgroundColor = colors[0];
        Chart.defaults.elements.point.borderColor = colors[0];

        Chart.defaults.elements.bar.backgroundColor = colors[0];
        Chart.defaults.elements.bar.borderColor = colors[0];

        Chart.defaults.elements.arc.backgroundColor = colors;
        Chart.defaults.elements.arc.borderColor =
          cssVar("--background") || "#fff";
      }
    } catch (e) {}
  }

  function applyDatasetColors(config) {
    var colors = getChartColors();

    if (!colors.length || !config) {
      return config;
    }

    var datasets =
      config.data &&
      Array.isArray(config.data.datasets)
        ? config.data.datasets
        : null;

    if (!datasets) {
      return config;
    }

    datasets.forEach(function (dataset, index) {
      var color = colors[index % colors.length];

      /*
       * Only provide colors when the user
       * didn't explicitly specify them.
       */
      if (!dataset.backgroundColor) {
        dataset.backgroundColor = color;
      }

      if (!dataset.borderColor) {
        dataset.borderColor = color;
      }

      /*
       * Line charts should generally have
       * transparent fills.
       */
      if (
        config.type === "line" ||
        config.type === "scatter"
      ) {
        if (!dataset.backgroundColor) {
          dataset.backgroundColor = color;
        }

        if (!dataset.borderColor) {
          dataset.borderColor = color;
        }
      }
    });

    return config;
  }

  function wrap(Original) {
    try {
      applyTheme(Original);
    } catch (e) {}

    function Wrapped(ctx, config) {
      var resolved = resolve(config);
      resolved = applyDatasetColors(resolved);

      return new Original(ctx, resolved);
    }

    Wrapped.prototype = Original.prototype;
    Object.setPrototypeOf(Wrapped, Original);

    return Wrapped;
  }

  Object.defineProperty(window, "Chart", {
    configurable: true,

    get: function () {
      return current;
    },

    set: function (value) {
      current =
        value && value.defaults
          ? wrap(value)
          : value;
    }
  });
})();
`

export const AUTO_HEIGHT_SCRIPT = String.raw`
(function () {
  var last = 0;
  function post() {
    var h = Math.ceil(document.body.getBoundingClientRect().height);
    if (h && h !== last) {
      last = h;
      window.parent.postMessage({ type: "openbots:artifact-height", height: h }, "*");
    }
  }
  function start() {
    new ResizeObserver(post).observe(document.body);
    post();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
`

export const ARTIFACT_ACTION_SCRIPT = String.raw`
(function () {
  window.sendPrompt = function (prompt, options) {
    if (!prompt) return;
    window.parent.postMessage({
      type: "openbots:send-prompt",
      prompt: String(prompt),
      options: options || {}
    }, "*");
  };

  window.askQuestion = function (questionOrData) {
    var prompt = typeof questionOrData === "string" ? questionOrData : JSON.stringify(questionOrData);
    window.sendPrompt(prompt);
  };
})();
`
