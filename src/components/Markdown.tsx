import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * The one Markdown renderer for all AI and user text.
 * - Links open in a new tab and carry no referrer/credit (rel="noopener noreferrer nofollow").
 * - Images are NOT loaded (a remote image would leak the reader's IP); they show as links.
 * - Raw HTML is never rendered (react-markdown default).
 */
export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer nofollow" />,
          img: ({ src, alt }) => (
            <a href={typeof src === 'string' ? src : undefined} target="_blank" rel="noopener noreferrer nofollow">
              {alt || 'image link'}
            </a>
          ),
        }}
      >
        {children || ''}
      </ReactMarkdown>
    </div>
  );
}

export default Markdown;
