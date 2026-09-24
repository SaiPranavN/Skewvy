'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useState } from 'react';
import { ImageField } from './ImageField';
import { ENTITY_CATEGORIES, FLASH_NEWS_CATEGORIES } from '@/lib/domain/types';
import type { ActionResult } from '@/app/admin/actions';
import type { ContentStatus } from '@/lib/domain/types';

const inputClass =
  'w-full rounded-[var(--radius-control)] border border-[var(--border-default)] bg-elevated px-4 py-2.5 text-sm text-primary placeholder:text-tertiary focus:border-[var(--border-strong)] focus:outline-none';

function FormField({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-secondary">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-xs font-medium text-brand">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-tertiary">{hint}</p>
      ) : null}
    </div>
  );
}

export interface EntityFormValues {
  id?: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  imageUrl: string | null;
  status: ContentStatus;
}

export interface FlashNewsFormValues {
  id?: string;
  headline: string;
  slug: string;
  summary: string;
  body: string;
  category: string;
  imageUrl: string | null;
  sourceLabel: string | null;
  sourceUrl: string | null;
  status: ContentStatus;
  entityIds: string[];
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 120);
}

function StatusPicker({ defaultValue }: { defaultValue: ContentStatus }) {
  return (
    <FormField id="status" label="Status" hint="Only published content appears publicly or accepts reactions.">
      <select id="status" name="status" defaultValue={defaultValue} className={inputClass}>
        <option value="draft">Draft</option>
        <option value="published">Published</option>
        <option value="archived">Archived</option>
      </select>
    </FormField>
  );
}

function FormFooter({
  state,
  pending,
  previewHref,
  cancelHref,
}: {
  state: ActionResult;
  pending: boolean;
  previewHref: string | null;
  cancelHref: string;
}) {
  return (
    <div className="sticky bottom-0 -mx-5 mt-2 flex flex-wrap items-center gap-3 border-t border-[var(--border-subtle)] bg-ground px-5 py-4  sm:-mx-6 sm:px-6">
      <button
        type="submit"
        disabled={pending}
        className="min-h-11 rounded-[var(--radius-control)] bg-primary px-4 py-2.5 text-sm font-medium text-ground transition-opacity duration-150 hover:opacity-90 disabled:opacity-50"
      >
        {pending ? 'Saving…' : 'Save'}
      </button>

      {previewHref && (
        <Link
          href={previewHref}
          target="_blank"
          rel="noreferrer"
          className="rounded-[var(--radius-control)] border border-[var(--border-default)] px-4 py-2.5 text-sm font-medium text-secondary transition-colors hover:border-[var(--border-strong)]"
        >
          Preview ↗
        </Link>
      )}

      <Link href={cancelHref} className="text-sm text-secondary transition-colors hover:text-primary">
        Back to list
      </Link>

      <p
        role="status"
        className={`ml-auto text-sm ${state.ok ? 'text-success' : state.message ? 'text-brand' : 'text-secondary'}`}
      >
        {state.message}
      </p>
    </div>
  );
}

export function EntityForm({
  values,
  action,
}: {
  values: EntityFormValues;
  action: (previous: ActionResult, formData: FormData) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(action, { ok: false });
  const [name, setName] = useState(values.name);
  const [slug, setSlug] = useState(values.slug);
  const [slugTouched, setSlugTouched] = useState(Boolean(values.slug));

  useEffect(() => {
    if (state.ok && state.redirectTo && !values.id) router.push(state.redirectTo);
  }, [state, router, values.id]);

  return (
    <form action={formAction} className="panel space-y-5 rounded-[var(--radius-card)] p-5 sm:p-6">
      <FormField id="name" label="Name" error={state.fields?.name}>
        <input
          id="name"
          name="name"
          required
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            if (!slugTouched) setSlug(slugify(event.target.value));
          }}
          className={inputClass}
          placeholder="Nimbus Fare"
        />
      </FormField>

      <FormField id="slug" label="Slug" hint="Used in the public URL: /entities/your-slug" error={state.fields?.slug}>
        <input
          id="slug"
          name="slug"
          required
          value={slug}
          onChange={(event) => {
            setSlugTouched(true);
            setSlug(event.target.value);
          }}
          className={inputClass}
        />
      </FormField>

      <FormField id="description" label="Short description" error={state.fields?.description}>
        <textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={values.description}
          className={inputClass}
          placeholder="What is this, in one or two sentences?"
        />
      </FormField>

      <div className="grid gap-5 sm:grid-cols-2">
        <FormField id="category" label="Category" error={state.fields?.category}>
          <select id="category" name="category" defaultValue={values.category || ENTITY_CATEGORIES[0]} className={inputClass}>
            {ENTITY_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </FormField>

      </div>

      <ImageField name="imageUrl" defaultValue={values.imageUrl} />

      <StatusPicker defaultValue={values.status} />

      <FormFooter
        state={state}
        pending={pending}
        previewHref={values.slug ? `/entities/${values.slug}` : null}
        cancelHref="/admin/entities"
      />
    </form>
  );
}

