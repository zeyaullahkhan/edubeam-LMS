import { Module } from '@nestjs/common';
import { StudentsService } from './students.service';
import { StudentsController } from './students.controller';
import { StaffService } from './staff.service';
import { StaffController } from './staff.controller';

@Module({
  providers: [StudentsService, StaffService],
  controllers: [StudentsController, StaffController],
})
export class PeopleModule {}
