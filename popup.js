document.addEventListener('DOMContentLoaded', async () => {
  const tabDomainSpan = document.getElementById('tab-domain');
  const permissionView = document.getElementById('permission-view');
  const converterView = document.getElementById('converter-view');
  const btnGrantSite = document.getElementById('btn-grant-site');
  const btnGrantAll = document.getElementById('btn-grant-all');
  const btnConvert = document.getElementById('btn-convert');
  const btnCopy = document.getElementById('btn-copy');
  const btnCopyText = document.getElementById('btn-copy-text');
  const resultsPanel = document.getElementById('results-panel');
  const markdownOutput = document.getElementById('markdown-output');
  const statWords = document.getElementById('stat-words');
  const statChars = document.getElementById('stat-chars');
  const loader = document.getElementById('converter-loader');
  const btnThemeToggle = document.getElementById('btn-theme-toggle');

  let activeTab = null;
  let currentOrigin = null;

  chrome.storage.local.get(['theme', 'articleMode', 'includeLinks', 'includeImages'], (result) => {
    if (result.theme === 'light') {
      document.body.classList.add('light-theme');
      btnThemeToggle.querySelector('.icon-sun').classList.add('hidden');
      btnThemeToggle.querySelector('.icon-moon').classList.remove('hidden');
    }
    if (result.articleMode !== undefined) document.getElementById('chk-article-mode').checked = result.articleMode;
    if (result.includeLinks !== undefined) document.getElementById('chk-include-links').checked = result.includeLinks;
    if (result.includeImages !== undefined) document.getElementById('chk-include-images').checked = result.includeImages;
  });

  btnThemeToggle.addEventListener('click', () => {
    const isLight = document.body.classList.toggle('light-theme');
    const iconSun = btnThemeToggle.querySelector('.icon-sun');
    const iconMoon = btnThemeToggle.querySelector('.icon-moon');

    if (isLight) {
      iconSun.classList.add('hidden');
      iconMoon.classList.remove('hidden');
      chrome.storage.local.set({ theme: 'light' });
    } else {
      iconSun.classList.remove('hidden');
      iconMoon.classList.add('hidden');
      chrome.storage.local.set({ theme: 'dark' });
    }
  });

  document.getElementById('chk-article-mode').addEventListener('change', (e) => {
    chrome.storage.local.set({ articleMode: e.target.checked });
  });
  document.getElementById('chk-include-links').addEventListener('change', (e) => {
    chrome.storage.local.set({ includeLinks: e.target.checked });
  });
  document.getElementById('chk-include-images').addEventListener('change', (e) => {
    chrome.storage.local.set({ includeImages: e.target.checked });
  });

  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs || tabs.length === 0) {
      showErrorView("No active tab found.");
      return;
    }
    activeTab = tabs[0];
    const urlString = activeTab.url;

    if (!urlString || urlString.startsWith('chrome://') || urlString.startsWith('chrome-extension://') || urlString.startsWith('about:') || urlString.startsWith('view-source:')) {
      tabDomainSpan.textContent = "System Page";
      showSystemPageWarning();
      return;
    }

    const url = new URL(urlString);
    currentOrigin = `${url.protocol}//${url.host}/*`;
    tabDomainSpan.textContent = url.hostname;

    checkPermissions();
  } catch (err) {
    showErrorView("Initialization error: " + err.message);
  }

  function checkPermissions() {
    if (!currentOrigin) return;

    chrome.permissions.contains({
      origins: [currentOrigin]
    }, (hasPermission) => {
      if (hasPermission) {

        permissionView.classList.add('hidden');
        converterView.classList.remove('hidden');
      } else {

        permissionView.classList.remove('hidden');
        converterView.classList.add('hidden');
      }
    });
  }

  btnGrantSite.addEventListener('click', () => {
    if (!currentOrigin) return;

    chrome.permissions.request({
      origins: [currentOrigin]
    }, (granted) => {
      if (granted) {
        checkPermissions();
      }
    });
  });

  btnGrantAll.addEventListener('click', () => {
    chrome.permissions.request({
      origins: ['*://*/*']
    }, (granted) => {
      if (granted) {
        checkPermissions();
      }
    });
  });

  btnConvert.addEventListener('click', async () => {
    if (!activeTab) return;

    resultsPanel.classList.add('hidden');
    showLoader();

    try {

      chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        func: () => {
          return {
            html: document.documentElement.outerHTML,
            title: document.title,
            url: window.location.href
          };
        }
      }, (results) => {
        hideLoader();
        if (chrome.runtime.lastError) {
          showError("Access error: " + chrome.runtime.lastError.message);
          return;
        }

        if (!results || !results[0] || !results[0].result) {
          showError("Could not retrieve contents of this page.");
          return;
        }

        const { html, title, url } = results[0].result;

        const articleMode = document.getElementById('chk-article-mode').checked;
        const includeLinks = document.getElementById('chk-include-links').checked;
        const includeImages = document.getElementById('chk-include-images').checked;

        try {
          const converter = new HTMLToMarkdown({
            articleMode: articleMode,
            includeLinks: includeLinks,
            includeImages: includeImages,
            baseUrl: url
          });

          const markdown = converter.convert(html);

          if (!markdown.trim()) {
            showError("No content extracted. Try disabling 'Article Mode' to capture everything.");
            return;
          }

          markdownOutput.value = markdown;

          const wordCount = markdown.split(/\s+/).filter(Boolean).length;
          const charCount = markdown.length;

          statWords.textContent = wordCount.toLocaleString();
          statChars.textContent = charCount.toLocaleString();

          resultsPanel.classList.remove('hidden');
        } catch (convErr) {
          showError("Conversion error: " + convErr.message);
        }
      });
    } catch (err) {
      hideLoader();
      showError("Scripting error: " + err.message);
    }
  });

  btnCopy.addEventListener('click', () => {
    const text = markdownOutput.value;
    if (!text) return;

    navigator.clipboard.writeText(text).then(() => {

      const iconCopy = btnCopy.querySelector('.icon-copy');
      const iconCheck = btnCopy.querySelector('.icon-check');

      btnCopy.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
      btnCopyText.textContent = "Copied! ✓";
      iconCopy.classList.add('hidden');
      iconCheck.classList.remove('hidden');

      setTimeout(() => {
        btnCopy.style.background = '';
        btnCopyText.textContent = "Copy Markdown";
        iconCopy.classList.remove('hidden');
        iconCheck.classList.add('hidden');
      }, 2000);
    }).catch(err => {
      showError("Clipboard error: " + err.message);
    });
  });

  function showLoader() {
    loader.classList.remove('hidden');
    btnConvert.disabled = true;
    btnConvert.style.opacity = '0.5';
  }

  function hideLoader() {
    loader.classList.add('hidden');
    btnConvert.disabled = false;
    btnConvert.style.opacity = '1';
  }

  function showError(message) {
    alert(message);
  }

  function showErrorView(message) {
    converterView.classList.add('hidden');
    permissionView.classList.remove('hidden');
    permissionView.innerHTML = `
      <div class="panel-content text-center">
        <div class="status-icon-wrapper" style="background-color: rgba(239, 68, 68, 0.1); border-color: rgba(239, 68, 68, 0.2); color: #ef4444;">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="36" height="36">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h3 style="color: #f87171;">System Error</h3>
        <p class="description-text">${message}</p>
      </div>
    `;
  }

  function showSystemPageWarning() {
    converterView.classList.add('hidden');
    permissionView.classList.remove('hidden');
    permissionView.innerHTML = `
      <div class="panel-content text-center">
        <div class="status-icon-wrapper" style="background-color: rgba(245, 158, 11, 0.1); border-color: rgba(245, 158, 11, 0.2); color: #f59e0b;">
          <!-- Exclamation Warning -->
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="36" height="36">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h3>Secure Page</h3>
        <p class="description-text">
          Browser security policies block content script access to browser settings, blank pages, and system tabs.
        </p>
        <p class="description-text" style="font-size: 11px; margin-top:-10px; color: var(--text-muted);">
          Please try it on any standard website (e.g. news sites, blogs, documentation pages).
        </p>
      </div>
    `;
  }
});
