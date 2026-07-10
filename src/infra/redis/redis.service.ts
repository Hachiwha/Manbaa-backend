import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';
@Injectable()
export class RedisService implements OnModuleInit,OnModuleDestroy {
  private readonly logger=new Logger(RedisService.name); readonly client:RedisClientType; readonly subscriber:RedisClientType; private readonly prefix:string;
  constructor(config:ConfigService){const url=config.getOrThrow<string>('redis.url');const timeout=config.get<number>('redis.connectTimeoutMs',5000);this.prefix=config.get<string>('redis.keyPrefix','platform:');const opts={url,socket:{connectTimeout:timeout,reconnectStrategy:(retries:number)=>Math.min(5000,100*2**Math.min(retries,6))}};this.client=createClient(opts) as RedisClientType;this.subscriber=this.client.duplicate() as RedisClientType;this.client.on('error',e=>this.logger.error(`Redis: ${e.message}`));this.subscriber.on('error',e=>this.logger.error(`Redis subscriber: ${e.message}`))}
  async onModuleInit(){await Promise.all([this.client.connect(),this.subscriber.connect()])} async onModuleDestroy(){await Promise.allSettled([this.client.quit(),this.subscriber.quit()])}
  key(namespace:string,id:string){return `${this.prefix}${namespace}:${id}`}
  async health(){const started=Date.now();const pong=await this.client.ping();return{status:pong==='PONG'?'up':'down',latency_ms:Date.now()-started}}
  async markOnce(namespace:string,id:string,ttlSeconds:number){return(await this.client.set(this.key(namespace,id),'1',{NX:true,EX:ttlSeconds}))==='OK'}
  async acquireLock(name:string,owner:string,ttlMs:number){return(await this.client.set(this.key('lock',name),owner,{NX:true,PX:ttlMs}))==='OK'}
  async releaseLock(name:string,owner:string){const key=this.key('lock',name);await this.client.eval(`if redis.call('get',KEYS[1])==ARGV[1] then return redis.call('del',KEYS[1]) else return 0 end`,{keys:[key],arguments:[owner]})}
}
