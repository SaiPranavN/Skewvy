'use client';

import { useEffect, useState } from 'react';
import { receiptToDataUrl, type ReceiptFormat, type ReceiptInput } from '@/lib/client/receipt';
import type { ArtifactTotals, ArtifactType, UserContribution } from '@/lib/domain/types';

function totals(
  eggs: number,
  medals: number,
  critical: number,
  appreciative: number,
  participants = critical + appreciative,
): ArtifactTotals {
  return {
    artifactType: 'flash_news',
    artifactId: 'x',
    rottenEggTotal: eggs,
    medalTotal: medals,
    negativeOpinionTotal: critical,
    positiveOpinionTotal: appreciative,
    uniqueParticipantTotal: participants,
    // A side cannot be changed, so everyone who sent Eggs is a critic and
    // everyone who gave Medals is an admirer — which is what makes these
    // fixtures realistic rather than merely type-correct.
    rottenEggContributorTotal: critical,
    medalContributorTotal: appreciative,
    updatedAt: new Date().toISOString(),
  };
}

function own(eggs: number, medals: number): UserContribution {
  return { rottenEggCount: eggs, medalCount: medals, stance: eggs > 0 ? 'negative' : 'positive' };
}

const LOGO = '/uploads/cc9a4a81-25ad-43fe-8037-4c30376c758f.png';
const PHOTO = '/uploads/9acd705b-76c3-460d-93c0-567eee98a0b5.png';

interface Case {
  name: string;
  note: string;
  input: ReceiptInput;
}

const CASES: Case[] = [
  {
    name: 'Egg contributor',
    note: 'Personal total matches the public one.',
    input: {
      title: 'Fictional company adds a surprise fee',
      artifactType: 'flash_news' as ArtifactType,
      category: 'Business',
      imageUrl: PHOTO,
      totals: totals(265, 24, 2, 1),
      contribution: own(265, 0),
      url: 'https://skewvy.com/flash-news/surprise-fee',
    },
  },
  {
    name: 'Medal contributor',
    note: 'Profile with a logo.',
    input: {
      title: 'Skewvy',
      artifactType: 'entity' as ArtifactType,
      category: 'Technology',
      imageUrl: LOGO,
      totals: totals(266, 392, 2, 1),
      contribution: own(0, 392),
      url: 'https://skewvy.com/entities/skewvy',
    },
  },
  {
    name: 'No contribution',
    note: 'Public status card — makes no personal claim.',
    input: {
      title: 'Verity Transit finally opens the east tunnel, four years late',
      artifactType: 'flash_news' as ArtifactType,
      category: 'Community',
      imageUrl: PHOTO,
      totals: totals(302, 3890, 58, 901),
      contribution: null,
      url: 'https://skewvy.com/flash-news/east-tunnel',
    },
  },
  {
    name: 'Long headline',
    note: 'Must fit, not clip.',
    input: {
      title:
        'Pelican Studios ships Harborline without the cooperative campaign it spent eighteen months teasing in three trailers and one keynote',
      artifactType: 'flash_news' as ArtifactType,
      category: 'Gaming',
      imageUrl: PHOTO,
      totals: totals(4210, 188, 612, 41),
      contribution: own(1240, 0),
      url: 'https://skewvy.com/flash-news/harborline-co-op',
    },
  },
  {
    name: 'Missing image',
    note: 'Falls back to the tone tile and initials.',
    input: {
      title: 'Northlight Press pays its freelancers in seven days flat',
      artifactType: 'flash_news' as ArtifactType,
      category: 'Culture',
      imageUrl: null,
      totals: totals(96, 2410, 20, 704),
      contribution: own(0, 118),
      url: 'https://skewvy.com/flash-news/northlight-pays',
    },
  },
  {
    name: 'Very large totals',
    note: 'Personal and public differ by orders of magnitude.',
    input: {
      title: 'Halcyon Play removes offline downloads two weeks before flight season',
      artifactType: 'flash_news' as ArtifactType,
      category: 'Entertainment',
      imageUrl: PHOTO,
      totals: totals(1284000, 96400, 128400, 9640, 138040),
      contribution: own(2, 0),
      url: 'https://skewvy.com/flash-news/offline-downloads',
    },
  },
  {
    name: 'Single egg',
    note: 'Singular wording, tiny contribution, busy crowd.',
    input: {
      title: 'Sable Lantern renames itself "Sable*" for the third time',
      artifactType: 'flash_news' as ArtifactType,
      category: 'Business',
      imageUrl: LOGO,
      totals: totals(2640, 74, 388, 12),
      contribution: own(1, 0),
      url: 'https://skewvy.com/flash-news/sable-rename',
    },
  },
];

export function ReceiptGallery() {
  const [format, setFormat] = useState<ReceiptFormat>('story');
  const [phone, setPhone] = useState(false);
  const [images, setImages] = useState<Record<string, string | null>>({});

  useEffect(() => {
    let cancelled = false;
    setImages({});

    (async () => {
      for (const item of CASES) {
        const data = await receiptToDataUrl(item.input, format);
        if (cancelled) return;
        setImages((current) => ({ ...current, [item.name]: data }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [format]);

  return (
    <div className="rail py-10">
      <h1 className="display text-[clamp(30px,4vw,56px)]">Receipt bench</h1>
      <p className="mt-3 text-secondary">Development only. Every poster below is the real canvas render.</p>

      <div className="mt-6 flex flex-wrap gap-3">
        <div className="seg on-paper bg-paper">
          {(['story', 'square'] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setFormat(option)}
              aria-pressed={format === option}
              className="seg-opt"
            >
              {option}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setPhone((value) => !value)}
          className="btn btn-outline px-4 py-2.5 text-sm"
        >
          {phone ? 'Full size' : 'Phone-sized preview'}
        </button>
      </div>

      <div className="mt-8 flex flex-wrap items-start gap-8">
        {CASES.map((item) => (
          <figure key={item.name} className="m-0">
            <figcaption className="mb-3 max-w-[280px]">
              <div className="text-sm font-bold text-primary">{item.name}</div>
              <div className="mt-1 text-xs text-tertiary">{item.note}</div>
            </figcaption>
            {images[item.name] ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={images[item.name] as string}
                alt={item.name}
                className="border border-[var(--border-default)]"
                style={{ width: phone ? 180 : 360, height: 'auto' }}
              />
            ) : (
              <div
                className="skeleton"
                style={{
                  width: phone ? 180 : 360,
                  aspectRatio: format === 'story' ? '1080/1920' : '1',
                }}
              />
            )}
          </figure>
        ))}
      </div>
    </div>
  );
}
