import { describe, it, expect } from 'vitest';
import { moderateText, moderationMessage, displayTerm } from '@/lib/moodstamps/moderation';

function categories(text: string): string[] {
  return moderateText(text).hits.map((hit) => hit.category);
}

describe('MoodStamp language checks — what they catch', () => {
  it.each([
    ['What the fuck were you thinking', 'profanity'],
    ['This is bullshit', 'profanity'],
    ['Stop being a bitch about it', 'profanity'],
    ['You absolute asshole', 'profanity'],
    ['Damn, that hurt', 'profanity'],
    ['wtf was that', 'profanity'],
    ['I was so pissed', 'profanity'],
    ['You are a total shithead', 'profanity'],
  ])('swearing: %s', (text, category) => {
    expect(categories(text)).toContain(category);
  });

  it.each([
    ['f*ck this', 'profanity'],
    ['sh!t happens', 'profanity'],
    ['sh1t', 'profanity'],
    ['a$$', 'profanity'],
    ['@ss', 'profanity'],
    ['b***h', 'profanity'],
    ['f.u.c.k', 'profanity'],
    ['f u c k you', 'profanity'],
    ['fuuuuuck', 'profanity'],
    ['FUCK', 'profanity'],
    ['fùck', 'profanity'],
    ['go fuckyourself', 'profanity'],
    ['fu ck off', 'profanity'],
    ['what a fuckwit', 'profanity'],
    ['b1tch', 'profanity'],
    ['idiooooot', 'insult'],
  ])('disguised: %s', (text, category) => {
    expect(categories(text)).toContain(category);
  });

  it.each([
    ['bhenchod', 'profanity'],
    ['Madarchod', 'profanity'],
    ['tu chutiya hai', 'profanity'],
    ['gandu', 'profanity'],
    ['bsdk', 'profanity'],
    ['kamina', 'insult'],
    ['harami insaan', 'insult'],
    ['ullu ka pattha', 'insult'],
  ])('Hindi and Hinglish: %s', (text, category) => {
    expect(categories(text)).toContain(category);
  });

  it.each([
    ['send nudes', 'sexual'],
    ['you look sexy', 'sexual'],
    ['I am so horny', 'sexual'],
    ['want to sleep with you', 'sexual'],
    ['watching porn at work', 'sexual'],
    ['p0rn', 'sexual'],
    ['what a slut', 'sexual'],
    ['suck my toes', 'sexual'],
  ])('sexual and 18+: %s', (text, category) => {
    expect(categories(text)).toContain(category);
  });

  it.each([
    ['you retard', 'hate'],
    ['faggot', 'hate'],
    ['n1gger', 'hate'],
  ])('slurs: %s', (text, category) => {
    expect(categories(text)).toContain(category);
  });

  it.each([
    ['You idiot', 'insult'],
    ['such a moron', 'insult'],
    ['you are useless', 'insult'],
    ["You're so stupid", 'insult'],
    ['you r dumb', 'insult'],
    ['u r pathetic', 'insult'],
    ['you are such a joke', 'insult'],
    ['you were being lazy', 'insult'],
    ['you clown', 'insult'],
    ['shut up', 'insult'],
    ['nobody likes you', 'insult'],
    ['you are a waste of space', 'insult'],
    ['go to hell', 'insult'],
    ['I hate you', 'insult'],
  ])('insults: %s', (text, category) => {
    expect(categories(text)).toContain(category);
  });

  it.each([
    ['I will kill you', 'threat'],
    ['kill yourself', 'threat'],
    ['kys', 'threat'],
    ['hope you die', 'threat'],
    ['watch your back', 'threat'],
    ['drop dead', 'threat'],
  ])('threats: %s', (text, category) => {
    expect(categories(text)).toContain(category);
  });
});

describe('MoodStamp language checks — body-shaming', () => {
  it.each([
    'Proud of you on becoming the fattest and ugliest kid in class',
    'Gives me immense pleassure to declare you as the fattest kid',
    'You fatso',
    'Look at that ugly face',
    'You are too fat to play',
  ])('%s', (text) => {
    expect(categories(text)).toContain('insult');
  });

  it.each([
    'This was the fattest bonus the team ever got.',
    'The ugliest bug in the codebase is finally fixed.',
    'The fat margin on that deal paid for the offsite.',
  ])('leaves alone: %s', (text) => {
    expect(moderateText(text).clean).toBe(true);
  });
});

describe('MoodStamp language checks — what they leave alone', () => {
  it.each([
    'You changed the project deadline without informing the team.',
    'I had to cancel other plans and work late.',
    'Please communicate changes before they are finalized.',
    'You stayed late to help me finish the presentation.',
    'Your effort did not go unnoticed. Thank you.',
    'The class was great and the assessment was fair.',
    'We had cocktails and grapes at the Scunthorpe office.',
    'My therapist helped me pass the assignment.',
    'That was a hell of a job.',
    'It was a useless meeting and a stupid mistake.',
    'You wasted my afternoon.',
    'Shut the door on your way out next time.',
    'I got lost in the details.',
    'You broke your promise.',
    'You blow me away every single time.',
    'I never wanted to hurt you.',
    'There is a chink in the armour.',
    'It was a knee-jerk reaction.',
    'She graduated summa cum laude.',
    'You are amazing, and you were so kind.',
    'You look tired — please rest.',
    'I felt frustrated, fed up and angry.',
    'Chodo yaar, let it go.',
    'We sent 45 Medals and 12 Rotten Eggs.',
    'Sussex, Essex, Middlesex and Dickens.',
    'fire retardant',
    'Randi from accounts',
    'Brb, because it was bc of the delay',
    'Assess the cockpit and the peacock.',
    'Honestly, my 2nd attempt went better.',
    '',
  ])('clean: %s', (text) => {
    expect(moderateText(text).hits).toEqual([]);
  });
});

describe('MoodStamp language messages', () => {
  it('masks swearing when showing it back, but shows an insult as written', () => {
    const swearing = moderateText('fuck');
    expect(displayTerm(swearing.hits[0])).toBe('f•••');

    const insult = moderateText('you are useless');
    expect(displayTerm(insult.hits[0])).toBe("you're useless");
  });

  it('explains what was found and what to do instead', () => {
    expect(moderationMessage(moderateText('you idiot'))).toMatch(/personal insult.*Describe what happened/);
    expect(moderationMessage(moderateText('I will kill you'))).toMatch(/threat/);
    expect(moderationMessage(moderateText('all good'))).toBeNull();
  });
});
