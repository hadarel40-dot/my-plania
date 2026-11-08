import { createClientFromRequest } from '../_shared/base44.ts';
import { verifyDownload } from '../_shared/downloadLink.ts';
import {
  crcStart,
  crcUpdate,
  crcFinish,
  localHeader,
  dataDescriptor,
  centralHeader,
  endRecord,
} from '../_shared/zip.ts';

const MAX_FILES = 300;
const LINK_TTL_SECONDS = 900;
const ENTITIES = { travel: 'TravelQuestionnaire', business: 'BusinessQuestionnaire' };
const encoder = new TextEncoder();

function uniqueName(rawName, index, used) {
  const fallback = `file-${index + 1}`;
  const base =
    String(rawName || '')
      .replace(/[\\/:*?"<>|]+/g, '-')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 150) || fallback;
  const dot = base.lastIndexOf('.');
  const stem = dot > 0 ? base.slice(0, dot) : base;
  const ext = dot > 0 ? base.slice(dot) : '';
  let candidate = base;
  let n = 2;
  while (used.has(candidate.toLowerCase())) {
    candidate = `${stem} (${n})${ext}`;
    n += 1;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

function safeBase(value) {
  return (
    String(value || '')
      .replace(/[\\/:*?"<>|]+/g, '-')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 60) || 'project'
  );
}

// Public: reached from a short-lived signed link made by downloadProjectFiles.
// Streams every file of the project as one ZIP so the whole archive is never
// held in memory.
export default async function (req) {
  try {
    const requestUrl = new URL(req.url);
    let params = Object.fromEntries(requestUrl.searchParams.entries());
    if (!params.p) {
      const body = await req.json().catch(() => ({}));
      params = { ...params, ...body };
    }

    const projectId = String(params.p ?? params.projectId ?? '').trim();
    const exp = Number(params.e ?? params.exp ?? 0);
    const sig = String(params.s ?? params.sig ?? '').trim();
    if (!projectId || !sig) {
      return Response.json({ error: 'invalid' }, { status: 400 });
    }

    const base44 = createClientFromRequest(req);
    const project = await base44.asServiceRole.entities.ClientProject
      .get(projectId)
      .catch((e) => (e.status === 404 ? null : Promise.reject(e)));
    if (!project || !project.portal_token) {
      return Response.json({ error: 'invalid' }, { status: 404 });
    }

    const allowed = await verifyDownload(projectId, exp, sig, project.portal_token);
    if (!allowed) {
      return Response.json({ error: 'invalid' }, { status: 403 });
    }

    const materials = await base44.asServiceRole.entities.ClientMaterial.filter(
      { project_id: projectId },
      '-created_date',
      MAX_FILES
    );

    const collected = [];
    for (const material of materials || []) {
      for (const file of material.files || []) {
        if (file?.uri) collected.push({ name: file.name, uri: file.uri });
      }
    }

    const entity = ENTITIES[project.source_type];
    if (entity && project.source_id) {
      const questionnaire = await base44.asServiceRole.entities[entity]
        .get(project.source_id)
        .catch(() => null);
      for (const file of questionnaire?.files || []) {
        if (file?.uri) collected.push({ name: file.name, uri: file.uri });
      }
    }

    if (collected.length === 0) {
      return Response.json({ error: 'אין קבצים להורדה' }, { status: 400 });
    }

    const used = new Set();
    const files = collected.slice(0, MAX_FILES).map((item, index) => ({
      uri: item.uri,
      nameBytes: encoder.encode(uniqueName(item.name, index, used)),
    }));

    // Resolve every signed URL up front, then open the next file's stream while the
    // current one is still being copied. Signing and connecting used to happen one
    // file at a time, which added its latency to every single file in the archive.
    const signedUrls = files.map((file) =>
      base44.asServiceRole.integrations.Core.CreateFileSignedUrl({
        file_uri: file.uri,
        expires_in: LINK_TTL_SECONDS,
      })
        .then((result) => result?.signed_url || null)
        .catch(() => null)
    );

    const openFile = (i) => {
      if (i >= files.length) return null;
      return signedUrls[i]
        .then(async (signedUrl) => {
          if (!signedUrl) return null;
          const fetched = await fetch(signedUrl, { signal: AbortSignal.timeout(120000) });
          if (!fetched.ok || !fetched.body) return null;
          return fetched.body.getReader();
        })
        .catch(() => null);
    };

    const central = [];
    let offset = 0;
    let index = 0;
    let phase = 'next';
    let reader = null;
    let pending = openFile(0);
    let currentNameBytes = null;
    let currentHeaderOffset = 0;
    let crc = crcStart();
    let size = 0;

    const stream = new ReadableStream({
      async pull(controller) {
        while (true) {
          if (phase === 'next') {
            if (index >= files.length) {
              phase = 'central';
              continue;
            }
            const ready = pending || openFile(index);
            pending = null;
            const nextReader = await ready;
            if (!nextReader) {
              index += 1;
              pending = openFile(index);
              continue;
            }
            currentNameBytes = files[index].nameBytes;
            currentHeaderOffset = offset;
            crc = crcStart();
            size = 0;
            reader = nextReader;
            pending = openFile(index + 1);
            phase = 'header';
            continue;
          }

          if (phase === 'header') {
            const header = localHeader(currentNameBytes);
            controller.enqueue(header);
            offset += header.length;
            phase = 'data';
            return;
          }

          if (phase === 'data') {
            const { done, value } = await reader.read();
            if (done) {
              phase = 'descriptor';
              continue;
            }
            crc = crcUpdate(crc, value);
            size += value.length;
            offset += value.length;
            controller.enqueue(value);
            return;
          }

          if (phase === 'descriptor') {
            const finalCrc = crcFinish(crc);
            const descriptor = dataDescriptor(finalCrc, size);
            controller.enqueue(descriptor);
            offset += descriptor.length;
            central.push({
              nameBytes: currentNameBytes,
              crc: finalCrc,
              size,
              offset: currentHeaderOffset,
            });
            reader = null;
            currentNameBytes = null;
            index += 1;
            phase = 'next';
            continue;
          }

          if (phase === 'central') {
            const centralStart = offset;
            let centralSize = 0;
            for (const entry of central) {
              const chunk = centralHeader(entry.nameBytes, entry.crc, entry.size, entry.offset);
              controller.enqueue(chunk);
              centralSize += chunk.length;
            }
            offset += centralSize;
            controller.enqueue(endRecord(central.length, centralSize, centralStart));
            phase = 'done';
            controller.close();
            return;
          }

          return;
        }
      },
    });

    const fileName = `חומרים-${safeBase(project.name)}.zip`;

    return new Response(stream, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="project-files.zip"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}