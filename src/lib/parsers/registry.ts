import type { FactoryParser } from './types';
import { hatParser } from './hat';
import { mgParser } from './mg';
import { darranParser } from './darran';
import { symphonyParser } from './symphony';
import { carnegieParser } from './carnegie';
import { witParser } from './wit';

const parsers: FactoryParser[] = [hatParser, mgParser, darranParser, symphonyParser, carnegieParser, witParser];

export function getParserByKey(factoryKey: string): FactoryParser | null {
  return parsers.find((p) => p.factoryKey === factoryKey) || null;
}

export function autoDetectParser(filename: string, headers?: string[]): FactoryParser | null {
  for (const parser of parsers) {
    if (parser.detect(filename, headers)) return parser;
  }
  return null;
}

export function getAllParsers(): FactoryParser[] {
  return [...parsers];
}
