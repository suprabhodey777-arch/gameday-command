import { describe, expect, it } from 'vitest';
import { makeTestMap } from '../../world/src/test-map.ts';
import { parseUtterance } from './voice-intents.ts';
import { rephrase } from './voice-rephrase.ts';

const map = makeTestMap();
/** What the box would show to confirm, or the kind of thing it heard. */
const heard = (text: string) => {
  const u = parseUtterance(text, map);
  if (u.type === 'order') return u.parsed.ok ? u.parsed.summary : `not understood: ${u.parsed.error}`;
  if (u.type === 'question') return `question ${u.question.kind}`;
  if (u.type === 'control') return `control ${u.control.kind}${'view' in u.control ? ` ${u.control.view}` : ''}`;
  return u.type;
};

describe('everyday speech', () => {
  it('understands officers asked for in many ways', () => {
    for (const t of [
      'can you get some backup over to gate two',
      'gate 2 needs backup',
      'we need more cops at gate 2 please',
      'station four officers at gate 2',
      'get a few officers down to gate 2 right now',
      'backup to gate 2',
      'hey dispatch 3 units to gate to',
      'put a couple of guys on gate 2',
      'we need some backup over at gate two right now',
      'i want more officers down by gate 2',
    ]) {
      expect(heard(t), t).toMatch(/^Send \d+ officers? to Gate 2, now$/);
    }
    expect(heard('station four officers at gate 2')).toBe('Send 4 officers to Gate 2, now');
    expect(heard('put a couple of guys on gate 2')).toBe('Send 2 officers to Gate 2, now');
    expect(heard('get a few officers down to gate 2 right now')).toBe('Send 3 officers to Gate 2, now');
  });

  it('understands closing and opening however it is said', () => {
    expect(heard('shut down gate 3')).toBe('Close Gate 3, now');
    expect(heard('lock gate three down')).toBe('Close Gate 3, now');
    expect(heard('dont let anyone through gate 3')).toBe('Close Gate 3, now');
    expect(heard('put up barricades on plaza lane')).toBe('Close Plaza lane, now');
    expect(heard('cordon off the plaza lane')).toBe('Close Plaza lane, now');
    expect(heard('let people back in at gate 3')).toBe('Open Gate 3, now');
    expect(heard('take down the barricades on plaza lane')).toBe('Open Plaza lane, now');
    expect(heard('could you open up gate 1 for me')).toBe('Open Gate 1, now');
  });

  it('understands moving the crowd', () => {
    expect(heard('move people from gate 1 to gate 3')).toBe('Redirect fans from Gate 1 to Gate 3, now');
    expect(heard('tell fans at gate 2 to use gate 1')).toBe('Redirect fans from Gate 2 to Gate 1, now');
    expect(heard('use gate 3 instead of gate 2')).toBe('Redirect fans from Gate 2 to Gate 3, now');
    expect(heard('gate 2 is packed, send them to gate 1')).toBe('Redirect fans from Gate 2 to Gate 1, now');
  });

  it('understands announcements and keeps the words', () => {
    expect(heard('tell everyone to use the west gates')).toBe('PA announcement: “Use the west gates”, now');
    expect(heard('make an announcement saying gate 2 is closed')).toBe('PA announcement: “Gate 2 is closed”, now');
    expect(heard('text everyone that the game is delayed')).toBe('Phone alert: “The game is delayed”, now');
    expect(heard('get everyone inside')).toBe('Order everyone to shelter, now');
  });

  it('understands questions and controls in plain words', () => {
    expect(heard('hows gate 2 looking')).toBe('question gate');
    expect(heard('any problems right now')).toBe('question congested');
    expect(heard('what should i worry about')).toBe('question congested');
    expect(heard('how many cops do we have left')).toBe('question free_officers');
    expect(heard('whats going on')).toBe('question status');
    expect(heard('give me a sitrep')).toBe('question status');
    expect(heard('lets go')).toBe('control play');
    expect(heard('hold on')).toBe('control pause');
    expect(heard('fast forward')).toBe('control speed');
    expect(heard('overhead view')).toBe('control view plan');
  });

  it('forgives misheard words', () => {
    expect(heard('close gait 3')).toBe('Close Gate 3, now');
    expect(heard('close kate 3')).toBe('Close Gate 3, now');
    expect(heard('send 2 offices to gate 1')).toBe('Send 2 officers to Gate 1, now');
    expect(heard('close the plaza lain')).toBe('Close Plaza lane, now');
    expect(heard('send 2 officers to the north concorse')).toBe('Send 2 officers to North concourse, now');
  });

  it('still refuses what names nothing, and leaves commands it already knew alone', () => {
    expect(heard('close the moon')).toMatch(/^not understood/);
    expect(heard('make me a sandwich')).toMatch(/^not understood/);
    expect(rephrase('close gate 3')).toBe('close gate 3');
    expect(heard('close gate 3 on plan b')).toBe('Close Gate 3, now');
  });
});