export function FlashNewsForm({
  values,
  entities,
  action,
}: {
  values: FlashNewsFormValues;
  entities: Array<{ id: string; name: string; category: string }>;
  action: (previous: ActionResult, formData: FormData) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(action, { ok: false });
  const [headline, setHeadline] = useState(values.headline);
  const [slug, setSlug] = useState(values.slug);
  const [slugTouched, setSlugTouched] = useState(Boolean(values.slug));
  const [selectedEntities, setSelectedEntities] = useState<string[]>(values.entityIds);

  useEffect(() => {
    if (state.ok && state.redirectTo && !values.id) router.push(state.redirectTo);
  }, [state, router, values.id]);

  const toggleEntity = (id: string) => {
    setSelectedEntities((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  };

  return (
    <form action={formAction} className="panel space-y-5 rounded-[var(--radius-card)] p-5 sm:p-6">
      <FormField id="headline" label="Headline" error={state.fields?.headline}>
        <input
          id="headline"
          name="headline"
          required
          value={headline}
          onChange={(event) => {
            setHeadline(event.target.value);
            if (!slugTouched) setSlug(slugify(event.target.value));
          }}
          className={inputClass}
          placeholder="Nimbus Fare adds a “seat selection convenience fee”"
        />
      </FormField>

      <FormField id="slug" label="Slug" hint="Used in the public URL: /flash-news/your-slug" error={state.fields?.slug}>
        <input
          id="slug"
          name="slug"
          required
          value={slug}
          onChange={(event) => {
            setSlugTouched(true);
            setSlug(event.target.value);
          }}
          className={inputClass}
        />
      </FormField>

      <FormField id="summary" label="Short context sentence" error={state.fields?.summary}>
        <textarea id="summary" name="summary" rows={2} defaultValue={values.summary} className={inputClass} />
      </FormField>

      <FormField id="body" label="Body" hint="What happened, in full. Shown on the detail page." error={state.fields?.body}>
        <textarea id="body" name="body" rows={7} defaultValue={values.body} className={inputClass} />
      </FormField>

      <div className="grid gap-5 sm:grid-cols-2">
        <FormField id="category" label="Category" error={state.fields?.category}>
          <select id="category" name="category" defaultValue={values.category || FLASH_NEWS_CATEGORIES[0]} className={inputClass}>
            {FLASH_NEWS_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </FormField>


        <FormField id="sourceLabel" label="Source / context label">
          <input
            id="sourceLabel"
            name="sourceLabel"
            defaultValue={values.sourceLabel ?? ''}
            className={inputClass}
            placeholder="Company statement"
          />
        </FormField>

        <FormField id="sourceUrl" label="Source URL">
          <input
            id="sourceUrl"
            name="sourceUrl"
            defaultValue={values.sourceUrl ?? ''}
            className={inputClass}
            placeholder="https://…"
          />
        </FormField>
      </div>

      <ImageField name="imageUrl" defaultValue={values.imageUrl} />

      <fieldset className="space-y-2.5">
        <legend className="text-sm font-medium text-secondary">Related Profiles</legend>
        <p className="text-xs text-tertiary">
          A Story can belong to one Profile, several, or none at all.
        </p>

        {selectedEntities.map((id) => (
          <input key={id} type="hidden" name="entityIds" value={id} />
        ))}

        <div className="flex flex-wrap gap-2 pt-1">
          {entities.map((entity) => {
            const selected = selectedEntities.includes(entity.id);
            return (
              <button
                key={entity.id}
                type="button"
                onClick={() => toggleEntity(entity.id)}
                aria-pressed={selected}
                className={`min-h-9 rounded-[var(--radius-control)] border px-3 py-2 text-xs transition-colors duration-150 ${
                  selected
                    ? 'border-[var(--border-strong)] bg-surface-2 text-primary'
                    : 'border-[var(--border-default)] text-secondary hover:border-[var(--border-strong)] hover:text-primary'
                }`}
              >
                {selected ? '✓ ' : ''}
                {entity.name}
              </button>
            );
          })}
        </div>
      </fieldset>

      <StatusPicker defaultValue={values.status} />

      <FormFooter
        state={state}
        pending={pending}
        previewHref={values.slug ? `/flash-news/${values.slug}` : null}
        cancelHref="/admin/flash-news"
      />
    </form>
  );
}
