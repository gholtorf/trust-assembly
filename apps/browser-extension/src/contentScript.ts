import { MessagePayload } from './models/MessagePayload';
import ArticleStateManager from './utils/ArticleStateManager';
import { TrustAssemblyMessage } from './utils/messagePassing';

console.log('Trust Assembly Headline Transformer content script loaded.');

function findHeadlineElement() {
  const selectors = [
    'h1.main-headline',
    'h1.article-title', 
    'h1.headline',
    'h1.detailHeadline',
    'h1[class*="headline"]', // Catch-all selector for any class containing the text "headline"
    // Enhanced selectors for major news sites
    'h1.headline__text', // CNN
    'h1.pg-headline', // CNN
    'h1.story-headline', // BBC
    'h1[data-testid="headline"]', // BBC
    'h1[data-testid="Headline"]', // Reuters
    'h1.ArticleHeader_headline', // Reuters
    'h1[data-key="card-headline"]', // AP
    'h1.Page-headline', // AP
    'h1.articleTitle', // MSNBC
    'h1.f-headline', // MSNBC
  ];
  console.log(
    `Searching for headline element using these selectors: ${selectors.join(', ')}`,
  );

  for (const selector of selectors) {
    const element = document.querySelector<HTMLElement>(selector);
    if (element) {
      console.log('Found headline element:', element);
      return element;
    }
  }

  console.log('Headline element not found on this page.');
}

async function checkForReplacements(url: string) {
  try {
    const encodedUrl = encodeURIComponent(url);
    const response = await fetch(`http://localhost:5173/api/automation/replacements/${encodedUrl}`);
    
    if (!response.ok) {
      console.log('No replacements available for this URL');
      return null;
    }
    
    const data = await response.json();
    if (data.success && data.replacements && data.replacements.length > 0) {
      console.log('Found replacements:', data.replacements);
      return data.replacements;
    }
    
    return null;
  } catch (error) {
    console.error('Error checking for replacements:', error);
    return null;
  }
}

const stateManager = new ArticleStateManager();
let modifiedHeadline: string | undefined;
let availableReplacements: any[] = [];

(async function () {
  const elementToModify = findHeadlineElement();
  if (!elementToModify) return;

  await stateManager.setElement(elementToModify);

  // Check for automated replacements
  const currentUrl = window.location.href;
  const replacements = await checkForReplacements(currentUrl);
  
  if (replacements && replacements.length > 0) {
    availableReplacements = replacements;
    
    // Use the highest confidence replacement as default
    const bestReplacement = replacements[0];
    modifiedHeadline = bestReplacement.transformed_headline;
    
    console.log(`Auto-applying replacement: "${bestReplacement.transformed_headline}" by ${bestReplacement.creator_name}`);
    
    // Create UI indicator showing the transformation
    createReplacementIndicator(elementToModify, bestReplacement, replacements);
    
    // Apply the transformation
    stateManager.setModifiedHeadline(modifiedHeadline);
  }

  elementToModify.addEventListener('click', () =>
    stateManager.toggleModification(modifiedHeadline),
  );

  chrome.runtime.onMessage.addListener(
    async (message: MessagePayload): Promise<boolean | undefined> => {
      console.log('Got message:', message);

      if (message.action === TrustAssemblyMessage.TOGGLE_MODIFICATION) {
        modifiedHeadline = message.headline;
        stateManager.toggleModification(modifiedHeadline);
        return false;
      }
      if (message.action === TrustAssemblyMessage.SET_MODIFIED_HEADLINE) {
        modifiedHeadline = message.headline;
        stateManager.setModifiedHeadline(modifiedHeadline);
        return false;
      }
    },
  );
})();

function createReplacementIndicator(headlineElement: HTMLElement, activeReplacement: any, allReplacements: any[]) {
  // Create indicator element
  const indicator = document.createElement('div');
  indicator.style.cssText = `
    position: relative;
    background: linear-gradient(45deg, #4CAF50, #45a049);
    color: white;
    padding: 8px 12px;
    margin: 8px 0;
    border-radius: 6px;
    font-size: 14px;
    font-family: Arial, sans-serif;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    cursor: pointer;
    border-left: 4px solid #2E7D32;
  `;
  
  indicator.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: space-between;">
      <div>
        <strong>✨ Trust Assembly Active</strong>
        <div style="font-size: 12px; opacity: 0.9; margin-top: 2px;">
          Transformed by: ${activeReplacement.creator_name}
          ${allReplacements.length > 1 ? ` (+${allReplacements.length - 1} other${allReplacements.length > 2 ? 's' : ''})` : ''}
        </div>
      </div>
      <div style="font-size: 20px;">🔍</div>
    </div>
  `;
  
  // Insert indicator before headline
  headlineElement.parentNode?.insertBefore(indicator, headlineElement);
  
  // Add click handler to show all alternatives
  indicator.addEventListener('click', (e) => {
    e.preventDefault();
    showReplacementOptions(allReplacements, headlineElement);
  });
}

function showReplacementOptions(replacements: any[], headlineElement: HTMLElement) {
  // Create modal overlay
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.7);
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
  `;
  
  // Create modal content
  const modal = document.createElement('div');
  modal.style.cssText = `
    background: white;
    border-radius: 8px;
    padding: 24px;
    max-width: 600px;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: 0 8px 24px rgba(0,0,0,0.3);
  `;
  
  modal.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
      <h3 style="margin: 0; color: #333;">Available Headline Transformations</h3>
      <button id="close-modal" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #666;">&times;</button>
    </div>
    <div style="margin-bottom: 16px; color: #666; font-size: 14px;">
      Original: <em>${headlineElement.textContent}</em>
    </div>
    <div id="replacement-list"></div>
  `;
  
  // Add replacement options
  const listContainer = modal.querySelector('#replacement-list');
  replacements.forEach((replacement, index) => {
    const option = document.createElement('div');
    option.style.cssText = `
      border: 2px solid #e0e0e0;
      border-radius: 6px;
      padding: 16px;
      margin-bottom: 12px;
      cursor: pointer;
      transition: all 0.3s ease;
    `;
    
    option.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 8px; color: #2E7D32;">
        ${replacement.creator_name}
      </div>
      <div style="margin-bottom: 8px; font-size: 16px; line-height: 1.4;">
        "${replacement.transformed_headline}"
      </div>
      <div style="font-size: 12px; color: #666;">
        Confidence: ${Math.round((replacement.confidence_score || 0.8) * 100)}% 
        | Views: ${replacement.views_count || 0}
      </div>
    `;
    
    option.addEventListener('click', () => {
      modifiedHeadline = replacement.transformed_headline;
      stateManager.setModifiedHeadline(modifiedHeadline);
      document.body.removeChild(overlay);
    });
    
    option.addEventListener('mouseenter', () => {
      option.style.borderColor = '#4CAF50';
      option.style.backgroundColor = '#f8fff8';
    });
    
    option.addEventListener('mouseleave', () => {
      option.style.borderColor = '#e0e0e0';
      option.style.backgroundColor = 'white';
    });
    
    listContainer?.appendChild(option);
  });
  
  // Close modal handlers
  modal.querySelector('#close-modal')?.addEventListener('click', () => {
    document.body.removeChild(overlay);
  });
  
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      document.body.removeChild(overlay);
    }
  });
  
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}
