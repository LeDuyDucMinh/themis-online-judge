import React from 'react';
import katex from 'katex';

interface MathRendererProps {
  content: string;
  className?: string;
}

/**
 * Component hiển thị văn bản Markdown kết hợp công thức toán học LaTeX qua KaTeX
 * Hỗ trợ cú pháp $inline math$ và $$display math$$
 */
export const MathRenderer: React.FC<MathRendererProps> = ({ content, className = '' }) => {
  if (!content) return null;

  // Tách và render cả inline LaTeX ($...$) và block LaTeX ($$...$$)
  const renderMathAndText = (text: string) => {
    // Tách các khối $$...$$ trước
    const blockParts = text.split(/(\$\$[\s\S]*?\$\$)/g);

    return blockParts.map((blockPart, bIdx) => {
      if (blockPart.startsWith('$$') && blockPart.endsWith('$$')) {
        const mathExpr = blockPart.slice(2, -2).trim();
        try {
          const html = katex.renderToString(mathExpr, {
            displayMode: true,
            throwOnError: false,
          });
          return (
            <div
              key={`block-math-${bIdx}`}
              className="my-3 overflow-x-auto text-center py-1 bg-slate-50 dark:bg-slate-800/50 rounded-lg p-2"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        } catch {
          return <pre key={`err-block-${bIdx}`} className="text-red-500">{blockPart}</pre>;
        }
      }

      // Xử lý $inline math$ trong từng block thông thường
      const inlineParts = blockPart.split(/(\$[^$\n]+?\$)/g);
      return (
        <span key={`block-txt-${bIdx}`}>
          {inlineParts.map((part, iIdx) => {
            if (part.startsWith('$') && part.endsWith('$') && part.length > 2) {
              const inlineExpr = part.slice(1, -1).trim();
              try {
                const html = katex.renderToString(inlineExpr, {
                  displayMode: false,
                  throwOnError: false,
                });
                return (
                  <span
                    key={`inline-math-${bIdx}-${iIdx}`}
                    className="inline-math mx-0.5"
                    dangerouslySetInnerHTML={{ __html: html }}
                  />
                );
              } catch {
                return <code key={`err-inline-${iIdx}`}>{part}</code>;
              }
            }

            // Xử lý các định dạng Markdown cơ bản (headings, bold, code)
            return renderMarkdownParagraphs(part, `${bIdx}-${iIdx}`);
          })}
        </span>
      );
    });
  };

  const renderMarkdownParagraphs = (raw: string, keyPrefix: string) => {
    const lines = raw.split('\n');
    return lines.map((line, lineIdx) => {
      // Heading 3
      if (line.startsWith('### ')) {
        return (
          <h4 key={`${keyPrefix}-h3-${lineIdx}`} className="text-base font-bold text-slate-800 dark:text-slate-100 mt-4 mb-2 flex items-center gap-1.5">
            <span className="w-1.5 h-4 bg-blue-600 rounded-full inline-block"></span>
            {line.substring(4)}
          </h4>
        );
      }
      // Heading 2
      if (line.startsWith('## ')) {
        return (
          <h3 key={`${keyPrefix}-h2-${lineIdx}`} className="text-lg font-bold text-slate-900 dark:text-white mt-5 mb-2 pb-1 border-b border-slate-200 dark:border-slate-800">
            {line.substring(3)}
          </h3>
        );
      }
      // Heading 1
      if (line.startsWith('# ')) {
        return (
          <h2 key={`${keyPrefix}-h1-${lineIdx}`} className="text-xl font-extrabold text-slate-900 dark:text-white mt-6 mb-3">
            {line.substring(2)}
          </h2>
        );
      }
      // Bullet list
      if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        const itemContent = line.trim().substring(2);
        return (
          <li key={`${keyPrefix}-li-${lineIdx}`} className="ml-5 list-disc text-slate-700 dark:text-slate-300 my-0.5">
            {parseInlineStyles(itemContent)}
          </li>
        );
      }
      // Empty line
      if (!line.trim()) {
        return <div key={`${keyPrefix}-br-${lineIdx}`} className="h-2" />;
      }
      // Regular paragraph
      return (
        <p key={`${keyPrefix}-p-${lineIdx}`} className="text-slate-700 dark:text-slate-300 leading-relaxed my-1">
          {parseInlineStyles(line)}
        </p>
      );
    });
  };

  const parseInlineStyles = (str: string) => {
    // Thay thế `code`, **bold**, *italic*
    const parts = str.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g);
    return parts.map((seg, sIdx) => {
      if (seg.startsWith('`') && seg.endsWith('`')) {
        return (
          <code
            key={`c-${sIdx}`}
            className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400 font-mono text-sm border border-slate-200 dark:border-slate-700"
          >
            {seg.slice(1, -1)}
          </code>
        );
      }
      if (seg.startsWith('**') && seg.endsWith('**')) {
        return (
          <strong key={`b-${sIdx}`} className="font-semibold text-slate-900 dark:text-white">
            {seg.slice(2, -2)}
          </strong>
        );
      }
      if (seg.startsWith('*') && seg.endsWith('*') && seg.length > 2) {
        return (
          <em key={`i-${sIdx}`} className="italic text-slate-900 dark:text-white">
            {seg.slice(1, -1)}
          </em>
        );
      }
      return seg;
    });
  };

  return <div className={`prose-sm max-w-none text-slate-700 dark:text-slate-200 ${className}`}>{renderMathAndText(content)}</div>;
};

