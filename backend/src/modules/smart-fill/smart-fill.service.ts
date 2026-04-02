import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '../config/config.service';
import { PrismaService } from '../../database/prisma.service';

export interface RequirementResult {
  title: string;
  description: string;
  acceptanceCriteria: string[];
  priority: 'high' | 'medium' | 'low';
}

export interface WorkItemSuggestion {
  title: string;
  type: 'todo' | 'issue';
  estimatedHours: number;
  description: string;
}

@Injectable()
export class SmartFillService {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService
  ) {}

  async generateRequirement(brief: string, projectId?: number): Promise<RequirementResult> {
    if (!brief || brief.trim().length < 5) {
      throw new BadRequestException('需求描述至少需要5个字符');
    }

    const aiApiUrl = this.configService.getRawValue('AI_API_URL');
    const aiApiKey = this.configService.getRawValue('AI_API_KEY');
    const aiModel = this.configService.getRawValue('AI_MODEL');

    const prompt = `你是一个资深产品经理。用户给出了以下功能需求概要：
"${brief}"

请生成一个结构化的需求文档，包含：
- 需求标题（10字以内）
- 需求描述（50-100字）
- 验收标准（3-5条，每条用 - 开头）
- 优先级（high/medium/low）

请只返回JSON，不要包含其他文字，格式如下：
{
  "title": "标题",
  "description": "描述",
  "acceptanceCriteria": ["标准1", "标准2", "标准3"],
  "priority": "medium"
}`;

    if (!aiApiUrl || !aiApiKey || !aiModel) {
      return this.fallbackRequirement(brief);
    }

    try {
      const res = await fetch(aiApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${aiApiKey}`
        },
        body: JSON.stringify({
          model: aiModel,
          messages: [
            { role: 'system', content: '你是一个资深产品经理，擅长生成结构化的需求文档。' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.3
        })
      });

      if (!res.ok) {
        return this.fallbackRequirement(brief);
      }

      const data = await res.json() as any;
      const text = data?.choices?.[0]?.message?.content?.trim() || '';

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as RequirementResult;
        return {
          title: parsed.title || brief.slice(0, 10),
          description: parsed.description || brief,
          acceptanceCriteria: Array.isArray(parsed.acceptanceCriteria) ? parsed.acceptanceCriteria : [],
          priority: ['high', 'medium', 'low'].includes(parsed.priority) ? parsed.priority : 'medium'
        };
      }

      return this.fallbackRequirement(brief);
    } catch {
      return this.fallbackRequirement(brief);
    }
  }

  async generatePrd(requirementId: number): Promise<{ content: string; sections: string[] }> {
    const requirement = await this.prisma.requirement.findUnique({ where: { id: requirementId } });
    if (!requirement) throw new NotFoundException(`Requirement #${requirementId} not found`);

    const aiApiUrl = this.configService.getRawValue('AI_API_URL');
    const aiApiKey = this.configService.getRawValue('AI_API_KEY');
    const aiModel = this.configService.getRawValue('AI_MODEL');

    const prompt = `你是一个资深产品经理。基于以下需求文档，生成一份PRD文档内容：

需求标题：${requirement.title}
需求描述：${requirement.description}

请生成包含以下章节的PRD内容：
1. 背景与目标
2. 功能详细描述
3. 用户故事
4. 非功能性需求
5. 依赖与风险

请以Markdown格式返回。`;

    if (!aiApiUrl || !aiApiKey || !aiModel) {
      return {
        content: `# ${requirement.title}\n\n## 背景与目标\n\n${requirement.description}\n\n## 功能详细描述\n\n（请补充）\n\n## 用户故事\n\n（请补充）\n\n## 非功能性需求\n\n（请补充）\n\n## 依赖与风险\n\n（请补充）`,
        sections: ['背景与目标', '功能详细描述', '用户故事', '非功能性需求', '依赖与风险']
      };
    }

    try {
      const res = await fetch(aiApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${aiApiKey}`
        },
        body: JSON.stringify({
          model: aiModel,
          messages: [
            { role: 'system', content: '你是一个资深产品经理，擅长撰写专业的PRD文档。' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.3
        })
      });

      if (!res.ok) {
        throw new Error('AI API error');
      }

      const data = await res.json() as any;
      const content = data?.choices?.[0]?.message?.content?.trim() || '';

      return {
        content: content || `抱歉，AI 生成失败，请手动撰写。`,
        sections: ['背景与目标', '功能详细描述', '用户故事', '非功能性需求', '依赖与风险']
      };
    } catch {
      return {
        content: `# ${requirement.title}\n\n## 背景与目标\n\n${requirement.description}\n\n## 功能详细描述\n\n（请补充）\n\n## 用户故事\n\n（请补充）\n\n## 非功能性需求\n\n（请补充）\n\n## 依赖与风险\n\n（请补充）`,
        sections: ['背景与目标', '功能详细描述', '用户故事', '非功能性需求', '依赖与风险']
      };
    }
  }

  async suggestWorkItems(requirementId: number, projectId: number): Promise<WorkItemSuggestion[]> {
    const requirement = await this.prisma.requirement.findUnique({ where: { id: requirementId } });
    if (!requirement) throw new NotFoundException(`Requirement #${requirementId} not found`);

    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException(`Project #${projectId} not found`);

    const aiApiUrl = this.configService.getRawValue('AI_API_URL');
    const aiApiKey = this.configService.getRawValue('AI_API_KEY');
    const aiModel = this.configService.getRawValue('AI_MODEL');

    const prompt = `你是一个Scrum Master。用户需求如下：
"${requirement.description}"

项目名称：${project.name}
请拆分为5-10个工作项（WorkItem），每个包含：
- title: 工作项标题
- type: todo | issue
- estimatedHours: 预估工时（小时，数字）
- description: 简要说明

请只返回JSON数组，不要包含其他文字，格式如下：
[
  {"title": "标题1", "type": "todo", "estimatedHours": 8, "description": "描述"},
  {"title": "标题2", "type": "issue", "estimatedHours": 4, "description": "描述"}
]`;

    if (!aiApiUrl || !aiApiKey || !aiModel) {
      return this.fallbackWorkItems(requirement);
    }

    try {
      const res = await fetch(aiApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${aiApiKey}`
        },
        body: JSON.stringify({
          model: aiModel,
          messages: [
            { role: 'system', content: '你是一个Scrum Master，擅长将需求拆分为可执行的工作项。' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.3
        })
      });

      if (!res.ok) {
        return this.fallbackWorkItems(requirement);
      }

      const data = await res.json() as any;
      const text = data?.choices?.[0]?.message?.content?.trim() || '';

      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as WorkItemSuggestion[];
        return parsed.map((item) => ({
          title: item.title || '未命名工作项',
          type: item.type === 'issue' ? 'issue' : 'todo',
          estimatedHours: Number.isFinite(item.estimatedHours) ? Math.max(1, Math.round(item.estimatedHours)) : 8,
          description: item.description || ''
        }));
      }

      return this.fallbackWorkItems(requirement);
    } catch {
      return this.fallbackWorkItems(requirement);
    }
  }

  private fallbackRequirement(brief: string): RequirementResult {
    const title = brief.slice(0, 10);
    return {
      title,
      description: brief,
      acceptanceCriteria: [
        '功能可正常使用',
        '符合需求描述',
        '无严重bug'
      ],
      priority: 'medium'
    };
  }

  private fallbackWorkItems(requirement: { title: string; description: string }): WorkItemSuggestion[] {
    return [
      {
        title: `设计：${requirement.title}`,
        type: 'todo',
        estimatedHours: 4,
        description: '完成功能设计文档'
      },
      {
        title: `开发：${requirement.title}`,
        type: 'todo',
        estimatedHours: 16,
        description: '完成功能开发'
      },
      {
        title: `测试：${requirement.title}`,
        type: 'todo',
        estimatedHours: 8,
        description: '完成功能测试'
      }
    ];
  }
}
