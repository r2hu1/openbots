export const MARKDOWN_PRINT_STYLES = `
  @page {
    margin: 18mm 16mm;
    size: A4 portrait;
  }
  * {
    box-sizing: border-box;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  body, .markdown-print-container {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    color: #1e293b;
    background-color: #ffffff;
    line-height: 1.65;
    font-size: 11pt;
    margin: 0;
    padding: 0;
  }
  h1, h2, h3, h4, h5, h6 {
    color: #0f172a;
    font-weight: 700;
    line-height: 1.25;
    page-break-after: avoid;
    break-after: avoid;
  }
  h1 { font-size: 22pt; margin: 0 0 16pt 0; padding-bottom: 8pt; border-bottom: 2pt solid #e2e8f0; }
  h2 { font-size: 16pt; margin: 20pt 0 10pt 0; padding-bottom: 4pt; border-bottom: 1pt solid #f1f5f9; }
  h3 { font-size: 13pt; margin: 16pt 0 8pt 0; }
  h4 { font-size: 11.5pt; margin: 12pt 0 6pt 0; }
  p { margin: 0 0 10pt 0; }
  ul, ol { margin: 0 0 12pt 0; padding-left: 20pt; }
  li { margin-bottom: 4pt; }
  blockquote {
    margin: 12pt 0;
    padding: 6pt 14pt;
    border-left: 3.5pt solid #3b82f6;
    background: #f8fafc;
    color: #475569;
    font-style: italic;
  }
  code {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 9.5pt;
    background: #f1f5f9;
    color: #0f172a;
    padding: 2pt 4pt;
    border-radius: 3pt;
  }
  pre {
    background: #0f172a;
    color: #f8fafc;
    padding: 12pt 14pt;
    border-radius: 6pt;
    overflow-x: hidden;
    white-space: pre-wrap;
    word-break: break-all;
    margin: 12pt 0;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  pre code {
    background: transparent;
    color: inherit;
    padding: 0;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 14pt 0;
    font-size: 10pt;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  th, td {
    border: 1pt solid #cbd5e1;
    padding: 7pt 10pt;
    text-align: left;
  }
  th {
    background-color: #f1f5f9;
    font-weight: 600;
    color: #0f172a;
  }
  tr:nth-child(even) td {
    background-color: #f8fafc;
  }
  img {
    max-width: 100%;
    height: auto;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  hr {
    border: none;
    border-top: 1pt solid #e2e8f0;
    margin: 18pt 0;
  }
`;
