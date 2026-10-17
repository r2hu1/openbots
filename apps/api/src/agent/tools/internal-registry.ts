import { getCurrentTime, calculate, executeCode, bash } from "./basic-system.js";
import { webSearch } from "./web-search.js";
import { fetchWebPage, httpRequest, dnsLookup } from "./http-dns.js";
import { jsonParser, textAnalyzer, transformText, generateUuid } from "./text-data.js";
import { unitConverter, randomGenerator } from "./conversions-random.js";
import { getWeather, wikipediaSearch, currencyConverter } from "./live-info.js";
import { parseDocument } from "./document-parser.js";

export const internalTools: Record<string, any> = {
  get_current_time: getCurrentTime,
  calculate: calculate,
  web_search: webSearch,
  fetch_web_page: fetchWebPage,
  http_request: httpRequest,
  json_parser: jsonParser,
  text_analyzer: textAnalyzer,
  execute_code: executeCode,
  generate_uuid: generateUuid,
  transform_text: transformText,
  unit_converter: unitConverter,
  random_generator: randomGenerator,
  get_weather: getWeather,
  wikipedia_search: wikipediaSearch,
  currency_converter: currencyConverter,
  dns_lookup: dnsLookup,
  bash: bash,
  parse_document: parseDocument,
};
