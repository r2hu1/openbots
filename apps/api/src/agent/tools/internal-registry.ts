import { getCurrentTime, calculate, executeCode, bash } from "./basic-system.js";
import { webSearch } from "./web-search.js";
import { fetchWebPage, httpRequest } from "./http-dns.js";
import { getWeather, wikipediaSearch } from "./live-info.js";
import { parseDocument } from "./document-parser.js";

export const internalTools: Record<string, any> = {
  get_current_time: getCurrentTime,
  calculate: calculate,
  web_search: webSearch,
  fetch_web_page: fetchWebPage,
  http_request: httpRequest,
  execute_code: executeCode,
  get_weather: getWeather,
  wikipedia_search: wikipediaSearch,
  bash: bash,
  parse_document: parseDocument,
};
