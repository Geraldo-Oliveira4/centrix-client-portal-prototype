import { ChevronDown, ChevronRight, Copy } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui';

interface JsonViewerProps {
  data: any;
  level?: number;
  isNested?: boolean;
}

const JsonViewer = ({ data, level = 0, isNested = false }: JsonViewerProps) => {
  const [isExpanded, setIsExpanded] = useState(!isNested);

  if (data === null) return <span className="text-gray-500">null</span>;
  if (typeof data === 'boolean')
    return <span className="text-primary">{data.toString()}</span>;
  if (typeof data === 'number')
    return <span className="text-blue-600">{data}</span>;
  if (typeof data === 'string')
    return <span className="text-green-600">&quot;{data}&quot;</span>;

  if (Array.isArray(data)) {
    if (data.length === 0) return <span className="text-gray-500">[]</span>;

    return (
      <div className="inline-block">
        <div className="inline-flex items-center gap-1">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="hover:bg-slate-100 rounded p-0.5"
          >
            {isExpanded ? (
              <ChevronDown size={14} />
            ) : (
              <ChevronRight size={14} />
            )}
          </button>
          <span>[{data.length} items]</span>
        </div>
        {isExpanded && (
          <div className="ml-4 border-l border-slate-200 pl-2">
            {data.map((item, index) => (
              <div key={index} className="my-1">
                <span className="text-gray-500">{index}: </span>
                <JsonViewer data={item} level={level + 1} isNested />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (typeof data === 'object') {
    const entries = Object.entries(data);
    if (entries.length === 0)
      return <span className="text-gray-500">{'{}'}</span>;

    return (
      <div className="inline-block">
        <div className="inline-flex items-center gap-1">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="hover:bg-slate-100 rounded p-0.5"
          >
            {isExpanded ? (
              <ChevronDown size={14} />
            ) : (
              <ChevronRight size={14} />
            )}
          </button>
          <span>{entries.length} campos</span>
        </div>
        {isExpanded && (
          <div className="ml-4 border-l border-slate-200 pl-2">
            {entries.map(([key, value]) => (
              <div key={key} className="my-1">
                <span className="text-gray-700 font-medium">{key}: </span>
                <JsonViewer data={value} level={level + 1} isNested />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return null;
};

interface ExpandedDetailsProps {
  log: {
    status: 'SUCCESS' | 'ERROR';
    message: string;
    details: any;
  };
}

export const ExpandedDetails = ({ log }: ExpandedDetailsProps) => {
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="p-4 bg-slate-50 border-t">
      <div className="grid gap-4 max-w-[calc(100vw-200px)]">
        {/* Show message prominently for ERROR status */}
        {log.status === 'ERROR' && (
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-red-900">Erro</h4>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2"
                onClick={() => copyToClipboard(log.message)}
              >
                <Copy size={14} />
              </Button>
            </div>
            <p className="text-sm text-red-800 bg-red-50 p-2 rounded">
              {log.message}
            </p>
          </div>
        )}

        {/* Show details JSON if present */}
        {log.details && Object.keys(log.details).length > 0 && (
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-gray-900">Detalhes</h4>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2"
                onClick={() =>
                  copyToClipboard(JSON.stringify(log.details, null, 2))
                }
              >
                <Copy size={14} />
              </Button>
            </div>
            <div
              className={cn(
                'text-sm bg-white p-2 rounded border',
                'font-mono leading-relaxed',
              )}
            >
              <JsonViewer data={log.details} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
