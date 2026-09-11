/**
 * Sample content. Every organisation, product, club and film here is fictional
 * and exists only to demonstrate the product — no claims are made about real
 * people or companies.
 */

export interface SeedEntity {
  slug: string;
  name: string;
  description: string;
  category: string;
  /** Roughly how heavily this subject leans negative over its lifetime, 0–1. */
  eggBias: number;
  participants: number;
  /** Average reactions sent per participating person. */
  intensity: number;
}

export interface SeedFlashNews {
  slug: string;
  headline: string;
  summary: string;
  body: string;
  category: string;
  sourceLabel: string;
  entitySlugs: string[];
  hoursAgo: number;
  eggBias: number;
  participants: number;
  intensity: number;
}

export const SEED_ENTITIES: SeedEntity[] = [
  {
    slug: 'nimbus-fare',
    name: 'Nimbus Fare',
    description: 'Budget flight-booking app best known for the fees it finds after you have already picked a seat.',
    category: 'Technology',
    eggBias: 0.79,
    participants: 5200,
    intensity: 26,
  },
  {
    slug: 'vantablack-studios',
    name: 'Vantablack Studios',
    description: 'Independent game studio behind the Ashfall series. Ambitious release dates, complicated relationship with them.',
    category: 'Gaming',
    eggBias: 0.52,
    participants: 6100,
    intensity: 31,
  },
  {
    slug: 'harrow-united',
    name: 'Harrow United FC',
    description: 'Second-division football club with a loud away end and an ownership group that keeps testing it.',
    category: 'Sports',
    eggBias: 0.47,
    participants: 4800,
    intensity: 34,
  },
  {
    slug: 'riverline-collective',
    name: 'Riverline Collective',
    description: 'Student-run environmental group that keeps showing up on Saturday mornings with waders and bin bags.',
    category: 'Community',
    eggBias: 0.08,
    participants: 3400,
    intensity: 22,
  },
  {
    slug: 'ottermilk-coffee',
    name: 'Ottermilk Coffee',
    description: 'Neighbourhood coffee chain. Beloved for the late shift, argued about for everything else.',
    category: 'Business',
    eggBias: 0.42,
    participants: 2900,
    intensity: 19,
  },
  {
    slug: 'pellucid-motors',
    name: 'Pellucid Motors',
    description: 'Electric car maker that ships features over the air, including the ones nobody asked for.',
    category: 'Technology',
    eggBias: 0.61,
    participants: 5600,
    intensity: 28,
  },
  {
    slug: 'the-long-night-ii',
    name: 'The Long Night II',
    description: 'The sequel that spent four years in post-production and arrived with a nine-minute ovation and a cliffhanger.',
    category: 'Entertainment',
    eggBias: 0.38,
    participants: 7300,
    intensity: 24,
  },
  {
    slug: 'meridian-public-library',
    name: 'Meridian Public Library',
    description: 'City library system running on a budget that has not moved since 2016.',
    category: 'Culture',
    eggBias: 0.24,
    participants: 2100,
    intensity: 17,
  },
];

