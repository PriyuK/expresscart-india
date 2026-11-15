import * as fs from 'fs';
import * as path from 'path';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  HeadingLevel,
  BorderStyle,
  PageBreak,
  Header,
  Footer,
  PageNumber,
  ShadingType,
} from 'docx';

const OUT_DIR = path.join(process.cwd(), 'docs');
if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

const COLORS = {
  primary: '059669', // Emerald
  dark: '09090B',
  slate: '3F3F46',
  muted: '71717A',
  border: 'E4E4E7',
  lightBg: 'F4F4F5',
  emeraldBg: 'ECFDF5',
  blueDark: '1E3A8A',
};

function h1(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 280, after: 120 },
    children: [
      new TextRun({
        text,
        bold: true,
        size: 30,
        color: COLORS.dark,
        font: 'Calibri',
      }),
    ],
  });
}

function h2(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 200, after: 100 },
    children: [
      new TextRun({
        text,
        bold: true,
        size: 24,
        color: COLORS.primary,
        font: 'Calibri',
      }),
    ],
  });
}

function h3(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 160, after: 80 },
    children: [
      new TextRun({
        text,
        bold: true,
        size: 21,
        color: COLORS.blueDark,
        font: 'Calibri',
      }),
    ],
  });
}

function p(text: string): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: 110, line: 280 },
    children: [
      new TextRun({
        text,
        size: 20,
        color: '18181B',
        font: 'Calibri',
      }),
    ],
  });
}

function bullet(label: string, body: string): Paragraph {
  return new Paragraph({
    bullet: { level: 0 },
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: 90, line: 270 },
    children: [
      new TextRun({
        text: `${label}: `,
        bold: true,
        size: 20,
        color: COLORS.dark,
        font: 'Calibri',
      }),
      new TextRun({
        text: body,
        size: 20,
        color: '27272A',
        font: 'Calibri',
      }),
    ],
  });
}

function callout(title: string, body: string): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    margins: { top: 90, bottom: 90, left: 130, right: 130 },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            shading: { fill: COLORS.emeraldBg, type: ShadingType.CLEAR },
            borders: {
              left: { style: BorderStyle.SINGLE, size: 16, color: COLORS.primary },
              top: { style: BorderStyle.SINGLE, size: 4, color: 'A7F3D0' },
              right: { style: BorderStyle.SINGLE, size: 4, color: 'A7F3D0' },
              bottom: { style: BorderStyle.SINGLE, size: 4, color: 'A7F3D0' },
            },
            children: [
              new Paragraph({
                spacing: { after: 40 },
                children: [
                  new TextRun({
                    text: title,
                    bold: true,
                    size: 20,
                    color: COLORS.primary,
                    font: 'Calibri',
                  }),
                ],
              }),
              new Paragraph({
                spacing: { line: 260 },
                children: [
                  new TextRun({
                    text: body,
                    size: 19,
                    color: '064E3B',
                    font: 'Calibri',
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

function codeBlock(codeText: string): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    margins: { top: 70, bottom: 70, left: 110, right: 110 },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            shading: { fill: '18181B', type: ShadingType.CLEAR },
            borders: {
              left: { style: BorderStyle.SINGLE, size: 12, color: COLORS.primary },
              top: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.NONE },
            },
            children: [
              new Paragraph({
                spacing: { line: 230 },
                children: [
                  new TextRun({
                    text: codeText,
                    size: 17,
                    color: 'A7F3D0',
                    font: 'Consolas',
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

function table(headers: string[], rows: string[][]): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        tableHeader: true,
        children: headers.map(
          (hdr) =>
            new TableCell({
              shading: { fill: COLORS.dark, type: ShadingType.CLEAR },
              margins: { top: 70, bottom: 70, left: 90, right: 90 },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: hdr,
                      bold: true,
                      size: 18,
                      color: 'FFFFFF',
                      font: 'Calibri',
                    }),
                  ],
                }),
              ],
            })
        ),
      }),
      ...rows.map(
        (r, idx) =>
          new TableRow({
            children: r.map(
              (cellText) =>
                new TableCell({
                  shading: {
                    fill: idx % 2 === 0 ? 'FFFFFF' : COLORS.lightBg,
                    type: ShadingType.CLEAR,
                  },
                  margins: { top: 60, bottom: 60, left: 90, right: 90 },
                  borders: {
                    top: { style: BorderStyle.SINGLE, size: 4, color: COLORS.border },
                    bottom: { style: BorderStyle.SINGLE, size: 4, color: COLORS.border },
                    left: { style: BorderStyle.SINGLE, size: 4, color: COLORS.border },
                    right: { style: BorderStyle.SINGLE, size: 4, color: COLORS.border },
                  },
                  children: [
                    new Paragraph({
                      spacing: { line: 240 },
                      children: [
                        new TextRun({
                          text: cellText,
                          size: 18,
                          color: '18181B',
                          font: 'Calibri',
                        }),
                      ],
                    }),
                  ],
                })
            ),
          })
      ),
    ],
  });
}

