import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Concept } from './entities/concept.entity';
import { ConceptsController } from './controllers/concepts.controller';
import { ConceptsService } from './services/concepts.service';
import { WorkspacesModule } from '../workspaces/workspaces.module';

@Module({
  imports: [TypeOrmModule.forFeature([Concept]), WorkspacesModule],
  controllers: [ConceptsController],
  providers: [ConceptsService],
  exports: [ConceptsService],
})
export class ConceptsModule {}
