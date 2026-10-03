import {
  IconBrandAirtable,
  IconBrandAsana,
  IconBrandDiscord,
  IconBrandGithub,
  IconBrandGmail,
  IconBrandGoogleDrive,
  IconBrandGoogleMaps,
  IconBrandJira,
  IconBrandLinkedin,
  IconBrandNotion,
  IconBrandOffice,
  IconBrandSlack,
  IconBrandStripe,
  IconBrandTrello,
  IconBrandTwitter,
  IconBrandYoutube,
  IconBrandZoom,
  IconCalendar,
  IconChartBar,
  IconFileSpreadsheet,
  IconFileText,
  IconFlame,
  IconNews,
  IconWaveSine,
} from "@tabler/icons-react";
import type { IntegrationApp } from "./types";

export const AVAILABLE_INTEGRATIONS: readonly IntegrationApp[] = [
  {
    id: "gmail",
    name: "Gmail",
    description: "Send emails, draft replies, and query inbox messages.",
    icon: IconBrandGmail,
    accountId: "gmail_connected_account",
  },
  {
    id: "notion",
    name: "Notion",
    description: "Read, write, search, and update databases and docs.",
    icon: IconBrandNotion,
    accountId: "notion_connected_account",
  },
  {
    id: "github",
    name: "GitHub",
    description:
      "Manage repositories, pull requests, issues, and code reviews.",
    icon: IconBrandGithub,
    accountId: "github_connected_account",
  },
  {
    id: "slack",
    name: "Slack",
    description:
      "Post messages, read channels, and automate team notifications.",
    icon: IconBrandSlack,
    accountId: "slack_connected_account",
  },
  {
    id: "googlecalendar",
    name: "Google Calendar",
    description:
      "Schedule events, check availability, and manage calendar meetings.",
    icon: IconCalendar,
    accountId: "googlecalendar_connected_account",
  },
  {
    id: "discord",
    name: "Discord",
    description:
      "Send channel messages, trigger webhooks, and interact with servers.",
    icon: IconBrandDiscord,
    accountId: "discord_connected_account",
  },
  {
    id: "googledrive",
    name: "Google Drive",
    description: "Search, organize, upload, and read files from Google Drive.",
    icon: IconBrandGoogleDrive,
    accountId: "googledrive_connected_account",
  },
  {
    id: "jira",
    name: "Jira",
    description: "Create issues, track sprints, and query development tickets.",
    icon: IconBrandJira,
    accountId: "jira_connected_account",
  },
  {
    id: "trello",
    name: "Trello",
    description:
      "Manage boards, create task cards, and automate project workflows.",
    icon: IconBrandTrello,
    accountId: "trello_connected_account",
  },
  {
    id: "asana",
    name: "Asana",
    description:
      "Coordinate team tasks, project milestones, and assignment statuses.",
    icon: IconBrandAsana,
    accountId: "asana_connected_account",
  },
  {
    id: "airtable",
    name: "Airtable",
    description:
      "Query relational records, add rows, and update spreadsheet databases.",
    icon: IconBrandAirtable,
    accountId: "airtable_connected_account",
  },
  {
    id: "stripe",
    name: "Stripe",
    description:
      "View customer billing, search payments, invoices, and subscriptions.",
    icon: IconBrandStripe,
    accountId: "stripe_connected_account",
  },
  {
    id: "youtube",
    name: "YouTube",
    description: "Search videos, manage playlists, and read channel analytics.",
    icon: IconBrandYoutube,
    accountId: "youtube_connected_account",
  },
  {
    id: "zoom",
    name: "Zoom",
    description:
      "Create video meetings, manage recordings, and access schedule links.",
    icon: IconBrandZoom,
    accountId: "zoom_connected_account",
  },
  {
    id: "googlesheets",
    name: "Google Sheets",
    description:
      "Read, write, format spreadsheets, append rows, and manage worksheets.",
    icon: IconFileSpreadsheet,
    accountId: "googlesheets_connected_account",
  },
  {
    id: "twitter",
    name: "Twitter (X)",
    description:
      "Post tweets, search feeds, send direct messages, and track mentions.",
    icon: IconBrandTwitter,
    accountId: "twitter_connected_account",
  },
  {
    id: "outlook",
    name: "Outlook",
    description:
      "Send emails, manage Outlook inbox, calendar invites, and contacts.",
    icon: IconBrandOffice,
    accountId: "outlook_connected_account",
  },
  {
    id: "googledocs",
    name: "Google Docs",
    description:
      "Create documents, read paragraphs, format text, and insert content.",
    icon: IconFileText,
    accountId: "googledocs_connected_account",
  },
  {
    id: "firecrawl",
    name: "Firecrawl",
    description:
      "Scrape, crawl, and convert any website into clean markdown or structured data.",
    icon: IconFlame,
    accountId: "firecrawl_connected_account",
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    description:
      "Share company updates, publish posts, view profiles, and manage engagements.",
    icon: IconBrandLinkedin,
    accountId: "linkedin_connected_account",
  },
  {
    id: "elevenlabs",
    name: "ElevenLabs",
    description:
      "Generate realistic AI speech, synthesize voices, and convert text to audio.",
    icon: IconWaveSine,
    accountId: "elevenlabs_connected_account",
  },
  {
    id: "google_maps",
    name: "Google Maps",
    description:
      "Search places, get navigation directions, calculate routes, and find points of interest.",
    icon: IconBrandGoogleMaps,
    accountId: "google_maps_connected_account",
  },
  {
    id: "posthog",
    name: "PostHog",
    description:
      "Query product analytics, track custom events, view session recordings, and feature flags.",
    icon: IconChartBar,
    accountId: "posthog_connected_account",
  },
];
