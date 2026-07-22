'use client';

import { useState } from 'react';
import Link from 'next/link';

import { ResumeEditorPanel } from '@/components/resume-editor-panel';
import { ResumeUploadPanel } from '@/components/resume-upload-panel';
import type { ResumeFileRecord } from '@/types';

interface ResumeOverviewWorkspaceProps {
  initialFiles: ResumeFileRecord[];
}

export function ResumeOverviewWorkspace({ initialFiles }: ResumeOverviewWorkspaceProps) {
  const [files, setFiles] = useState(initialFiles);

  return (
    <div className="grid gap-6">
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-indigo-100 bg-indigo-50/70 px-5 py-4">
        <div>
          <p className="text-sm font-semibold text-slate-900">Vous préférez ne pas importer de CV ?</p>
          <p className="mt-1 text-sm text-slate-600">Créez directement votre profil et renseignez vos informations à votre rythme.</p>
        </div>
        <Link href="/profile" className="rounded-xl border border-indigo-200 bg-white px-4 py-2 text-sm font-semibold text-indigo-700 transition hover:border-indigo-300 hover:bg-indigo-100">
          Saisir mon profil
        </Link>
      </section>
      <ResumeUploadPanel initialFiles={files} onFilesChange={setFiles} />
      <ResumeEditorPanel files={files} />
    </div>
  );
}
