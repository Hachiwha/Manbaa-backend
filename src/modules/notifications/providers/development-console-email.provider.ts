import { Injectable, Logger } from '@nestjs/common'; import { EmailMessage,EmailProvider } from './email.provider';
@Injectable() export class DevelopmentConsoleEmailProvider implements EmailProvider { private readonly logger=new Logger(DevelopmentConsoleEmailProvider.name); async send(input:EmailMessage){ this.logger.log({to:input.to,subject:input.subject},'Development email accepted'); } }
