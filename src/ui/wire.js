// Plugs the grading panel, submission types and download buttons into the review screen.
import { slots } from './screens/review.js';
import { renderGrading, submissionRows } from './parts/grading.js';
import { saveWork, startDownload, downloadQuestion } from './screens/download.js';

slots.side = renderGrading;
slots.extraRows = submissionRows;
slots.dialogs = downloadQuestion;
slots.wire = (view, state, store, warnings) => {
  view.querySelector('#btn-save-work')?.addEventListener('click', () => saveWork(store.get().course));
  view.querySelector('#btn-download')?.addEventListener('click', () => startDownload(store, warnings));
};
