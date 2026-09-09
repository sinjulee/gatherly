import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";

const SOURCE_TYPES = [
  "PROJECT_OVERVIEW",
  "FIELD_NOTES",
  "PHOTO_EVIDENCE",
  "MEDIA_INDEX",
  "SOURCE_INDEX",
] as const;

type SourceType = (typeof SOURCE_TYPES)[number];

function safeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9가-힣._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "project";
}

function checksum(content: string) {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

function line(value?: string | null) {
  return value?.trim() || "-";
}

export async function buildNotebookLmSources(sourceBundleId: string) {
  const bundle = await prisma.sourceBundle.findUnique({
    where: { id: sourceBundleId },
    include: {
      fieldDay: true,
      items: {
        where: { included: true },
        orderBy: { sortOrder: "asc" },
        include: { material: true },
      },
    },
  });

  if (!bundle) throw new Error("SOURCE_BUNDLE_NOT_FOUND");
  if (!bundle.items.length) throw new Error("SOURCE_BUNDLE_EMPTY");

  const root = path.resolve(process.env.RESEARCH_SOURCE_ROOT || "storage/research-sources");
  const projectDir = `${safeSegment(bundle.fieldDay.title)}-${bundle.fieldDayId.slice(0, 8)}`;
  const versionDir = `v${bundle.version}`;
  const outputDir = path.join(root, projectDir, versionDir);
  await mkdir(outputDir, { recursive: true });

  const textMaterials = bundle.items.filter(({ material }) => material.type === "TEXT");
  const images = bundle.items.filter(({ material }) => material.type === "IMAGE");
  const media = bundle.items.filter(({ material }) => ["VIDEO", "AUDIO"].includes(material.type));

  const projectOverview = `# Project Overview\n\n- Project: ${bundle.fieldDay.title}\n- Location: ${line(bundle.fieldDay.location)}\n- Field date: ${bundle.fieldDay.fieldDate.toISOString()}\n- Source bundle: v${bundle.version}\n- Evidence count: ${bundle.items.length}\n\n## Project description\n\n${line(bundle.fieldDay.description)}\n\n## Research handling note\n\nThis source package was curated in Gatherly. Evidence IDs are preserved so findings can be traced back to original field materials.\n`;

  const fieldNotes = `# Field Notes\n\n${textMaterials.length ? textMaterials.map(({ material }, index) => `## ${index + 1}. ${material.title}\n\n- Evidence ID: ${material.id}\n- Captured: ${(material.capturedAt || material.createdAt).toISOString()}\n- Important: ${material.isImportant ? "yes" : "no"}\n\n${line(material.content || material.description)}\n`).join("\n") : "No text notes were selected for this bundle.\n"}`;

  const photoEvidence = `# Photo Evidence\n\n${images.length ? images.map(({ material }, index) => `## Photo ${index + 1}: ${material.title}\n\n- Evidence ID: ${material.id}\n- Captured: ${(material.capturedAt || material.createdAt).toISOString()}\n- Original file: ${line(material.originalName)}\n- MIME: ${line(material.mimeType)}\n- SHA-256: ${line(material.sha256)}\n- Important: ${material.isImportant ? "yes" : "no"}\n- Gatherly local asset: ${line(material.relativePath)}\n\n${line(material.description || material.content)}\n`).join("\n") : "No photo evidence was selected for this bundle.\n"}`;

  const mediaIndex = `# Audio and Video Evidence\n\n${media.length ? media.map(({ material }, index) => `## ${index + 1}. ${material.title}\n\n- Evidence ID: ${material.id}\n- Type: ${material.type}\n- Captured: ${(material.capturedAt || material.createdAt).toISOString()}\n- Original file: ${line(material.originalName)}\n- MIME: ${line(material.mimeType)}\n- SHA-256: ${line(material.sha256)}\n- Gatherly local asset: ${line(material.relativePath)}\n\n${line(material.description || material.content)}\n`).join("\n") : "No audio/video evidence was selected for this bundle.\n"}`;

  const sourceIndex = `# Source Index\n\n| # | Evidence ID | Type | Title | Important | Status |\n|---:|---|---|---|---|---|\n${bundle.items.map(({ material }, index) => `| ${index + 1} | ${material.id} | ${material.type} | ${material.title.replace(/\|/g, "\\|")} | ${material.isImportant ? "yes" : "no"} | ${material.reviewStatus} |`).join("\n")}\n\n## Lineage\n\nGatherly Project → Source Bundle v${bundle.version} → Source Documents → NotebookLM → Research Result\n`;

  const documents: Record<SourceType, string> = {
    PROJECT_OVERVIEW: projectOverview,
    FIELD_NOTES: fieldNotes,
    PHOTO_EVIDENCE: photoEvidence,
    MEDIA_INDEX: mediaIndex,
    SOURCE_INDEX: sourceIndex,
  };

  const fileNames: Record<SourceType, string> = {
    PROJECT_OVERVIEW: "01_project_overview.md",
    FIELD_NOTES: "02_field_notes.md",
    PHOTO_EVIDENCE: "03_photo_evidence.md",
    MEDIA_INDEX: "04_media_index.md",
    SOURCE_INDEX: "05_source_index.md",
  };

  for (const type of SOURCE_TYPES) {
    const content = documents[type];
    const filePath = path.join(outputDir, fileNames[type]);
    await writeFile(filePath, content, "utf8");
    await prisma.sourceDocument.upsert({
      where: { sourceBundleId_documentType: { sourceBundleId: bundle.id, documentType: type } },
      create: {
        sourceBundleId: bundle.id,
        documentType: type,
        localPath: path.relative(process.cwd(), filePath),
        checksum: checksum(content),
        syncStatus: "PENDING",
      },
      update: {
        localPath: path.relative(process.cwd(), filePath),
        checksum: checksum(content),
        syncStatus: "PENDING",
        driveFileId: null,
        lastSyncedAt: null,
      },
    });
  }

  const manifest = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    fieldDayId: bundle.fieldDayId,
    sourceBundleId: bundle.id,
    sourceBundleVersion: bundle.version,
    projectTitle: bundle.fieldDay.title,
    evidenceCount: bundle.items.length,
    sourceDocuments: SOURCE_TYPES.map((type) => ({ type, fileName: fileNames[type], checksum: checksum(documents[type]) })),
  };
  await writeFile(path.join(outputDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");

  await prisma.sourceBundle.update({
    where: { id: bundle.id },
    data: { status: "BUILT", manifestJson: JSON.stringify(manifest) },
  });

  return { bundleId: bundle.id, version: bundle.version, outputDir: path.relative(process.cwd(), outputDir), documentCount: SOURCE_TYPES.length, manifest };
}
