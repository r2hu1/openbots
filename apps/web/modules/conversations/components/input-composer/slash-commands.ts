import {
  Activity,
  Book,
  Calendar,
  Chart,
  ClipboardCheck,
  Code,
  Diagram,
  ListCheck,
  Scan,
  Search2,
} from "reicon-react";
import type { SlashCommand } from "./types";

export const SLASH_COMMANDS: SlashCommand[] = [
  {
    name: "web_search",
    label: "Web Search",
    insertText: "/search",
    description: "Search the web for up-to-date facts, news, and links",
    category: "browse",
    icon: Search2,
  },
  {
    name: "research",
    label: "Deep Research",
    insertText: "/research",
    description:
      "Multi-source research, authoritative synthesis, and citations",
    category: "research",
    icon: Book,
  },
  {
    name: "schedule",
    label: "Schedule Task",
    insertText: "/schedule",
    description:
      "Set reminders, delayed alarms, or background recurring cron jobs",
    category: "schedule",
    icon: Calendar,
  },
  {
    name: "tasks",
    label: "View Tasks",
    insertText: "/tasks",
    description: "Show and manage active and recurring scheduled tasks",
    category: "schedule",
    icon: ListCheck,
  },
  {
    name: "chart",
    label: "Create Chart",
    insertText: "/chart",
    description: "Generate interactive visual charts and data breakdowns",
    category: "visual",
    icon: Chart,
  },
  {
    name: "diagram",
    label: "Create Diagram",
    insertText: "/diagram",
    description: "Generate architecture flowcharts and sequence diagrams",
    category: "visual",
    icon: Diagram,
  },
  {
    name: "graph",
    label: "Plot Graph",
    insertText: "/graph",
    description: "Plot equations, mathematical models, or network graphs",
    category: "visual",
    icon: Activity,
  },
  {
    name: "code",
    label: "Write Code",
    insertText: "/code",
    description: "Write, build, or refactor code cleanly",
    category: "coding",
    icon: Code,
  },
  {
    name: "review",
    label: "Code Review",
    insertText: "/review",
    description:
      "Inspect code for improvements, performance, and security bugs",
    category: "coding",
    icon: ClipboardCheck,
  },
  {
    name: "analyze",
    label: "Analyze File",
    insertText: "/analyze",
    description: "Analyze and extract insights from attached images or files",
    category: "file",
    icon: Scan,
  },
];
