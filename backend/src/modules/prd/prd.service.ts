import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { createHash, randomUUID } from 'crypto';
import { mkdirSync, writeFileSync } from 'fs';
import { extname, resolve } from 'path';
import * as mammoth from 'mammoth';
import { diffArrays, diffWords } from 'diff';
const pdfParseModule = require('pdf-parse');
async function parsePdfBuffer(buffer: Buffer) {
  if (typeof pdfParseModule === 'function') {
    return pdfParseModule(buffer);
  }
  if (pdfParseModule?.default && typeof pdfParseModule.default === 'function') {
    return pdfParseModule.default(buffer);
  }
  if (pdfParseModule?.PDFParse) {
    const parser = new pdfParseModule.PDFParse({ data: buffer });
    const result = await parser.getText();
    if (parser.destroy) {
      await parser.destroy();
    }
    return { text: result?.text || '' };
  }
  throw new Error('pdf-parse module is not callable');
}

type InlineToken = { type: 'added' | 'removed' | 'same'; text: string };
type DiffBlock = { type: 'added' | 'removed' | 'same'; text: string } | { type: 'changed'; tokens: InlineToken[] };

@Injectable()
export class PrdService {
  constructor(private readonly prisma: PrismaService) {}

  async listDocuments(projectId?: number) {
    return this.prisma.prdDocument.findMany({
      where: projectId ? { projectId } : undefined,
      orderBy: { updatedAt: 'desc' }
    });
  }

  async createDocument(projectId: number, title: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new BadRequestException(`项目不存在: ${projectId}`);
    return this.prisma.prdDocument.create({
      data: { projectId, title }
    });
  }

  async listVersions(documentId: number) {
    return this.prisma.prdVersion.findMany({
      where: { documentId },
      orderBy: { createdAt: 'desc' }
    });
  }

  private getStorageDir() {
    return process.env.PRD_STORAGE_DIR
      ? resolve(process.env.PRD_STORAGE_DIR)
      : resolve(process.cwd(), 'uploads', 'prd');
  }

  private splitParagraphs(text: string) {
    return text
      .split(/\r?\n\s*\r?\n/)
      .map((p) => p.trim())
      .filter(Boolean);
  }

  private async extractText(buffer: Buffer, filename: string) {
    const lower = filename.toLowerCase();
    if (lower.endsWith('.docx')) {
      const result = await mammoth.extractRawText({ buffer });
      return result.value || '';
    }
    if (lower.endsWith('.pdf')) {
      const result = await parsePdfBuffer(buffer);
      return result.text || '';
    }
    throw new BadRequestException('不支持的文件格式，仅支持 .docx, .pdf');
  }

  async uploadVersion(documentId: number, file: Express.Multer.File, versionLabel?: string) {
    if (!file) throw new BadRequestException('缺少上传文件');
    const document = await this.prisma.prdDocument.findUnique({ where: { id: documentId } });
    if (!document) throw new BadRequestException(`PRD 不存在: ${documentId}`);

    const extracted = await this.extractText(file.buffer, file.originalname);
    const sanitized = extracted.replace(/\u0000/g, '');
    const hash = createHash('sha256').update(file.buffer).digest('hex');
    const ext = extname(file.originalname) || '';
    const storageRoot = this.getStorageDir();
    const fileNameSafe = `${Date.now()}-${randomUUID()}${ext}`;
    const absPath = resolve(storageRoot, String(documentId), fileNameSafe);
    mkdirSync(resolve(storageRoot, String(documentId)), { recursive: true });
    writeFileSync(absPath, file.buffer);

    let finalLabel = versionLabel?.trim() || null;
    if (!finalLabel) {
      const count = await this.prisma.prdVersion.count({ where: { documentId } });
      finalLabel = `V${count + 1}`;
    }

    return this.prisma.prdVersion.create({
      data: {
        documentId,
        versionLabel: finalLabel,
        fileName: file.originalname,
        mimeType: file.mimetype || null,
        fileSize: file.size,
        storagePath: absPath,
        contentText: sanitized,
        contentHash: hash
      }
    });
  }

  async compareVersions(leftVersionId: number, rightVersionId: number) {
    if (leftVersionId === rightVersionId) {
      throw new BadRequestException('请选择两个不同的版本进行对比');
    }

    const [left, right] = await Promise.all([
      this.prisma.prdVersion.findUnique({ where: { id: leftVersionId } }),
      this.prisma.prdVersion.findUnique({ where: { id: rightVersionId } })
    ]);

    if (!left || !right) {
      throw new BadRequestException('未找到待对比的 PRD 版本');
    }

    const leftParas = this.splitParagraphs(left.contentText || '');
    const rightParas = this.splitParagraphs(right.contentText || '');
    const diffs = diffArrays(leftParas, rightParas);

    const blocks: DiffBlock[] = [];
    let added = 0;
    let removed = 0;
    let same = 0;
    let changed = 0;

    for (let i = 0; i < diffs.length; i += 1) {
      const part = diffs[i];
      if (part.added) {
        added += part.value.length;
        part.value.forEach((text: string) => blocks.push({ type: 'added', text }));
      } else if (part.removed) {
        const next = diffs[i + 1];
        if (next && next.added) {
          const removedParas = part.value;
          const addedParas = next.value;
          const max = Math.max(removedParas.length, addedParas.length);
          for (let j = 0; j < max; j += 1) {
            const leftText = removedParas[j];
            const rightText = addedParas[j];
            if (leftText && rightText) {
              const tokens = diffWords(leftText, rightText).map((token: { added?: boolean; removed?: boolean; value: string }) => ({
                type: token.added ? 'added' : token.removed ? 'removed' : 'same',
                text: token.value
              })) as InlineToken[];
              blocks.push({ type: 'changed', tokens });
              changed += 1;
            } else if (leftText) {
              blocks.push({ type: 'removed', text: leftText });
              removed += 1;
            } else if (rightText) {
              blocks.push({ type: 'added', text: rightText });
              added += 1;
            }
          }
          i += 1;
        } else {
          removed += part.value.length;
          part.value.forEach((text: string) => blocks.push({ type: 'removed', text }));
        }
      } else {
        same += part.value.length;
        part.value.forEach((text: string) => blocks.push({ type: 'same', text }));
      }
    }

    const summary = `新增段落 ${added}，删除段落 ${removed}，修改段落 ${changed}，未变段落 ${same}`;

    return {
      leftVersion: left,
      rightVersion: right,
      summary,
      counts: { added, removed, changed, same },
      blocks
    };
  }
}
