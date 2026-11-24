import { describe, expect, it } from 'vitest';
import { readCollapsed, sectionKey } from './topicSections';

describe('sectionKey', () => {
  it('names a section by its topic, so two topics can share an id', () => {
    expect(sectionKey('logic', 'flags')).toBe('logic.flags');
    expect(sectionKey('numbers', 'flags')).not.toBe(sectionKey('logic', 'flags'));
  });
});

describe('readCollapsed', () => {
  it('reads the stored sections', () => {
    expect(readCollapsed('["logic.flags","logic.gate"]')).toEqual(['logic.flags', 'logic.gate']);
  });

  it('drops what is not a name, and a name stored twice', () => {
    expect(readCollapsed('["logic.flags",3,null,"logic.flags"]')).toEqual(['logic.flags']);
  });

  it('reads anything else as nothing collapsed', () => {
    expect(readCollapsed('not json')).toEqual([]);
    expect(readCollapsed('{"logic.flags":true}')).toEqual([]);
    expect(readCollapsed('null')).toEqual([]);
  });
});