export const SEED_FLASH_NEWS: SeedFlashNews[] = [
  {
    slug: 'nimbus-fare-adds-seat-selection-fee',
    headline: 'Nimbus Fare adds a “seat selection convenience fee” to every booking',
    summary: 'The £14 charge appears after payment details are entered and applies even when no seat is selected.',
    body:
      'Nimbus Fare confirmed the fee applies to all fares booked through the app, including tickets where the traveller declines to choose a seat. The company described it as “a service charge covering seat allocation infrastructure”. Screenshots of the charge appearing at the final checkout step spread within hours.',
    category: 'Controversy',
    sourceLabel: 'Company statement',
    entitySlugs: ['nimbus-fare'],
    hoursAgo: 9,
    eggBias: 0.93,
    participants: 4900,
    intensity: 29,
  },
  {
    slug: 'nimbus-fare-reverses-the-fee',
    headline: 'Nimbus Fare reverses the seat fee four days later',
    summary: 'Refunds are automatic for anyone charged, and the company says the rollout “did not meet our own standard”.',
    body:
      'The reversal came with an unusually direct note from the company: the fee is gone, refunds are automatic, and no reinstatement is planned. Whether the crowd counts this as a win or as damage control is exactly what the counters are for.',
    category: 'Business',
    sourceLabel: 'Company statement',
    entitySlugs: ['nimbus-fare'],
    hoursAgo: 3,
    eggBias: 0.34,
    participants: 3800,
    intensity: 21,
  },
  {
    slug: 'vantablack-delays-ashfall-eleven-months',
    headline: 'Vantablack Studios delays Ashfall by eleven months',
    summary: 'The studio pushed the release to next autumn, citing the scope of the rebuilt combat system.',
    body:
      'Pre-orders remain open and are fully refundable. The studio published a fourteen-minute breakdown of what the extra year buys, which is either reassuring or infuriating depending on how long you have already waited.',
    category: 'Gaming',
    sourceLabel: 'Developer update',
    entitySlugs: ['vantablack-studios'],
    hoursAgo: 20,
    eggBias: 0.58,
    participants: 5400,
    intensity: 33,
  },
  {
    slug: 'vantablack-ends-mandatory-crunch',
    headline: 'Vantablack Studios ends mandatory crunch and back-pays the overtime',
    summary: 'A published studio policy caps the working week and pays out eighteen months of unlogged overtime.',
    body:
      'The policy is public, dated and specific, which is more than most such announcements manage. Staff confirmed the back-pay landed before the announcement went out.',
    category: 'Gaming',
    sourceLabel: 'Studio policy',
    entitySlugs: ['vantablack-studios'],
    hoursAgo: 32,
    eggBias: 0.07,
    participants: 4100,
    intensity: 25,
  },
  {
    slug: 'harrow-united-raises-season-tickets',
    headline: 'Harrow United raises season tickets 34% after promotion',
    summary: 'The cheapest adult seat moves from £310 to £415. The concession band is removed entirely.',
    body:
      'The club pointed to promotion costs and squad investment. The supporters trust pointed to the removed concession band, which covered roughly four thousand seats last season.',
    category: 'Sports',
    sourceLabel: 'Club announcement',
    entitySlugs: ['harrow-united'],
    hoursAgo: 46,
    eggBias: 0.88,
    participants: 4400,
    intensity: 30,
  },
  {
    slug: 'harrow-united-four-goal-comeback',
    headline: 'Harrow United come back from four down to win the derby',
    summary: 'Nothing about the first half suggested this was possible. The fourth goal arrived in the 96th minute.',
    body:
      'A result that will be described in that away end for a decade. The club opened the training ground gates the next morning and roughly two thousand people turned up.',
    category: 'Sports',
    sourceLabel: 'Match report',
    entitySlugs: ['harrow-united'],
    hoursAgo: 14,
    eggBias: 0.05,
    participants: 6800,
    intensity: 38,
  },
  {
    slug: 'riverline-clears-nine-tonnes',
    headline: 'Riverline Collective pulls nine tonnes of waste out of the Meade',
    summary: 'Four hundred volunteers, one weekend, and a stretch of river that has not been walkable since 2011.',
    body:
      'The group published a full weight breakdown and the disposal receipts, which is not something volunteer clean-ups usually bother to do. The council has since agreed to fund the skips.',
    category: 'Good News',
    sourceLabel: 'Volunteer report',
    entitySlugs: ['riverline-collective'],
    hoursAgo: 27,
    eggBias: 0.03,
    participants: 3900,
    intensity: 23,
  },
  {
    slug: 'riverline-opens-free-night-school',
    headline: 'Riverline Collective opens a free night school above a launderette',
    summary: 'Three evenings a week, no enrolment fee, no attendance requirement, tea included.',
    body:
      'The syllabus is unglamorous and useful: maths, written English, and how to read a tenancy agreement. Sixty people came the first week.',
    category: 'Good News',
    sourceLabel: 'Community notice',
    entitySlugs: ['riverline-collective'],
    hoursAgo: 61,
    eggBias: 0.04,
    participants: 2800,
    intensity: 20,
  },
  {
    slug: 'ottermilk-feeds-stranded-travellers',
    headline: 'Ottermilk Coffee stays open all night for stranded travellers',
    summary: 'Two hundred people slept in a coffee shop during the storm closure. Nobody was charged.',
    body:
      'Staff volunteered the shift and the company paid triple time without being asked to. The shop reopened at six the next morning as usual.',
    category: 'Good News',
    sourceLabel: 'Local reporting',
    entitySlugs: ['ottermilk-coffee'],
    hoursAgo: 8,
    eggBias: 0.04,
    participants: 5100,
    intensity: 27,
  },
  {
    slug: 'ottermilk-goes-kiosk-only',
    headline: 'Ottermilk Coffee converts 60 shops to kiosk-only, cutting 340 jobs',
    summary: 'The company says affected staff are being offered roles “where available”, which is the part people noticed.',
    body:
      'The conversion removes the counter entirely in the affected locations. The company has not said how many of the 340 roles have an available equivalent nearby.',
    category: 'Business',
    sourceLabel: 'Company statement',
    entitySlugs: ['ottermilk-coffee'],
    hoursAgo: 38,
    eggBias: 0.86,
    participants: 3300,
    intensity: 24,
  },
  {
    slug: 'pellucid-update-cuts-range',
    headline: 'Pellucid Motors ships an overnight update that cuts range 12%',
    summary: 'Owners woke to a shorter range and a changelog that did not mention it.',
    body:
      'The company later described the change as “battery longevity protection”. Owners have asked for an opt-out; there is not one yet.',
    category: 'Technology',
    sourceLabel: 'Owner reports',
    entitySlugs: ['pellucid-motors'],
    hoursAgo: 6,
    eggBias: 0.91,
    participants: 5900,
    intensity: 32,
  },
  {
    slug: 'pellucid-opens-charging-patents',
    headline: 'Pellucid Motors opens its charging patents to every manufacturer',
    summary: 'No licence fee, no exclusivity window, and the connector spec is published in full.',
    body:
      'Three competitors confirmed they will adopt the connector. It is the kind of move that makes the next fee announcement harder to swallow, and the crowd is currently holding both thoughts at once.',
    category: 'Technology',
    sourceLabel: 'Company statement',
    entitySlugs: ['pellucid-motors'],
    hoursAgo: 52,
    eggBias: 0.12,
    participants: 4600,
    intensity: 22,
  },
  {
    slug: 'long-night-ii-nine-minute-ovation',
    headline: 'The Long Night II gets a nine-minute standing ovation at its premiere',
    summary: 'Four years in post-production, and the room did not sit down.',
    body:
      'Early reactions are unusually consistent for a sequel this delayed. Whether that survives contact with a wider audience is the interesting part.',
    category: 'Entertainment',
    sourceLabel: 'Premiere coverage',
    entitySlugs: ['the-long-night-ii'],
    hoursAgo: 18,
    eggBias: 0.09,
    participants: 6900,
    intensity: 26,
  },
  {
    slug: 'long-night-ii-cliffhanger-no-sequel',
    headline: 'The Long Night II ends on a cliffhanger with no third film greenlit',
    summary: 'The studio says a decision comes “after the theatrical window”. The film does not resolve its main plot.',
    body:
      'Audiences are split between admiring the nerve and resenting the bill. The counters currently reflect exactly that.',
    category: 'Entertainment',
    sourceLabel: 'Studio statement',
    entitySlugs: ['the-long-night-ii'],
    hoursAgo: 12,
    eggBias: 0.52,
    participants: 7200,
    intensity: 29,
  },
  {
    slug: 'meridian-library-cuts-weekend-hours',
    headline: 'Meridian Public Library cuts weekend hours across all eleven branches',
    summary: 'Saturday closing moves to 1pm and Sunday opening ends entirely, from next month.',
    body:
      'The library service says the cut protects weekday opening. Three of the eleven branches sit in areas where the library is the only free indoor study space.',
    category: 'Culture',
    sourceLabel: 'Service notice',
    entitySlugs: ['meridian-public-library'],
    hoursAgo: 41,
    eggBias: 0.84,
    participants: 2400,
    intensity: 18,
  },
  {
    slug: 'meridian-library-24-hour-study-hall',
    headline: 'Meridian Public Library opens a 24-hour study hall through exam season',
    summary: 'Six weeks, free, no library card needed, and the heating stays on.',
    body:
      'Funded by reallocating an events budget. Roughly nine hundred people used it in the first four nights.',
    category: 'Culture',
    sourceLabel: 'Service notice',
    entitySlugs: ['meridian-public-library'],
    hoursAgo: 23,
    eggBias: 0.06,
    participants: 2600,
    intensity: 19,
  },
  {
    slug: 'nimbus-ottermilk-loyalty-tie-up',
    headline: 'Nimbus Fare and Ottermilk launch a loyalty tie-up nobody asked for',
    summary: 'Collect flight points by buying coffee. Redeem them against a fee the airline invented.',
    body:
      'A partnership between two brands whose customers overlap mostly in the sense that both are tired. Reception is genuinely split.',
    category: 'Business',
    sourceLabel: 'Joint announcement',
    entitySlugs: ['nimbus-fare', 'ottermilk-coffee'],
    hoursAgo: 30,
    eggBias: 0.55,
    participants: 2200,
    intensity: 16,
  },
  {
    slug: 'city-bans-surprise-checkout-fees',
    headline: 'City council bans surprise checkout fees on all ticket sales',
    summary: 'Advertised price must be the price paid. Enforcement starts in ninety days.',
    body:
      'The rule covers travel, events and venues inside the city boundary, and applies to app-based sellers. Not attached to any one company — which is the point.',
    category: 'Controversy',
    sourceLabel: 'Council decision',
    entitySlugs: [],
    hoursAgo: 5,
    eggBias: 0.16,
    participants: 4300,
    intensity: 21,
  },
];
