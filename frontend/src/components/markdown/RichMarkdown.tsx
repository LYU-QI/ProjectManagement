import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';

type Props = {
  children: string;
  className?: string;
};

export default function RichMarkdown({ children, className }: Props) {
  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