function pageBreak(): Paragraph {
  return new Paragraph({ children: [new PageBreak()] });
}

// -------------------------------------------------------------
// SYNOPSIS CHAPTER DEFINITIONS - 100 DENSE, FULL-PAGE CHAPTERS
// -------------------------------------------------------------
// We structure 100 discrete technical and executive chapters.
// Each chapter contains rich, substantive prose, tables, bullet points,
// code structures, and real operational data from the actual codebase.
// -------------------------------------------------------------

interface ChapterDef {
  number: number;
  title: string;
  category: string;
  summary: string;
  subsections: {
    title: string;
    paragraphs: string[];
    bullets?: { label: string; text: string }[];
    tableData?: { headers: string[]; rows: string[][] };
    codeSnippet?: string;
    calloutBox?: { title: string; text: string };
  }[];
}

import { generate100Chapters } from './synopsis_data';

async function main() {
  console.log('Building 100-Page Master Synopsis Document...');
  const chapters: ChapterDef[] = generate100Chapters();

  const elements: (Paragraph | Table)[] = [];

  // Cover Page
  elements.push(
    new Paragraph({
      spacing: { before: 400, after: 80 },
      children: [
        new TextRun({
          text: 'SILVYOS ENTERPRISE RETAIL PLATFORMS & ARCHITECTURE',
          bold: true,
          size: 22,
          color: COLORS.primary,
          font: 'Calibri',
        }),
      ],
    }),
    new Paragraph({
      spacing: { before: 120, after: 120 },
      children: [
        new TextRun({
          text: 'EXPRESSCART INDIA',
          bold: true,
          size: 48,
          color: COLORS.dark,
          font: 'Calibri',
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: 'Comprehensive 100-Page Master Technical Synopsis & System Requirements Specification (SRS): Ground-Up Architecture, Offline Synchronization, Cryptographic Anti-Shrinkage, and ERP Data Integration for High-Throughput Modern Trade Retail in India',
          size: 22,
          color: COLORS.slate,
          font: 'Calibri',
        }),
      ],
    }),
    callout(
      'MASTER TECHNICAL SYNOPSIS — ENTERPRISE & INVESTOR SPECIFICATION',
      'This 100-page master technical document is the authoritative engineering, algorithmic, and financial specification for ExpressCart India, authored by Founder Priyanshu Kottapalli under SilvyOS. It spans 100 dedicated technical chapters covering every tier of the production platform — mobile client engineering, entrance geo-sync, promotional calculation algorithms, 5-layer loss prevention, reverse spot-scanning, PostgreSQL relational schemas, and enterprise ERP integration interfaces.'
    ),
    new Paragraph({ spacing: { before: 200, after: 120 }, children: [] }),
    table(
      ['Specification Attribute', 'Enterprise Production Standard'],
      [
        ['System Title & Release', 'ExpressCart India Enterprise Platform (v1.0.0-PROD)'],
        ['Architect & Founder', 'Priyanshu Kottapalli'],
        ['Parent Technology Venture', 'SilvyOS'],
        ['Live Cloud Domain', 'https://expresscart-india.vercel.app'],
        ['Git Source Code Repository', 'https://github.com/PriyuK/expresscart-india (Branch: main)'],
        ['Client Application Framework', 'Expo SDK 58 / React Native 0.88 + React Native Web (Unified Binary)'],
        ['State & Persistence Engine', 'Zustand 5.0 with AsyncStorage / LocalStorage Middleware'],
        ['Backend & API Microservice', 'Vercel Serverless Edge Functions + Node.js HTTP Standalone Gateway (backend/server.mjs)'],
        ['Relational Database Engine', 'Neon Serverless PostgreSQL (Serverless Driver) + Auto-Failover Local JSON Engine'],
        ['Total Chapter Count', '100 Complete Technical Chapters Across 10 Thematic Modules'],
      ]
    ),
    pageBreak()
  );

  // Table of Contents Overview
  elements.push(
    h1('Master Table of Contents: 100 Technical Chapters'),
    p(
      'This synopsis contains exactly 100 sequentially numbered chapters divided into 10 thematic enterprise modules. Each chapter represents a dedicated architectural, operational, or mathematical domain within the ExpressCart India platform.'
    ),
    table(
      ['Module Range', 'Thematic Area', 'Chapters Included', 'Target Audience'],
      [
        ['Module 01', 'Vision, Indian Retail Economics & The SilvyOS Thesis', 'Chapters 01 – 10', 'Investors, Board & Retail CEOs'],
        ['Module 02', 'System Requirements Specification & Edge Constraints', 'Chapters 11 – 20', 'Product Managers & Systems Engineers'],
        ['Module 03', 'Client Architecture, Expo Stack & UI Engineering', 'Chapters 21 – 30', 'Frontend Architects & Mobile Leads'],
        ['Module 04', 'State Management, Zustand Store & Local Offline Sync', 'Chapters 31 – 40', 'Software Engineers & State Architects'],
        ['Module 05', 'Handlebar Optical Scanning & Barcode Resolution', 'Chapters 41 – 50', 'Computer Vision & Mobile Engineers'],
        ['Module 06', 'Collaborative Family Multi-Cart Billing Engine', 'Chapters 51 – 60', 'POS & Consumer Experience Leads'],
        ['Module 07', 'Promotional Mathematics, BOGO & Indian GST Engine', 'Chapters 61 – 70', 'Finance, Merchandising & Tax Teams'],
        ['Module 08', '5-Layer Anti-Shrinkage, Weighbridge & Reverse Spot-Scan', 'Chapters 71 – 80', 'Loss Prevention & Security Directors'],
        ['Module 09', 'Store Staff Operations Portal (Gate + Inventory CRUD)', 'Chapters 81 – 90', 'Store Managers & Field Operations'],
        ['Module 10', 'Cloud Backend, PostgreSQL Schema, ERP Integration & Roadmap', 'Chapters 91 – 100', 'Enterprise Architects, ERP IT & CFOs'],
      ]
    ),
    pageBreak()
  );

  // Render each of the 100 chapters on its own dedicated full page
  for (let i = 0; i < chapters.length; i++) {
    const ch = chapters[i];
    elements.push(
      h1(`Chapter ${String(ch.number).padStart(2, '0')}: ${ch.title}`),
      p(
        `Category: ${ch.category} | Architectural Classification: Enterprise Production Specification`
      ),
      callout(`CHAPTER ${String(ch.number).padStart(2, '0')} EXECUTIVE OVERVIEW`, ch.summary)
    );

    for (const sub of ch.subsections) {
      elements.push(h2(sub.title));
      for (const para of sub.paragraphs) {
        elements.push(p(para));
      }
      if (sub.bullets && sub.bullets.length > 0) {
        for (const b of sub.bullets) {
          elements.push(bullet(b.label, b.text));
        }
      }
      if (sub.tableData) {
        elements.push(table(sub.tableData.headers, sub.tableData.rows));
      }
      if (sub.codeSnippet) {
        elements.push(codeBlock(sub.codeSnippet));
      }
      if (sub.calloutBox) {
        elements.push(callout(sub.calloutBox.title, sub.calloutBox.text));
      }
    }

    // Every chapter ends with an explicit page break to guarantee full-page length
    if (i < chapters.length - 1) {
      elements.push(pageBreak());
    }
  }

  const doc = new Document({
    creator: 'Priyanshu Kottapalli — SilvyOS',
    title: 'ExpressCart India — 100-Page Master Technical Synopsis',
    description: '100-Page Complete Master Technical Synopsis & System Requirements Specification for Investors and Enterprise Retail Partners',
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 800,
              right: 800,
              bottom: 800,
              left: 800,
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: 'SILVYOS · EXPRESSCART INDIA 100-PAGE MASTER TECHNICAL SYNOPSIS   |   FOUNDER: PRIYANSHU KOTTAPALLI',
                    size: 14,
                    color: COLORS.muted,
                    font: 'Calibri',
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: 'SilvyOS Enterprise Retail Technologies · Page ',
                    size: 16,
                    color: COLORS.muted,
                    font: 'Calibri',
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: 16,
                    bold: true,
                    color: COLORS.dark,
                    font: 'Calibri',
                  }),
                  new TextRun({
                    text: ' of ',
                    size: 16,
                    color: COLORS.muted,
                    font: 'Calibri',
                  }),
                  new TextRun({
                    children: [PageNumber.TOTAL_PAGES],
                    size: 16,
                    bold: true,
                    color: COLORS.dark,
                    font: 'Calibri',
                  }),
                ],
              }),
            ],
          }),
        },
        children: elements,
      },
    ],
  });

  const outPath = path.join(OUT_DIR, 'ExpressCart_India_Master_Synopsis_SilvyOS.docx');
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(outPath, buffer as any);
  console.log(`Generated 100-Page Master Synopsis: ${outPath} (${(buffer.length / 1024).toFixed(1)} KB)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
