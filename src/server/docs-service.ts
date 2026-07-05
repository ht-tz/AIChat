import fs from "fs";
import path from "path";

export interface DocItem {
  slug: string;
  title: string;
  shortTitle: string;
  category: "learning" | "requirements" | "handoff";
  categoryLabel: string;
  milestone?: string;
  labelType?: "tech" | "milestone" | "numbered" | "other";
  filePath: string;
}

export interface DocCategory {
  key: "learning" | "requirements" | "handoff";
  label: string;
  docs: DocItem[];
}

const DOCS_ROOT = path.join(process.cwd(), "docs");

const CATEGORIES: Array<{ key: DocItem["category"]; label: string; dir: string }> = [
  { key: "requirements", label: "需求文档", dir: "requirements" },
  { key: "learning", label: "学习文档", dir: "learning" },
  { key: "handoff", label: "交接文档", dir: "handoff" },
];

function extractTitle(content: string, fallback: string): string {
  const match = content.match(/^#\s+(.+)$/m);
  if (match) {
    return match[1].trim();
  }
  return fallback.replace(/\.md$/, "");
}

function extractShortTitle(fullTitle: string, filename: string): string {
  let t = fullTitle;
  t = t.replace(/^M\d+(\s*[-–—~]\s*M?\d+)?\s*[·•:：]\s*/i, "");
  t = t.replace(/^T\d+\s*[·•:：]\s*/i, "");
  t = t.replace(/^\d+\s*[·•:：]\s*/, "");
  t = t.replace(/\s*[·•]\s*(学习文档|需求文档|交接文档)$/, "");
  t = t.replace(/\s*[—–-]+\s*(学习文档|需求文档|交接文档)$/, "");
  t = t.replace(/^M\d+(\s*[-–—~]\s*M?\d+)?[-:\s]+/i, "");
  t = t.replace(/^T\d+[-:\s]+/i, "");
  t = t.replace(/[-_]doc$/, "");
  if (t.includes(" · ")) {
    const parts = t.split(" · ");
    t = parts[0].trim() || parts[parts.length - 1].trim();
  }
  t = t.trim();
  if (!t || t.length < 2) {
    let name = filename.replace(/\.md$/, "");
    name = name.replace(/^[MT]\d+[-_]/i, "");
    name = name.replace(/^\d+[-_]/i, "");
    name = name.replace(/[-_]doc$/, "");
    return name || filename;
  }
  return t;
}

function extractMilestone(filename: string): {
  label?: string;
  labelType?: DocItem["labelType"];
  sortOrder: number;
} {
  const tMatch = filename.match(/^T(\d+)/i);
  if (tMatch) {
    return { label: `T${tMatch[1]}`, labelType: "tech", sortOrder: parseInt(tMatch[1]) };
  }
  const mMatch = filename.match(/^M(\d+)/i);
  if (mMatch) {
    return { label: `M${mMatch[1]}`, labelType: "milestone", sortOrder: 100 + parseInt(mMatch[1]) };
  }
  const numMatch = filename.match(/^(\d+)[-_]/);
  if (numMatch) {
    return { label: numMatch[1], labelType: "numbered", sortOrder: parseInt(numMatch[1]) - 1 };
  }
  return { sortOrder: 999 };
}

function scanDocs(): DocCategory[] {
  const categories: DocCategory[] = [];

  for (const cat of CATEGORIES) {
    const dirPath = path.join(DOCS_ROOT, cat.dir);
    if (!fs.existsSync(dirPath)) continue;

    const files = fs.readdirSync(dirPath).filter((f) => f.endsWith(".md") && !f.startsWith("_"));
    const docs: DocItem[] = files.map((file) => {
      const filePath = path.join(dirPath, file);
      const content = fs.readFileSync(filePath, "utf-8");
      const fullTitle = extractTitle(content, file);
      const slug = `${cat.key}/${file.replace(/\.md$/, "")}`;
      const { label, labelType, sortOrder: _ } = extractMilestone(file);
      return {
        slug,
        title: fullTitle,
        shortTitle: extractShortTitle(fullTitle, file),
        category: cat.key,
        categoryLabel: cat.label,
        milestone: label,
        labelType,
        filePath,
      };
    });

    docs.sort((a, b) => {
      const soA = extractMilestone(path.basename(a.filePath)).sortOrder;
      const soB = extractMilestone(path.basename(b.filePath)).sortOrder;
      if (soA !== soB) return soA - soB;
      return a.title.localeCompare(b.title);
    });

    if (docs.length > 0) {
      categories.push({ key: cat.key, label: cat.label, docs });
    }
  }

  const rootFiles = ["README.md", "issues.md", "progress.md"];
  const rootLabels: Record<string, string> = {
    "README.md": "项目文档中心",
    "issues.md": "开发问题记录（Issues Log）",
    "progress.md": "实时开发进度",
  };
  for (const f of rootFiles) {
    const fp = path.join(DOCS_ROOT, f);
    if (fs.existsSync(fp)) {
      const content = fs.readFileSync(fp, "utf-8");
      const fullTitle = extractTitle(content, f);
      const rootDoc: DocItem = {
        slug: `root/${f.replace(/\.md$/, "")}`,
        title: fullTitle,
        shortTitle: rootLabels[f] || extractShortTitle(fullTitle, f),
        category: "handoff",
        categoryLabel: "项目文档",
        filePath: fp,
      };
      let projectCat = categories.find((c) => c.key === "handoff");
      if (!projectCat) {
        projectCat = { key: "handoff", label: "项目文档", docs: [] };
        categories.push(projectCat);
      }
      projectCat.docs.unshift(rootDoc);
    }
  }

  return categories;
}

function getDocContent(slug: string): { content: string; doc: DocItem } | null {
  const categories = scanDocs();
  for (const cat of categories) {
    for (const doc of cat.docs) {
      if (doc.slug === slug) {
        const content = fs.readFileSync(doc.filePath, "utf-8");
        return { content, doc };
      }
    }
  }
  return null;
}

function getDefaultDoc(): DocItem | null {
  const categories = scanDocs();
  for (const cat of categories) {
    if (cat.docs.length > 0) {
      return cat.docs[0];
    }
  }
  return null;
}

export const docsService = {
  getCategories: scanDocs,
  getDocContent,
  getDefaultDoc,
};
