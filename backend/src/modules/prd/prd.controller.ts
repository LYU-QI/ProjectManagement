import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UploadedFile,
  UseInterceptors
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Roles } from '../auth/roles.decorator';
import { PrdService } from './prd.service';
import { ComparePrdDto, CreatePrdDocumentDto, ListPrdDocumentsQueryDto } from './prd.dto';

@Controller('api/v1/prd')
export class PrdController {
  constructor(private readonly prdService: PrdService) {}

  @Get('documents')
  async listDocuments(@Query() query: ListPrdDocumentsQueryDto) {
    return this.prdService.listDocuments(query.projectId ? Number(query.projectId) : undefined);
  }

  @Post('documents')
  @Roles('pm', 'lead')
  async createDocument(@Body() body: CreatePrdDocumentDto) {
    return this.prdService.createDocument(Number(body.projectId), body.title);
  }

  @Get('documents/:documentId/versions')
  async listVersions(@Param('documentId', ParseIntPipe) documentId: number) {
    return this.prdService.listVersions(documentId);
  }

  @Post('documents/:documentId/versions')
  @Roles('pm', 'lead')
  @UseInterceptors(FileInterceptor('file'))
  async uploadVersion(
    @Param('documentId', ParseIntPipe) documentId: number,
    @UploadedFile() file: Express.Multer.File,
    @Body('versionLabel') versionLabel?: string
  ) {
    return this.prdService.uploadVersion(documentId, file, versionLabel);
  }

  @Post('compare')
  async compare(@Body() body: ComparePrdDto) {
    return this.prdService.compareVersions(Number(body.leftVersionId), Number(body.rightVersionId));
  }
}
