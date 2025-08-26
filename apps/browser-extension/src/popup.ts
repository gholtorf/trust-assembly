import { getTransformation } from './api/backendApi';
import { MessagePayload } from './models/MessagePayload';
import { TransformedArticle } from './models/TransformedArticle';
import { TrustAssemblyMessage } from './utils/messagePassing';

// state
let currentUrl: string | undefined = undefined;
let selectedAuthor: string | undefined;
let selectedHeadline: string | undefined;

// constants for new-headline view
const MAX_HEADLINE_LENGTH = 120;

type ButtonDisplayState = 'none' | 'retrive' | 'toggle';

// popup elements
const retrieveButton = document.getElementById('retrieve-transform');
const toggleButton = document.getElementById('toggle-transform');
const selectElement = document.getElementById(
  'transform-select',
) as HTMLSelectElement;

// elements for new-headline view
const replaceHeadlineButton = document.getElementById('replace-headline');
const newHeadlineView = document.getElementById('new-headline-view');
const newHeadlineForm = document.getElementById('new-headline-form') as HTMLFormElement | null;
const nhOriginal = document.getElementById('nh-original') as HTMLTextAreaElement | null;
const nhReplacement = document.getElementById('nh-replacement') as HTMLTextAreaElement | null;
const nhOriginalCount = document.getElementById('nh-original-count');
const nhReplacementCount = document.getElementById('nh-replacement-count');
const nhOriginalError = document.getElementById('nh-original-error');
const nhReplacementError = document.getElementById('nh-replacement-error');
const nhCitationsContainer = document.getElementById('nh-citations');
const nhCitationsError = document.getElementById('nh-citations-error');
const nhCancel = document.getElementById('nh-cancel');

type Citation = { url: string; explanation: string };
let citations: Citation[] = [{ url: '', explanation: '' }];

// set current url
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const urlString = tabs[0].url;
  if (!urlString) {
    return;
  }

  const url = new URL(urlString);
  currentUrl = url.origin + url.pathname;
});

// event listeners
selectElement.addEventListener('change', (event) => {
  const previousAuthor = selectedAuthor;
  selectedAuthor = (event.target as HTMLSelectElement).value;
  if (selectedAuthor) {
    if (selectedAuthor !== previousAuthor) {
      setButtonDisplayState('retrive');
    } else {
      setButtonDisplayState('toggle');
    }
  } else {
    setButtonDisplayState('none');
  }
});

retrieveButton?.addEventListener('click', async () => {
  if (!currentUrl) {
    console.warn('No current URL found');
    return;
  }

  const data = await getHeadlineData(currentUrl, selectElement.value);
  if (data) {
    setButtonDisplayState('toggle');
    selectedHeadline = data.transformedHeadline;
    await setModifiedHeadline();
  }
});

toggleButton?.addEventListener('click', async () => {
  await toggleHeadline();
});

// new-headline: open form
replaceHeadlineButton?.addEventListener('click', () => {
  openNewHeadlineView();
});

// new-headline: cancel
nhCancel?.addEventListener('click', () => {
  closeNewHeadlineView();
});

// new-headline: live counts
nhOriginal?.addEventListener('input', () => updateCountsAndErrors());
nhReplacement?.addEventListener('input', () => updateCountsAndErrors());

// new-headline: submit
newHeadlineForm?.addEventListener('submit', (e) => {
  e.preventDefault();
  const errors = validateNewHeadlineForm();
  if (Object.keys(errors).length === 0) {
    // mimic NewHeadline.tsx behavior: just log the values
    console.log({
      originalHeadline: nhOriginal?.value ?? '',
      replacementHeadline: nhReplacement?.value ?? '',
      citations: citations,
    });
  }
});

const STORED_DATA = 'storedHeadlineData';

async function getHeadlineData(
  url: string,
  author: string,
): Promise<TransformedArticle | undefined> {
  const storedData = await retrieveStoredResult(author);
  if (storedData) {
    return storedData;
  }

  const data = await getTransformation(url, author);
  if (data) {
    await storeResult(author, data);
  }
  return data;
}

async function retrieveStoredResult(
  author: string,
): Promise<TransformedArticle | undefined> {
  const key = keyFn(author);
  const storedData = (await chrome.storage.session.get(key))[key];

  if (!storedData) {
    return undefined;
  }

  return JSON.parse(storedData) as TransformedArticle;
}

function storeResult(author: string, data: TransformedArticle): Promise<void> {
  return chrome.storage.session.set({
    [keyFn(author)]: JSON.stringify(data),
  });
}

function keyFn(author: string): string {
  return `${STORED_DATA}:${currentUrl}:${author}`;
}

async function setModifiedHeadline(): Promise<void> {
  await sendHeadlineMessage(TrustAssemblyMessage.SET_MODIFIED_HEADLINE);
}

async function toggleHeadline(): Promise<void> {
  sendHeadlineMessage(TrustAssemblyMessage.TOGGLE_MODIFICATION);
}

async function sendHeadlineMessage(event: TrustAssemblyMessage): Promise<void> {
  const [tab] = await chrome.tabs.query({
    active: true,
    lastFocusedWindow: true,
  });
  if (tab?.id) {
    chrome.tabs.sendMessage<MessagePayload>(tab.id, {
      action: event,
      headline: selectedHeadline,
    });
  }
}

function setButtonDisplayState(state: ButtonDisplayState): void {
  switch (state) {
    case 'none':
      retrieveButton!.style.display = 'none';
      toggleButton!.style.display = 'none';
      break;
    case 'retrive':
      retrieveButton!.style.display = 'block';
      toggleButton!.style.display = 'none';
      break;
    case 'toggle':
      retrieveButton!.style.display = 'none';
      toggleButton!.style.display = 'block';
      break;
  }
}

