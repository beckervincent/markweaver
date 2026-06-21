class HTMLToMarkdown {
  constructor(options = {}) {
    this.options = Object.assign({
      articleMode: true,
      includeImages: true,
      includeLinks: true,
      baseUrl: ''
    }, options);
  }

  convert(htmlInput) {
    let element;
    if (typeof htmlInput === 'string') {
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlInput, 'text/html');
      element = doc.body;
    } else {
      element = htmlInput;
    }

    if (this.options.articleMode) {
      element = this.extractMainContent(element);
    } else {
      element = element.cloneNode(true);
    }

    this.cleanElement(element);
    let markdown = this.traverse(element);
    return this.postProcess(markdown);
  }

  extractMainContent(root) {

    const selectors = [
      'article',
      '[role="main"]',
      'main',
      '#content',
      '.content',
      '#main',
      '.main',
      '#post',
      '.post',
      '.article',
      '.post-content',
      '.entry-content'
    ];

    for (const selector of selectors) {
      const found = root.querySelector(selector);
      if (found) {
        return found.cloneNode(true);
      }
    }

    const divs = root.querySelectorAll('div, section, td');
    let bestCandidate = null;
    let maxParagraphs = 0;

    divs.forEach(div => {

      const pCount = div.querySelectorAll('p').length;
      if (pCount > maxParagraphs) {
        maxParagraphs = pCount;
        bestCandidate = div;
      }
    });

    if (bestCandidate && maxParagraphs > 1) {
      return bestCandidate.cloneNode(true);
    }

    return root.cloneNode(true);
  }

  cleanElement(element) {
    const unwantedSelectors = [
      'script', 'style', 'noscript', 'iframe', 'svg', 'canvas', 'video', 'audio',
      'nav', 'footer', 'header', 'aside', '.nav', '.footer', '.header', '.aside',
      '.sidebar', '.comments', '#comments', '.ads', '#ads', 'form', 'input', 'button',
      'select', 'textarea', 'dialog', 'embed', 'object', 'meta', 'link'
    ];

    unwantedSelectors.forEach(selector => {
      element.querySelectorAll(selector).forEach(el => el.remove());
    });

    element.querySelectorAll('*').forEach(el => {
      const style = el.getAttribute('style') || '';
      if (style.includes('display: none') || style.includes('visibility: hidden')) {
        el.remove();
      }
    });
  }

  traverse(node, context = { depth: 0, listType: null, listIndex: 0, inPre: false }) {
    if (node.nodeType === Node.TEXT_NODE) {
      if (context.inPre) {
        return node.nodeValue;
      }

      const text = node.nodeValue.replace(/\s+/g, ' ');

      return text === ' ' ? ' ' : text;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return '';
    }

    const tagName = node.tagName.toUpperCase();
    let childrenMarkdown = '';

    const childNodes = Array.from(node.childNodes);

    let nextContext = Object.assign({}, context);
    if (tagName === 'PRE') {
      nextContext.inPre = true;
    }

    if (tagName === 'OL') {
      childNodes.forEach(child => {
        if (child.nodeType === Node.ELEMENT_NODE && child.tagName.toUpperCase() === 'LI') {

          const liSiblings = childNodes.filter(n => n.nodeType === Node.ELEMENT_NODE && n.tagName.toUpperCase() === 'LI');
          const liIndex = liSiblings.indexOf(child) + 1;
          childrenMarkdown += this.traverse(child, {
            depth: context.depth + 1,
            listType: 'ol',
            listIndex: liIndex,
            inPre: nextContext.inPre
          });
        } else {
          childrenMarkdown += this.traverse(child, nextContext);
        }
      });
    } else if (tagName === 'UL') {
      childNodes.forEach(child => {
        if (child.nodeType === Node.ELEMENT_NODE && child.tagName.toUpperCase() === 'LI') {
          childrenMarkdown += this.traverse(child, {
            depth: context.depth + 1,
            listType: 'ul',
            inPre: nextContext.inPre
          });
        } else {
          childrenMarkdown += this.traverse(child, nextContext);
        }
      });
    } else {
      childNodes.forEach(child => {
        childrenMarkdown += this.traverse(child, nextContext);
      });
    }

    switch (tagName) {
      case 'H1':
        return `\n\n# ${childrenMarkdown.trim()}\n\n`;
      case 'H2':
        return `\n\n## ${childrenMarkdown.trim()}\n\n`;
      case 'H3':
        return `\n\n### ${childrenMarkdown.trim()}\n\n`;
      case 'H4':
        return `\n\n#### ${childrenMarkdown.trim()}\n\n`;
      case 'H5':
        return `\n\n##### ${childrenMarkdown.trim()}\n\n`;
      case 'H6':
        return `\n\n###### ${childrenMarkdown.trim()}\n\n`;
      case 'P':
        return `\n\n${childrenMarkdown.trim()}\n\n`;
      case 'BR':
        return '\n';
      case 'HR':
        return '\n\n---\n\n';
      case 'STRONG':
      case 'B':
        const boldText = childrenMarkdown.trim();
        return boldText ? `**${boldText}**` : '';
      case 'EM':
      case 'I':
        const italicText = childrenMarkdown.trim();
        return italicText ? `*${italicText}*` : '';
      case 'S':
      case 'DEL':
      case 'STRIKE':
        const strikeText = childrenMarkdown.trim();
        return strikeText ? `~~${strikeText}~~` : '';
      case 'CODE':
        if (context.inPre) {
          return childrenMarkdown;
        }
        const inlineCode = childrenMarkdown.trim();
        return inlineCode ? ` \`${inlineCode}\` ` : '';
      case 'PRE': {
        const codeElem = node.querySelector('code');
        const lang = codeElem ? (codeElem.className.match(/language-(\w+)/)?.[1] || '') : '';

        const rawCode = codeElem ? codeElem.textContent : node.textContent;
        return `\n\n\`\`\`${lang}\n${rawCode.trim()}\n\`\`\`\n\n`;
      }
      case 'A': {
        if (!this.options.includeLinks) return childrenMarkdown;
        let href = node.getAttribute('href') || '';
        if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
          if (this.options.baseUrl) {
            try {
              href = new URL(href, this.options.baseUrl).href;
            } catch(e) {}
          }
        }
        const text = childrenMarkdown.trim();
        if (!text && !href) return '';
        if (!href) return text;
        return `[${text || href}](${href})`;
      }
      case 'IMG': {
        if (!this.options.includeImages) return '';
        let src = node.getAttribute('src') || '';
        if (src) {
          if (this.options.baseUrl) {
            try {
              src = new URL(src, this.options.baseUrl).href;
            } catch(e) {}
          }
        }
        const alt = node.getAttribute('alt') || '';
        return `![${alt}](${src})`;
      }
      case 'LI': {
        const indent = '  '.repeat(Math.max(0, context.depth - 1));
        const prefix = context.listType === 'ol' ? `${context.listIndex}. ` : '* ';
        const cleanedText = childrenMarkdown.trim().replace(/\n+/g, '\n' + indent + '  ');
        return `\n${indent}${prefix}${cleanedText}`;
      }
      case 'BLOCKQUOTE':
        return `\n\n${childrenMarkdown.trim().split('\n').map(line => `> ${line}`).join('\n')}\n\n`;
      case 'TABLE':
        return `\n\n${this.parseTable(node)}\n\n`;
      default:
        return childrenMarkdown;
    }
  }

  parseTable(tableNode) {
    const rows = Array.from(tableNode.querySelectorAll('tr'));
    if (rows.length === 0) return '';

    let markdownTable = '';
    let maxCells = 0;

    const mdRows = rows.map(row => {
      const cells = Array.from(row.querySelectorAll('th, td'));
      maxCells = Math.max(maxCells, cells.length);
      const cellTexts = cells.map(cell => {

        const cellConverter = new HTMLToMarkdown({
          articleMode: false,
          includeImages: this.options.includeImages,
          includeLinks: this.options.includeLinks,
          baseUrl: this.options.baseUrl
        });
        return cellConverter.convert(cell).replace(/\n+/g, ' ').trim();
      });
      return `| ${cellTexts.join(' | ')} |`;
    });

    if (mdRows.length > 0) {
      const headerRow = mdRows[0];
      const separators = Array(maxCells).fill('---');
      const separatorRow = `| ${separators.join(' | ')} |`;

      const firstRowHasHeaders = rows[0].querySelector('th') !== null;

      if (firstRowHasHeaders) {
        markdownTable = [mdRows[0], separatorRow, ...mdRows.slice(1)].join('\n');
      } else {

        const dummyHeaders = Array(maxCells).fill(' ');
        const dummyHeaderRow = `| ${dummyHeaders.join(' | ')} |`;
        markdownTable = [dummyHeaderRow, separatorRow, ...mdRows].join('\n');
      }
    }

    return markdownTable;
  }

  postProcess(markdown) {
    return markdown

      .split('\n')
      .map(line => line.trimEnd())
      .join('\n')

      .replace(/\n{3,}/g, '\n\n')

      .trim();
  }
}