// =========================
// New Headline view helpers
// =========================

function openNewHeadlineView(): void {
  // hide transform controls
  selectElement.style.display = 'none';
  retrieveButton && (retrieveButton.style.display = 'none');
  toggleButton && (toggleButton.style.display = 'none');
  replaceHeadlineButton && (replaceHeadlineButton.style.display = 'none');

  // initialize fields similar to NewHeadline defaults
  if (nhOriginal) nhOriginal.value = 'New Study Proves Coffee Cures Cancer';
  if (nhReplacement)
    nhReplacement.value =
      'Study Finds Correlation Between Coffee Consumption and Lower Risk of Certain Cancers';
  citations = [{ url: '', explanation: '' }];
  renderCitations();
  updateCountsAndErrors(true);

  // show view
  if (newHeadlineView) newHeadlineView.style.display = 'block';
}

function closeNewHeadlineView(): void {
  // hide view
  if (newHeadlineView) newHeadlineView.style.display = 'none';

  // show transform controls again
  selectElement.style.display = 'block';
  // do not force button state changes here; keep whatever state previously set
  replaceHeadlineButton && (replaceHeadlineButton.style.display = 'inline-block');
}

function updateCountsAndErrors(clearOnly?: boolean): void {
  const originalLength = nhOriginal?.value.length ?? 0;
  const replacementLength = nhReplacement?.value.length ?? 0;

  if (nhOriginalCount)
    nhOriginalCount.textContent = `${originalLength} / ${MAX_HEADLINE_LENGTH}`;
  if (nhReplacementCount)
    nhReplacementCount.textContent = `${replacementLength} / ${MAX_HEADLINE_LENGTH}`;

  if (clearOnly) {
    if (nhOriginalError) nhOriginalError.style.display = 'none';
    if (nhReplacementError) nhReplacementError.style.display = 'none';
    if (nhCitationsError) nhCitationsError.style.display = 'none';
    return;
  }
}

function validateNewHeadlineForm(): {
  originalHeadline?: string;
  replacementHeadline?: string;
  citations?: string;
} {
  const errors: { originalHeadline?: string; replacementHeadline?: string; citations?: string } = {};
  const original = nhOriginal?.value ?? '';
  const replacement = nhReplacement?.value ?? '';
  if (!original.trim()) {
    errors.originalHeadline = 'Original headline is required.';
  } else if (original.length > MAX_HEADLINE_LENGTH) {
    errors.originalHeadline = `Original headline must be at most ${MAX_HEADLINE_LENGTH} characters.`;
  }
  if (!replacement.trim()) {
    errors.replacementHeadline = 'Replacement headline is required.';
  } else if (replacement.length > MAX_HEADLINE_LENGTH) {
    errors.replacementHeadline = `Replacement headline must be at most ${MAX_HEADLINE_LENGTH} characters.`;
  }
  const hasCitation = citations.some((c) => c.url.trim() !== '');
  if (!hasCitation) {
    errors.citations = 'At least one citation URL is required.';
  }

  // display errors
  if (nhOriginalError) {
    nhOriginalError.textContent = errors.originalHeadline ?? '';
    nhOriginalError.style.display = errors.originalHeadline ? 'block' : 'none';
  }
  if (nhReplacementError) {
    nhReplacementError.textContent = errors.replacementHeadline ?? '';
    nhReplacementError.style.display = errors.replacementHeadline ? 'block' : 'none';
  }
  if (nhCitationsError) {
    nhCitationsError.textContent = errors.citations ?? '';
    nhCitationsError.style.display = errors.citations ? 'block' : 'none';
  }

  return errors;
}

function renderCitations(): void {
  if (!nhCitationsContainer) return;
  // clear existing
  nhCitationsContainer.innerHTML = '';

  citations.forEach((citation, idx) => {
    const wrapper = document.createElement('div');
    wrapper.style.marginBottom = '8px';

    const urlInput = document.createElement('input');
    urlInput.type = 'text';
    urlInput.placeholder = 'https://...';
    urlInput.value = citation.url;
    urlInput.style.width = '100%';
    urlInput.style.boxSizing = 'border-box';
    urlInput.addEventListener('input', (e) => {
      const value = (e.target as HTMLInputElement).value;
      citations[idx] = { ...citations[idx], url: value };
      if (idx === citations.length - 1 && value.trim() !== '') {
        citations.push({ url: '', explanation: '' });
      }
      trimTrailingEmptyCitations();
      renderCitations();
      // keep any citations error visibility consistent
      if (nhCitationsError) nhCitationsError.style.display = 'none';
    });
    wrapper.appendChild(urlInput);

    const explanationArea = document.createElement('textarea');
    explanationArea.placeholder = 'Optional explanation (e.g. what this citation supports)';
    explanationArea.value = citation.explanation;
    explanationArea.rows = 2;
    explanationArea.style.width = '100%';
    explanationArea.style.boxSizing = 'border-box';
    explanationArea.style.fontSize = '12px';
    explanationArea.style.marginTop = '4px';
    explanationArea.addEventListener('input', (e) => {
      const value = (e.target as HTMLTextAreaElement).value;
      citations[idx] = { ...citations[idx], explanation: value };
    });
    wrapper.appendChild(explanationArea);

    nhCitationsContainer.appendChild(wrapper);
  });
}

function trimTrailingEmptyCitations(): void {
  while (
    citations.length > 1 &&
    citations[citations.length - 1].url === '' &&
    citations[citations.length - 2].url === ''
  ) {
    citations.pop();
  }
}
